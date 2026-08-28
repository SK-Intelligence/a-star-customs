from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError


CATALOG_PATH = Path(__file__).with_name("catalog.json")


class CatalogVariant(BaseModel):
    model_config = ConfigDict(extra="ignore", strict=True)

    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    price: int = Field(ge=0)
    available: bool


class CatalogProduct(BaseModel):
    model_config = ConfigDict(extra="ignore", strict=True)

    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    collections: list[str] = Field(default_factory=list)
    kind: Literal["main", "addon", "upgrade"]
    family: Literal[
        "ambient-lighting",
        "starlights",
        "screen-upgrades",
        "dashcams",
        "steering-wheels",
        "rims-calipers",
        "general",
    ]
    purchasable: bool
    available: bool
    variants: list[CatalogVariant]


class CatalogConfigurationError(RuntimeError):
    """Raised when the trusted server-side catalog cannot be loaded."""


@lru_cache
def load_catalog() -> dict[str, CatalogProduct]:
    try:
        raw_catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        if not isinstance(raw_catalog, list):
            raise ValueError("catalog root must be a list")
        products = [CatalogProduct.model_validate(item) for item in raw_catalog]
    except (OSError, json.JSONDecodeError, ValidationError, ValueError) as exc:
        raise CatalogConfigurationError("The product catalog is unavailable.") from exc

    catalog = {product.id: product for product in products}
    if len(catalog) != len(products):
        raise CatalogConfigurationError("The product catalog contains duplicate product IDs.")
    return catalog
