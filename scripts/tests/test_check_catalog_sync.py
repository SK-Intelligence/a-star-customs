"""Self-tests for scripts/check_catalog_sync.py (run by the Quality gate's unit job)."""

from __future__ import annotations

import copy
import sys
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import check_catalog_sync as check  # noqa: E402


@pytest.fixture(scope="module")
def catalog() -> list[dict[str, Any]]:
    return check.load_json_array(check.FRONTEND_CATALOG)


@pytest.fixture(scope="module")
def add_ons() -> list[dict[str, Any]]:
    return check.load_json_array(check.FRONTEND_ADD_ONS)


@pytest.mark.parametrize(
    "text",
    [
        "8x LED strips",
        "H264",
        "E27 bulb",
        "S100 controller",
        "Mk2 controller box",
        "A4 size manual",
        "the A1 quality",
        "golf bags",
        "a class of its own",
        # Trim-shaped codes without a Mercedes nearby are not vehicles either.
        "C200 and C300 owners",
    ],
)
def test_everyday_text_names_no_vehicle(text: str) -> None:
    assert check.vehicle_terms(text) == set()


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        # Decision: in Mercedes context a class letter plus a number ending in 0 is a trim of
        # that class (C200/C300 -> C-Class), not a chassis code.
        (
            "Mercedes C200 and C300 owners",
            {"make:mercedes-benz", "model:mercedes-benz/c-class"},
        ),
        (
            "Mercedes C-Class W205 / C205",
            {
                "make:mercedes-benz",
                "model:mercedes-benz/c-class",
                "chassis:w205",
                "chassis:c205",
            },
        ),
        (
            "Audi A3 8V and 8Y",
            {"make:audi", "model:audi/a3", "chassis:8v", "chassis:8y"},
        ),
        ("A3 8V", {"model:audi/a3", "chassis:8v"}),
        (
            "VW Golf Mk7 and Mk7.5",
            {
                "make:volkswagen",
                "model:volkswagen/golf",
                "chassis:mk7",
                "chassis:mk7.5",
            },
        ),
        ("Golf Mk8", {"model:volkswagen/golf", "chassis:mk8"}),
        ("BMW F32 4 Series", {"make:bmw", "chassis:f32", "model:bmw/4-series"}),
        # "F-Series" is a chassis generation, not a model.
        ("BMW F-Series", {"make:bmw", "generation:bmw/f"}),
        (
            "Mercedes A-Class W177, CLA C118/X118 and GLB X247",
            {
                "make:mercedes-benz",
                "model:mercedes-benz/a-class",
                "model:mercedes-benz/cla",
                "model:mercedes-benz/glb",
                "chassis:w177",
                "chassis:c118",
                "chassis:x118",
                "chassis:x247",
            },
        ),
        (
            "fits the A/B/CLA/GLA",
            {
                "model:mercedes-benz/a-class",
                "model:mercedes-benz/b-class",
                "model:mercedes-benz/cla",
                "model:mercedes-benz/gla",
            },
        ),
        (
            "an E Class for Mercedes drivers",
            {"make:mercedes-benz", "model:mercedes-benz/e-class"},
        ),
    ],
)
def test_vehicle_text_is_still_recognised(text: str, expected: set[str]) -> None:
    assert check.vehicle_terms(text) == expected


def test_full_check_passes_on_the_catalogue() -> None:
    check.main(["--ci"])


