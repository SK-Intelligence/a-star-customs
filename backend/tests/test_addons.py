from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app import addons
from app.addons import (
    AddOnConfigurationError,
    AddOnOption,
    add_ons_for_product,
    load_add_ons,
)
from app.catalog import CatalogConfigurationError, load_catalog


C_CLASS_ID = "prod_01KS68E0X8NM8FT2FXN6S0YXCF"


def scoped_option(**overrides: object) -> dict[str, object]:
    return {
        "id": "scoped",
        "status": "active",
        "label": "Scoped",
        "description": "Scoped add-on.",
        "appliesToFamilies": ["ambient-lighting"],
        "appliesToProducts": [C_CLASS_ID],
        "exclusiveGroup": "c-class-dashboard",
        "productId": "prod_scoped",
        "variantId": "variant_scoped",
        **overrides,
    }


def test_scoped_option_accepts_valid_fields() -> None:
    option = AddOnOption.model_validate(scoped_option())

    assert option.appliesToProducts == [C_CLASS_ID]
    assert option.exclusiveGroup == "c-class-dashboard"


@pytest.mark.parametrize(
    "overrides",
    [
        {"appliesToProducts": []},
        {"appliesToProducts": [C_CLASS_ID, C_CLASS_ID]},
        {"appliesToProducts": [""]},
        {"appliesToProducts": ["   "]},
        {"appliesToProducts": None},
        {"exclusiveGroup": "C-Class Dashboard"},
        {"exclusiveGroup": "-leading-dash"},
        {"exclusiveGroup": ""},
        {"exclusiveGroup": None},
    ],
    ids=[
        "empty-product-list",
        "duplicate-product-ids",
        "empty-product-id",
        "whitespace-product-id",
        "explicit-null-products",
        "group-with-uppercase-and-spaces",
        "group-with-leading-dash",
        "empty-group",
        "explicit-null-group",
    ],
)
def test_scoped_option_rejects_invalid_fields(overrides: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        AddOnOption.model_validate(scoped_option(**overrides))


def test_load_add_ons_rejects_single_member_exclusive_group(
    monkeypatch,
    tmp_path: Path,
) -> None:
    config_path = tmp_path / "add-ons.json"
    config_path.write_text(json.dumps([scoped_option()]), encoding="utf-8")
    monkeypatch.setattr(addons, "ADD_ONS_PATH", config_path)
    load_add_ons.cache_clear()
    try:
        with pytest.raises(AddOnConfigurationError):
            load_add_ons()
    finally:
        load_add_ons.cache_clear()


def test_disabled_c_class_add_ons_leave_the_c_class_without_generic_add_ons() -> None:
    disabled_add_ons = [
        option.model_copy(
            update={"status": "disabled", "productId": None, "variantId": None}
        )
        if option.appliesToProducts is not None
        else option
        for option in load_add_ons()
    ]
    base = load_catalog()[C_CLASS_ID]

    options = add_ons_for_product(disabled_add_ons, base.id, base.family)

    assert len(options) == 6
    assert all(option.appliesToProducts == [C_CLASS_ID] for option in options)
    assert all(option.status == "disabled" for option in options)


def unscoped_option(option_id: str, **overrides: object) -> AddOnOption:
    fields = scoped_option(
        id=option_id,
        **{
            "productId": f"prod_{option_id}",
            "variantId": f"variant_{option_id}",
            **overrides,
        },
    )
    del fields["exclusiveGroup"]
    if fields["appliesToProducts"] is None:
        del fields["appliesToProducts"]
    return AddOnOption.model_validate(fields)


def test_a_product_gets_the_union_of_its_scoped_and_family_wide_add_ons() -> None:
    options = [
        unscoped_option("first"),
        unscoped_option(
            "family-wide",
            appliesToProducts=None,
            status="disabled",
            productId=None,
            variantId=None,
        ),
        unscoped_option("second", appliesToProducts=["prod_other", C_CLASS_ID]),
        unscoped_option("elsewhere", appliesToProducts=["prod_other"]),
        unscoped_option("other-family", appliesToFamilies=["starlights"]),
    ]

    assert [
        option.id
        for option in add_ons_for_product(options, C_CLASS_ID, "ambient-lighting")
    ] == ["first", "family-wide", "second"]


def test_active_add_on_without_products_is_rejected() -> None:
    fields = scoped_option()
    del fields["appliesToProducts"]

    with pytest.raises(ValidationError, match="appliesToProducts"):
        AddOnOption.model_validate(fields)


def write_add_ons(
    monkeypatch, tmp_path: Path, options: list[dict[str, object]]
) -> None:
    config_path = tmp_path / "add-ons.json"
    config_path.write_text(json.dumps(options), encoding="utf-8")
    monkeypatch.setattr(addons, "ADD_ONS_PATH", config_path)
    load_add_ons.cache_clear()


def real_option(**overrides: object) -> dict[str, object]:
    """The real Caliper Decals definition, with overrides."""
    raw = json.loads(addons.ADD_ONS_PATH.read_text(encoding="utf-8"))
    return {**next(o for o in raw if o["id"] == "caliper-decals"), **overrides}


@pytest.mark.parametrize(
    "overrides",
    [
        {"appliesToProducts": ["prod_does_not_exist"]},
        # An add-on product as a base.
        {"appliesToProducts": ["prod_01KCFR1PBNK4HHMX64NN0BPCCK"]},
        # The calipers listing is rims-calipers, not ambient-lighting.
        {"appliesToFamilies": ["ambient-lighting"]},
    ],
    ids=["unknown-base", "add-on-as-base", "base-outside-families"],
)
def test_load_add_ons_cross_checks_scoped_bases_against_the_catalog(
    monkeypatch, tmp_path: Path, overrides: dict[str, object]
) -> None:
    write_add_ons(monkeypatch, tmp_path, [real_option(**overrides)])
    try:
        with pytest.raises(AddOnConfigurationError):
            load_add_ons()
    finally:
        load_add_ons.cache_clear()


def test_load_add_ons_accepts_a_valid_scoped_base(monkeypatch, tmp_path: Path) -> None:
    write_add_ons(monkeypatch, tmp_path, [real_option()])
    try:
        assert [option.id for option in load_add_ons()] == ["caliper-decals"]
    finally:
        load_add_ons.cache_clear()


def test_load_add_ons_fails_closed_when_the_catalog_is_unavailable(monkeypatch) -> None:
    def broken() -> None:
        raise CatalogConfigurationError("unavailable")

    monkeypatch.setattr(addons, "load_catalog", broken)
    load_add_ons.cache_clear()
    try:
        with pytest.raises(AddOnConfigurationError):
            load_add_ons()
    finally:
        load_add_ons.cache_clear()
