from __future__ import annotations

import json
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
    productId: str | None
    variantId: str | None

    @model_validator(mode="after")
    def validate_availability(self) -> "AddOnOption":
        if self.status == "active" and (not self.productId or not self.variantId):
            raise ValueError("active add-ons require product and variant IDs")
        if self.status == "disabled" and (
            self.productId is not None or self.variantId is not None
        ):
            raise ValueError("disabled add-ons cannot reference catalog IDs")
        return self


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
        raise AddOnConfigurationError("The add-on configuration is unavailable.") from exc

    option_ids = [option.id for option in add_ons]
    catalog_ids = [
        (option.productId, option.variantId)
        for option in add_ons
        if option.status == "active"
    ]
    if len(set(option_ids)) != len(option_ids):
        raise AddOnConfigurationError("The add-on configuration contains duplicate IDs.")
    if len(set(catalog_ids)) != len(catalog_ids):
        raise AddOnConfigurationError(
            "The add-on configuration contains duplicate catalog entries."
        )
    return add_ons