def test_discovery_guard_trips_when_covers_is_loosened(
    catalog: list[dict[str, Any]],
    add_ons: list[dict[str, Any]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def make_only(base: dict[str, Any], candidate: dict[str, Any]) -> bool:
        fit = candidate["fitment"]
        if fit["mode"] == "universal" or not fit["makes"]:
            return True
        return check._values(base["fitment"]["makes"]) <= check._values(fit["makes"])

    monkeypatch.setattr(check, "covers", make_only)

    with pytest.raises(SystemExit, match="discovery offers .* which it does not fit"):
        check.check_fitment_guards(catalog, add_ons, heuristics=False)


def test_text_heuristics_run_only_with_ci(
    catalog: list[dict[str, Any]], add_ons: list[dict[str, Any]]
) -> None:
    planted = copy.deepcopy(catalog)
    product = next(
        p for p in planted if p["slug"] == "mercedes-c-class-oem-ambient-lighting"
    )
    product["descriptionHtml"] += "<p>Also fits the Audi A3 8V.</p>"

    check.check_fitment_guards(planted, add_ons, heuristics=False)
    with pytest.raises(SystemExit, match="outside its fitment"):
        check.check_fitment_guards(planted, add_ons, heuristics=True)


def _listing(fitment: dict[str, Any], text: str) -> dict[str, Any]:
    return {"title": text, "fitment": {"label": "", **fitment}}


MERCEDES_C_CLASS = {
    "mode": "specific",
    "makes": ["Mercedes-Benz"],
    "models": ["C-Class", "GLC"],
    "chassisCodes": ["W205", "C205", "X253"],
}
MERCEDES_CLA = {
    "mode": "specific",
    "makes": ["Mercedes-Benz"],
    "models": ["CLA"],
    "chassisCodes": [],
}
MERCEDES_W177 = {
    "mode": "specific",
    "makes": ["Mercedes-Benz"],
    "models": ["A-Class"],
    "chassisCodes": ["W177"],
}
BMW_F32 = {
    "mode": "specific",
    "makes": ["BMW"],
    "models": ["3-Series", "4-Series"],
    "chassisCodes": ["F32", "F33", "F34"],
}
BMW_F30 = {
    "mode": "specific",
    "makes": ["BMW"],
    "models": ["3-Series"],
    "chassisCodes": ["F30"],
}


@pytest.mark.parametrize(
    ("fitment", "text"),
    [
        # The catalogue's own phrasing: names after "not" that the fitment leaves out.
        (MERCEDES_C_CLASS, "Mercedes C-Class W205/C205 and GLC X253; not CLA or GLA."),
        (MERCEDES_C_CLASS, "Mercedes C-Class; not for the A-Class, CLA or GLA"),
        (
            {**MERCEDES_W177, "models": ["A-Class", "B-Class"]},
            "Mercedes A-Class W177 front dashboard vents only, not C-Class.",
        ),
        # A generation passes only next to explicit chassis codes, which are checked.
        (BMW_F32, "BMW F-Series F32/F33 F34"),
        (BMW_F32, "BMW 4 Series F32/F33 & 3 Series GT F34"),
    ],
)
def test_text_that_matches_its_fitment_passes(
    fitment: dict[str, Any], text: str
) -> None:
    assert check.text_terms_outside_fitment(_listing(fitment, text)) == set()


@pytest.mark.parametrize(
    ("fitment", "text", "must_include"),
    [
        # A negated list stops at a make word: the Audi names are positive claims.
        (MERCEDES_CLA, "Fits CLA, not GLA or Audi A3 owners", {"make:audi"}),
        (MERCEDES_CLA, "not GLA/Audi A3", {"make:audi", "model:audi/a3"}),
        (
            MERCEDES_CLA,
            "Mercedes CLA, not GLA, Audi Q3 also supported",
            {"make:audi", "model:audi/q3"},
        ),
        (
            MERCEDES_CLA,
            "Mercedes CLA but not GLA and BMW 3 Series also fits",
            {"make:bmw", "model:bmw/3-series"},
        ),
        # "and" ends the negated list, so W205 is a positive claim.
        (
            MERCEDES_W177,
            "Mercedes W177, not W176 and W205 C-Class supported",
            {"chassis:w205"},
        ),
        # Without "not" the names are claims.
        (
            MERCEDES_C_CLASS,
            "Mercedes C-Class W205, CLA or GLA.",
            {"model:mercedes-benz/cla", "model:mercedes-benz/gla"},
        ),
        # "not" before ordinary words hides nothing that follows.
        (
            MERCEDES_C_CLASS,
            "The price is not indicative. Fits the Mercedes CLA.",
            {"model:mercedes-benz/cla"},
        ),
        # Negating a vehicle the fitment includes contradicts it.
        (MERCEDES_CLA, "Mercedes kit, not CLA", {"not model:mercedes-benz/cla"}),
        # A bare generation claims every chassis in it.
        (BMW_F30, "Fits all BMW F-Series", {"generation:bmw/f"}),
        (
            {**BMW_F32, "chassisCodes": ["F32", "G22"]},
            "BMW F-Series",
            {"generation:bmw/f"},
        ),
        # Chassis codes after a generation are still checked.
        (
            {**BMW_F32, "chassisCodes": ["F32"]},
            "BMW F-Series F32/F33 F34",
            {"chassis:f33"},
        ),
        # An E-code after "F-Series" is not that generation's code.
        (BMW_F30, "BMW F-Series E90", {"generation:bmw/f", "chassis:e90"}),
    ],
)
def test_text_naming_vehicles_outside_the_fitment_fails(
    fitment: dict[str, Any], text: str, must_include: set[str]
) -> None:
    outside = check.text_terms_outside_fitment(_listing(fitment, text))
    assert must_include <= outside


def test_a_bare_generation_fails_the_full_text_check(
    catalog: list[dict[str, Any]], add_ons: list[dict[str, Any]]
) -> None:
    planted = copy.deepcopy(catalog)
    product = next(
        p for p in planted if p["slug"] == "-bmw-f-series-oem-ambient-package"
    )
    product["descriptionHtml"] += "<p>Suits the whole BMW F-Series.</p>"

    with pytest.raises(SystemExit, match=r"generation:bmw/f"):
        check.check_fitment_guards(planted, add_ons, heuristics=True)


@pytest.mark.parametrize(
    ("slug", "old", "new", "label"),
    [
        (
            "-bmw-f-series-oem-ambient-package",
            "Tweeter Speakers – £149.99",
            "Tweeter Speakers – £129.99",
            "Tweeter speakers",
        ),
        (
            "mercedes-c-class-oem-ambient-lighting",
            "Dashboard: +£179.99",
            "Dashboard: +£219.99",
            "Dashboard",
        ),
        (
            "mercedes-c-class-oem-ambient-lighting",
            "Front &amp; rear vents: +£219.99",
            "Front &amp; rear vents: +£199.99",
            "Front and rear vents",
        ),
        (
            "calipers",
            "Caliper Decals - £35.",
            "Caliper Decals - £45.",
            "Caliper Decals",
        ),
    ],
)
def test_copy_price_guard_trips_on_a_wrong_add_on_price(
    catalog: list[dict[str, Any]],
    add_ons: list[dict[str, Any]],
    slug: str,
    old: str,
    new: str,
    label: str,
) -> None:
    planted = copy.deepcopy(catalog)
    product = next(p for p in planted if p["slug"] == slug)
    assert old in product["descriptionHtml"]
    product["descriptionHtml"] = product["descriptionHtml"].replace(old, new)

    with pytest.raises(SystemExit, match=rf"{slug} copy prices {label} at"):
        check.check_fitment_guards(planted, add_ons, heuristics=True)


def test_copy_prices_match_on_the_catalogue(
    catalog: list[dict[str, Any]], add_ons: list[dict[str, Any]]
) -> None:
    by_id = {p["id"]: p for p in catalog}
    for slug in (
        "-bmw-f-series-oem-ambient-package",
        "mercedes-c-class-oem-ambient-lighting",
        "calipers",
        "ambient-lighting-package-",
    ):
        base = next(p for p in catalog if p["slug"] == slug)
        assert check.copy_price_mismatches(base, add_ons, by_id) == []
    # "AMG Dashboard: +£219.99" is not read as the £179.99 Dashboard.
    c_class = next(
        p for p in catalog if p["slug"] == "mercedes-c-class-oem-ambient-lighting"
    )
    assert "AMG Dashboard: +£219.99" in check._copy_text(c_class["descriptionHtml"])


@pytest.mark.parametrize(
    ("slug", "expected"),
    [
        (
            "-bmw-f-series-oem-ambient-package",
            [
                "speaker-lights",
                "premium-animation-pack",
                "bmw-tweeter-speakers",
                "bmw-door-speakers",
                "bmw-illuminated-door-handles",
            ],
        ),
        (
            "full-oem-ambient-lighting-upgrade-a-class1",
            ["a-class-oem-vents", "a-class-oem-dashboard", "a-class-oem-speakers"],
        ),
        ("ambient-lighting-upgrade", ["speaker-lights", "premium-animation-pack"]),
        ("car-interior-ambient-led-light-kit-audi-q3-2018-current", []),
        ("calipers", ["caliper-decals"]),
        ("caliper-decals-add-on", []),
    ],
)
def test_add_on_port_offers_the_union_scoped_to_each_listing(
    catalog: list[dict[str, Any]],
    add_ons: list[dict[str, Any]],
    slug: str,
    expected: list[str],
) -> None:
    by_id = {p["id"]: p for p in catalog}
    base = next(p for p in catalog if p["slug"] == slug)
    assert [a["id"] for a, _ in check.add_on_options(base, add_ons, by_id)] == expected


def test_c_class_keeps_exactly_its_six_add_ons(
    catalog: list[dict[str, Any]], add_ons: list[dict[str, Any]]
) -> None:
    by_id = {p["id"]: p for p in catalog}
    base = next(
        p for p in catalog if p["slug"] == "mercedes-c-class-oem-ambient-lighting"
    )
    ids = [a["id"] for a, _ in check.add_on_options(base, add_ons, by_id)]
    assert len(ids) == 6 and all(i.startswith("c-class-") for i in ids)


def test_a_family_wide_generic_add_on_trips_the_approval_guard(
    catalog: list[dict[str, Any]], add_ons: list[dict[str, Any]]
) -> None:
    planted = copy.deepcopy(add_ons)
    del next(a for a in planted if a["id"] == "speaker-lights")["appliesToProducts"]

    with pytest.raises(
        SystemExit, match="generic add-on speaker-lights on vehicle-specific"
    ):
        check.check_fitment_guards(catalog, planted, heuristics=False)
