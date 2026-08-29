from __future__ import annotations

import asyncio
import hashlib
import sqlite3
from typing import Any, NoReturn
from uuid import uuid4

import httpx
import stripe
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware

from app.addons import AddOnConfigurationError, AddOnOption, load_add_ons
from app.catalog import CatalogConfigurationError, CatalogProduct, load_catalog
from app.config import Settings, get_settings
from app.models import (
    CheckoutLine,
    CheckoutRequest,
    CheckoutResponse,
    CheckoutStatusResponse,
    ContactRequest,
    ReviewListResponse,
    ReviewRequest,
)
from app.orders import (
    OrderStatus,
    StripeEventOrderMismatchError,
    StripeEventOrderNotFoundError,
    attach_stripe_session,
    create_pending_order,
    get_order_by_session_id,
    process_stripe_event,
)
from app.reviews import list_approved_reviews, submit_review


WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit"
BUILD_INVALID_DETAIL = {
    "code": "BUILD_INVALID",
    "message": "The configured product build is invalid.",
}

app = FastAPI(title="A Star Customs API", version="1.0.0")

_startup_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_startup_settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Stripe-Signature"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def _validate_product(product_id: str) -> None:
    try:
        product_exists = product_id in load_catalog()
    except CatalogConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The product catalog is temporarily unavailable.",
        ) from exc
    if not product_exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")


@app.get("/api/reviews/{product_id}", response_model=ReviewListResponse)
async def get_product_reviews(
    product_id: str,
    settings: Settings = Depends(get_settings),
) -> ReviewListResponse:
    _validate_product(product_id)
    try:
        reviews = await asyncio.to_thread(
            list_approved_reviews,
            settings.reviews_database_path,
            product_id,
        )
    except (OSError, sqlite3.Error) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Reviews are temporarily unavailable.",
        ) from exc
    return ReviewListResponse(reviews=reviews)


@app.post("/api/reviews/{product_id}", status_code=status.HTTP_202_ACCEPTED)
async def create_product_review(
    product_id: str,
    review: ReviewRequest,
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    _validate_product(product_id)
    try:
        await asyncio.to_thread(
            submit_review,
            settings.reviews_database_path,
            product_id,
            review,
        )
    except (OSError, sqlite3.Error) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Review submission is temporarily unavailable.",
        ) from exc
    return {"status": "submitted"}


@app.post("/api/contact", status_code=status.HTTP_202_ACCEPTED)
async def contact(
    form: ContactRequest,
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    if not settings.web3forms_access_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Contact form delivery is not configured.",
        )

    payload = {
        "access_key": settings.web3forms_access_key,
        "subject": "New A Star Customs website enquiry",
        "from_name": "A Star Customs Website",
        **form.model_dump(exclude_none=True),
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(WEB3FORMS_ENDPOINT, json=payload)
            response.raise_for_status()
            provider_result = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Contact form delivery failed. Please try again later.",
        ) from exc

    if not isinstance(provider_result, dict) or not provider_result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Contact form delivery failed. Please try again later.",
        )
    return {"status": "accepted"}


def _raise_build_invalid() -> NoReturn:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=BUILD_INVALID_DETAIL,
    )


def _validate_builds(
    cart: CheckoutRequest,
    add_ons: list[AddOnOption],
    catalog: dict[str, CatalogProduct],
) -> None:
    active_add_ons = {
        (option.productId, option.variantId): option
        for option in add_ons
        if option.status == "active"
    }
    builds: dict[str, list[CheckoutLine]] = {}
    for item in cart.items:
        if item.lineType == "standalone":
            product = catalog.get(item.productId)
            if (
                item.buildId is not None
                or (item.productId, item.variantId) in active_add_ons
                or (product is not None and product.kind == "addon")
            ):
                _raise_build_invalid()
            continue
        if item.buildId is None:
            _raise_build_invalid()
        builds.setdefault(item.buildId, []).append(item)

    for lines in builds.values():
        base_lines = [line for line in lines if line.lineType == "base"]
        add_on_lines = [line for line in lines if line.lineType == "addon"]
        if len(base_lines) != 1:
            _raise_build_invalid()
        base = base_lines[0]
        base_product = catalog.get(base.productId)
        if base_product is None or base_product.kind != "main":
            _raise_build_invalid()
        add_on_ids = [
            (add_on_line.productId, add_on_line.variantId)
            for add_on_line in add_on_lines
        ]
        if len(set(add_on_ids)) != len(add_on_ids):
            _raise_build_invalid()
        for add_on_line in add_on_lines:
            option = active_add_ons.get((add_on_line.productId, add_on_line.variantId))
            if (
                option is None
                or base_product.family not in option.appliesToFamilies
                or add_on_line.quantity != base.quantity
            ):
                _raise_build_invalid()


