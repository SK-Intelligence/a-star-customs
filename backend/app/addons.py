from __future__ import annotations

import json
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator


ADD_ONS_PATH = Path(__file__).with_name("add-ons.json")

ProductFamily = Literal[
    "ambient-lighting",
    "starlights",
    "screen-upgrades",
    "dashcams",
    "steering-wheels",
    "rims-calipers",
    "general",
]


class AddOnOption(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    id: str = Field(min_length=1)
    status: Literal["active", "disabled"]
    label: str = Field(min_length=1)
    description: str = Field(min_length=1)
    appliesToFamilies: list[ProductFamily] = Field(min_length=1)
    # When set, the add-on is offered only on these base products. A base product
    # offers the union of the add-ons scoped to it and any family-wide (unscoped)
    # add-on of its family; see add_ons_for_product.
    appliesToProducts: list[str] | None = None
    # At most one add-on per exclusive group may be attached to a single build.
    exclusiveGroup: str | None = Field(default=None, pattern=r"^[a-z0-9][a-z0-9-]*$")
    productId: str | None
    variantId: str | None

    @model_validator(mode="after")
    def validate_availability(self) -> "AddOnOption":
        for optional_field in ("appliesToProducts", "exclusiveGroup"):
            if (
                optional_field in self.model_fields_set
                and getattr(self, optional_field) is None
            ):
                raise ValueError(f"{optional_field} must be omitted rather than null")
        if self.appliesToProducts is not None and (
            not self.appliesToProducts
            or any(not product_id.strip() for product_id in self.appliesToProducts)
            or len(set(self.appliesToProducts)) != len(self.appliesToProducts)
        ):
            raise ValueError(
                "product-scoped add-ons require unique, non-blank product IDs"
            )
        if self.status == "active" and (not self.productId or not self.variantId):
            raise ValueError("active add-ons require product and variant IDs")
        if self.status == "disabled" and (
            self.productId is not None or self.variantId is not None
        ):
            raise ValueError("disabled add-ons cannot reference catalog IDs")
        return self


def add_ons_for_product(
    add_ons: list[AddOnOption],
    product_id: str,
    family: ProductFamily,
) -> list[AddOnOption]:
    """Every add-on of the family that is scoped to this product or family-wide.

    Mirrors getProductAddOnOptions in frontend/src/data/catalog.ts (which also offers
    nothing on add-on products; _validate_builds rejects those as bases)."""
    return [
        option
        for option in add_ons
        if family in option.appliesToFamilies
        and (option.appliesToProducts is None or product_id in option.appliesToProducts)
    ]


class AddOnConfigurationError(RuntimeError):
    """Raised when the trusted server-side add-on configuration cannot be loaded."""


@lru_cache
def load_add_ons() -> list[AddOnOption]:
    try:
        raw_add_ons = json.loads(ADD_ONS_PATH.read_text(encoding="utf-8"))
        if not isinstance(raw_add_ons, list):
            raise ValueError("add-on configuration root must be a list")
        add_ons = [AddOnOption.model_validate(item) for item in raw_add_ons]
    except (OSError, json.JSONDecodeError, ValidationError, ValueError) as exc:
        raise AddOnConfigurationError(
            "The add-on configuration is unavailable."
        ) from exc

    option_ids = [option.id for option in add_ons]
    catalog_ids = [
        (option.productId, option.variantId)
        for option in add_ons
        if option.status == "active"
    ]
    if len(set(option_ids)) != len(option_ids):
        raise AddOnConfigurationError(
            "The add-on configuration contains duplicate IDs."
        )
    if len(set(catalog_ids)) != len(catalog_ids):
        raise AddOnConfigurationError(
            "The add-on configuration contains duplicate catalog entries."
        )
    group_sizes = Counter(
        option.exclusiveGroup for option in add_ons if option.exclusiveGroup is not None
    )
    if any(size < 2 for size in group_sizes.values()):
        raise AddOnConfigurationError(
            "Every add-on exclusive group needs at least two members."
        )
    return add_ons
