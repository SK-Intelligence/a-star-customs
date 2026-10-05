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
