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
from app.catalog import load_catalog


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


def test_disabled_product_scoped_add_ons_do_not_fall_back_to_family_add_ons() -> None:
    disabled_add_ons = [
        option.model_copy(update={"status": "disabled", "productId": None, "variantId": None})
        if option.appliesToProducts is not None
        else option
        for option in load_add_ons()
    ]
    base = load_catalog()[C_CLASS_ID]

    options = add_ons_for_product(disabled_add_ons, base.id, base.family)

    assert len(options) == 6
    assert all(option.appliesToProducts == [C_CLASS_ID] for option in options)
    assert all(option.status == "disabled" for option in options)
