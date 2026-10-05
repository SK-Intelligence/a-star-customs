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
BMW_F32 = {
    "mode": "specific",
    "makes": ["BMW"],
    "models": ["3-Series", "4-Series"],
    "chassisCodes": ["F32", "F33", "F34"],
}


@pytest.mark.parametrize(
    ("fitment", "text", "outside"),
    [
        # A "not ..." list names what the listing does not fit.
        (
            MERCEDES_C_CLASS,
            "Mercedes C-Class W205 and GLC X253; not CLA or GLA.",
            set(),
        ),
        (MERCEDES_C_CLASS, "Mercedes C-Class; not for the A-Class, CLA or GLA", set()),
        # Without "not" the same names are still caught.
        (
            MERCEDES_C_CLASS,
            "Mercedes C-Class W205, CLA or GLA.",
            {"model:mercedes-benz/cla", "model:mercedes-benz/gla"},
        ),
        # "not" before ordinary words hides nothing that follows the sentence.
        (
            MERCEDES_C_CLASS,
            "The price is not indicative. Fits the Mercedes CLA.",
            {"model:mercedes-benz/cla"},
        ),
        (BMW_F32, "BMW F-Series F32/F33 F34", set()),
        (
            {**BMW_F32, "chassisCodes": ["F32", "G22"]},
            "BMW F-Series",
            {"generation:bmw/f"},
        ),
        ({**BMW_F32, "chassisCodes": []}, "BMW F-Series", {"generation:bmw/f"}),
    ],
)
def test_text_against_fitment_reads_negations_and_generations(
    fitment: dict[str, Any], text: str, outside: set[str]
) -> None:
    listing = _listing(fitment, text)
    terms = check.vehicle_terms(check.listing_text(listing))
    assert check.terms_outside_fitment(listing, terms) == outside


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
