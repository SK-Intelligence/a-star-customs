from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class ContactRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=254)
    phone: str | None = Field(default=None, max_length=40)
    message: str = Field(min_length=10, max_length=5000)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if not EMAIL_PATTERN.fullmatch(value):
            raise ValueError("Enter a valid email address.")
        return value


class CheckoutLine(BaseModel):
    model_config = ConfigDict(extra="forbid")

    productId: str = Field(min_length=1, max_length=100)
    variantId: str = Field(min_length=1, max_length=100)
    quantity: int = Field(ge=1, le=10, strict=True)
    buildId: str | None = Field(default=None, min_length=1, max_length=100)
    lineType: Literal["standalone", "base", "addon"] = "standalone"


class CheckoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CheckoutLine] = Field(min_length=1, max_length=50)
    email: str | None = Field(default=None, max_length=254)
    discountCode: str | None = Field(default=None, max_length=40)

    @field_validator("email", "discountCode", mode="before")
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is not None and not EMAIL_PATTERN.fullmatch(value):
            raise ValueError("Enter a valid email address.")
        return value

    @model_validator(mode="after")
    def discount_needs_email(self) -> "CheckoutRequest":
        # First-order codes are checked against the buyer's email, so one is required.
        if self.discountCode is not None and self.email is None:
            raise ValueError("An email address is required with a discount code.")
        return self

    @model_validator(mode="after")
    def reject_duplicate_lines(self) -> "CheckoutRequest":
        line_ids = [
            (item.productId, item.variantId)
            for item in self.items
            if item.buildId is None and item.lineType == "standalone"
        ]
        if len(set(line_ids)) != len(line_ids):
            raise ValueError("Duplicate cart lines are not allowed.")
        return self


class CheckoutResponse(BaseModel):
    url: str
    orderReference: str


class CheckoutStatusResponse(BaseModel):
    orderReference: str
    status: Literal["pending", "paid", "unpaid", "expired"]


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=100)
    rating: int = Field(ge=1, le=5, strict=True)
    comment: str = Field(min_length=5, max_length=2000)


class ReviewResponse(BaseModel):
    name: str
    rating: int
    comment: str
    createdAt: str


class ReviewListResponse(BaseModel):
    reviews: list[ReviewResponse]