@app.post("/api/checkout/session", response_model=CheckoutResponse)
async def create_checkout_session(
    cart: CheckoutRequest,
    settings: Settings = Depends(get_settings),
) -> CheckoutResponse:
    try:
        catalog = load_catalog()
    except CatalogConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The product catalog is temporarily unavailable.",
        ) from exc

    try:
        add_ons = load_add_ons()
    except AddOnConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The add-on configuration is temporarily unavailable.",
        ) from exc
    _validate_builds(cart, add_ons, catalog)

    stripe_line_items: list[dict[str, Any]] = []
    cart_identity_parts: list[str] = []
    amount_total = 0
    for item in cart.items:
        product = catalog.get(item.productId)
        if product is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product not found: {item.productId}.",
            )

        variant = next((entry for entry in product.variants if entry.id == item.variantId), None)
        if variant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Variant not found: {item.variantId}.",
            )
        if (
            not product.purchasable
            or not product.available
            or not variant.available
            or variant.price <= 0
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Item is not available for online purchase: {item.variantId}.",
            )

        line_metadata = {
            "product_id": product.id,
            "variant_id": variant.id,
            "line_type": item.lineType,
        }
        if item.buildId is not None:
            line_metadata["build_id"] = item.buildId
        stripe_line_items.append(
            {
                "price_data": {
                    "currency": "gbp",
                    "unit_amount": variant.price,
                    "product_data": {
                        "name": product.title,
                        "description": variant.title,
                        "metadata": line_metadata,
                    },
                },
                "quantity": item.quantity,
            }
        )
        cart_identity_parts.append(
            f"{item.buildId or '-'}:{item.lineType}:{product.id}:{variant.id}:{item.quantity}"
        )
        amount_total += variant.price * item.quantity

    if (
        not settings.stripe_secret_key
        or not settings.stripe_payment_method_configuration_id
        or not settings.stripe_webhook_secret
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "CHECKOUT_NOT_CONFIGURED",
                "message": "Checkout is not configured.",
            },
        )

    order_reference = f"asc_{uuid4().hex}"
    cart_reference = hashlib.sha256("|".join(cart_identity_parts).encode()).hexdigest()[:20]
    try:
        await asyncio.to_thread(
            create_pending_order,
            settings.orders_database_path,
            order_reference=order_reference,
            cart_reference=cart_reference,
            amount_total=amount_total,
        )
    except (OSError, sqlite3.Error) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The order could not be initialized. Please try again later.",
        ) from exc

    try:
        session = await asyncio.to_thread(
            stripe.checkout.Session.create,
            api_key=settings.stripe_secret_key,
            idempotency_key=order_reference,
            mode="payment",
            payment_method_configuration=(
                settings.stripe_payment_method_configuration_id
            ),
            line_items=stripe_line_items,
            shipping_address_collection={"allowed_countries": ["GB"]},
            shipping_options=[
                {
                    "shipping_rate_data": {
                        "type": "fixed_amount",
                        "fixed_amount": {"amount": 0, "currency": "gbp"},
                        "display_name": "Free UK shipping",
                    }
                }
            ],
            success_url=settings.checkout_success_url,
            cancel_url=settings.checkout_cancel_url,
            metadata={
                "order_reference": order_reference,
                "cart_reference": cart_reference,
                "line_count": str(len(stripe_line_items)),
                "build_count": str(
                    len({item.buildId for item in cart.items if item.buildId is not None})
                ),
            },
        )
    except stripe.StripeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Checkout could not be started. Please try again later.",
        ) from exc

    session_url = getattr(session, "url", None)
    session_id = getattr(session, "id", None)
    if not session_url or not session_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Checkout provider returned an invalid session.",
        )
    try:
        attached = await asyncio.to_thread(
            attach_stripe_session,
            settings.orders_database_path,
            order_reference=order_reference,
            stripe_session_id=session_id,
        )
    except (OSError, sqlite3.Error) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The order could not be recorded. Please contact support before retrying.",
        ) from exc
    if not attached:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The checkout session could not be attached to its order.",
        )
    return CheckoutResponse(url=session_url, orderReference=order_reference)


def _stripe_value(resource: Any, key: str) -> Any:
    if isinstance(resource, dict):
        return resource.get(key)
    return getattr(resource, key, None)


def _verified_checkout_status(session: Any, stored_status: OrderStatus) -> OrderStatus:
    session_status = _stripe_value(session, "status")
    payment_status = _stripe_value(session, "payment_status")
    if payment_status in {"paid", "no_payment_required"}:
        return "paid"
    if stored_status in {"paid", "unpaid", "expired"}:
        return stored_status
    if session_status == "expired":
        return "expired"
    return "pending"


@app.get(
    "/api/checkout/session/{session_id}",
    response_model=CheckoutStatusResponse,
)
async def get_checkout_session_status(
    session_id: str,
    settings: Settings = Depends(get_settings),
) -> CheckoutStatusResponse:
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Checkout status verification is not configured.",
        )
    if not session_id.startswith("cs_") or len(session_id) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid checkout session ID.",
        )
    try:
        session = await asyncio.to_thread(
            stripe.checkout.Session.retrieve,
            session_id,
            api_key=settings.stripe_secret_key,
        )
    except stripe.InvalidRequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checkout session not found.",
        ) from exc
    except stripe.StripeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Checkout status could not be verified.",
        ) from exc

    verified_session_id = _stripe_value(session, "id")
    if not isinstance(verified_session_id, str) or not verified_session_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Checkout provider returned an invalid session.",
        )
    try:
        order = await asyncio.to_thread(
            get_order_by_session_id,
            settings.orders_database_path,
            verified_session_id,
        )
    except (OSError, sqlite3.Error) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Order status is temporarily unavailable.",
        ) from exc
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    return CheckoutStatusResponse(
        orderReference=order.order_reference,
        status=_verified_checkout_status(session, order.status),
    )


@app.post("/api/stripe/webhook")
async def stripe_webhook(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> dict[str, bool]:
    if not settings.stripe_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe webhook verification is not configured.",
        )

    signature = request.headers.get("stripe-signature")
    if not signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Stripe signature.",
        )

    payload = await request.body()
    try:
        event: Any = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=signature,
            secret=settings.stripe_webhook_secret,
        )
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe webhook signature.",
        ) from exc

    event_id = _stripe_value(event, "id")
    if not isinstance(event_id, str) or not event_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stripe event is missing an ID.",
        )

    event_type = _stripe_value(event, "type")
    if not isinstance(event_type, str) or not event_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stripe event is missing a type.",
        )

    event_data = _stripe_value(event, "data")
    session = _stripe_value(event_data, "object") if event_data is not None else None
    stripe_session_id = _stripe_value(session, "id")
    session_metadata = _stripe_value(session, "metadata")
    order_reference = _stripe_value(session_metadata, "order_reference")
    if not isinstance(order_reference, str):
        order_reference = None
    status_by_event: dict[str, OrderStatus] = {
        "checkout.session.async_payment_succeeded": "paid",
        "checkout.session.async_payment_failed": "unpaid",
        "checkout.session.expired": "expired",
    }
    new_status = status_by_event.get(event_type)
    if event_type == "checkout.session.completed":
        payment_status = _stripe_value(session, "payment_status")
        new_status = "paid" if payment_status in {"paid", "no_payment_required"} else "pending"
    if not isinstance(stripe_session_id, str):
        stripe_session_id = None
    if new_status is not None and stripe_session_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stripe checkout event is missing a session ID.",
        )

    amount_total = _stripe_value(session, "amount_total")
    currency = _stripe_value(session, "currency")
    mode = _stripe_value(session, "mode")
    if new_status is not None and (
        not isinstance(amount_total, int)
        or not isinstance(currency, str)
        or not isinstance(mode, str)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stripe checkout event is missing trusted payment details.",
        )

    try:
        duplicate = await asyncio.to_thread(
            process_stripe_event,
            settings.orders_database_path,
            event_id=event_id,
            event_type=event_type,
            stripe_session_id=stripe_session_id,
            order_reference=order_reference,
            new_status=new_status,
            amount_total=amount_total if isinstance(amount_total, int) else None,
            currency=currency if isinstance(currency, str) else None,
            mode=mode if isinstance(mode, str) else None,
        )
    except StripeEventOrderNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe event is awaiting order reconciliation.",
        ) from exc
    except StripeEventOrderMismatchError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe event did not match the trusted order.",
        ) from exc
    except (OSError, sqlite3.Error) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe event could not be recorded.",
        ) from exc

    return {"received": True, "duplicate": duplicate}
