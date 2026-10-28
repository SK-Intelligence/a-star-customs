"""First-order discount: eligibility at checkout and amount checks on the webhook."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from types import SimpleNamespace

import pytest
import stripe
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.orders import (
    add_known_customers,
    attach_stripe_session,
    create_pending_order,
    has_previous_purchase,
    normalize_email,
    process_stripe_event,
    StripeEventOrderMismatchError,
)


client = TestClient(app)

CARPLAY = {
    "productId": "prod_01KFVHY3MK70RA36DKE21WFPNM",
    "variantId": "variant_01KFVHY3PGHQ09EW3812HRKBBZ",
    "quantity": 1,
}  # £49.99


def teardown_function() -> None:
    app.dependency_overrides.clear()


def use_settings(database_path: Path, **overrides: object) -> None:
    values: dict[str, object] = {
        "stripe_secret_key": "sk_test_placeholder",
        "stripe_payment_method_configuration_id": "pmc_test_checkout",
        "stripe_webhook_secret": "whsec_test_checkout",
        "stripe_first_order_coupon_id": "coupon_first_order",
        "orders_database_path": database_path,
        **overrides,
    }
    app.dependency_overrides[get_settings] = lambda: Settings(**values)


@pytest.fixture
def captured(monkeypatch) -> dict[str, object]:
    calls: dict[str, object] = {}

    def fake_create(**kwargs: object) -> SimpleNamespace:
        calls.update(kwargs)
        return SimpleNamespace(
            id="cs_test_discount", url="https://checkout.stripe.com/c/pay/d"
        )

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fake_create)
    return calls


def paid_order(database_path: Path, email: str) -> None:
    create_pending_order(
        database_path,
        order_reference="asc_old",
        cart_reference="cart_old",
        amount_total=4999,
    )
    process_stripe_event(
        database_path,
        event_id="evt_old",
        event_type="checkout.session.completed",
        stripe_session_id="cs_old",
        order_reference="asc_old",
        new_status="paid",
        amount_total=4999,
        currency="gbp",
        mode="payment",
        customer_email=email,
    )


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("  Jane.Doe@Example.com ", "jane.doe@example.com"),
        ("jane+promo@example.com", "jane@example.com"),
        ("J.o.h.n+x@googlemail.com", "john@gmail.com"),
        ("john@gmail.com", "john@gmail.com"),
    ],
)
def test_normalize_email(raw: str, expected: str) -> None:
    assert normalize_email(raw) == expected


def test_new_customer_gets_the_coupon_and_a_locked_email(
    captured, tmp_path: Path
) -> None:
    database_path = tmp_path / "orders.db"
    use_settings(database_path)

    response = client.post(
        "/api/checkout/session",
        json={
            "items": [CARPLAY],
            "email": "New.Buyer@Gmail.com",
            "discountCode": " welcome10 ",
        },
    )

    assert response.status_code == 200
    assert captured["discounts"] == [{"coupon": "coupon_first_order"}]
    assert captured["customer_email"] == "New.Buyer@Gmail.com"
    assert captured["metadata"]["discount_percent"] == "10"  # type: ignore[index]
    with sqlite3.connect(database_path) as connection:
        row = connection.execute(
            "SELECT amount_total, customer_email, discount_percent FROM orders"
        ).fetchone()
    assert row == (4999, "newbuyer@gmail.com", 10)


def test_checkout_without_a_code_is_unchanged(captured, tmp_path: Path) -> None:
    use_settings(tmp_path / "orders.db")

    response = client.post("/api/checkout/session", json={"items": [CARPLAY]})

    assert response.status_code == 200
    assert "discounts" not in captured
    assert "customer_email" not in captured
    assert captured["metadata"]["discount_percent"] == "0"  # type: ignore[index]


@pytest.mark.parametrize(
    "past_email", ["newbuyer@gmail.com", "new.buyer+old@googlemail.com"]
)
def test_returning_customer_is_refused(
    captured, tmp_path: Path, past_email: str
) -> None:
    database_path = tmp_path / "orders.db"
    paid_order(database_path, past_email)
    use_settings(database_path)

    response = client.post(
        "/api/checkout/session",
        json={
            "items": [CARPLAY],
            "email": "New.Buyer@gmail.com",
            "discountCode": "WELCOME10",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "DISCOUNT_NOT_ELIGIBLE"
    assert captured == {}


def test_imported_past_customer_is_refused(captured, tmp_path: Path) -> None:
    database_path = tmp_path / "orders.db"
    assert add_known_customers(database_path, ["Old@Example.com", "not-an-email"]) == 1
    use_settings(database_path)

    response = client.post(
        "/api/checkout/session",
        json={
            "items": [CARPLAY],
            "email": "old@example.com",
            "discountCode": "WELCOME10",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "DISCOUNT_NOT_ELIGIBLE"


def test_unpaid_orders_do_not_count_as_purchases(tmp_path: Path) -> None:
    database_path = tmp_path / "orders.db"
    create_pending_order(
        database_path,
        order_reference="asc_pending",
        cart_reference="cart",
        amount_total=4999,
        customer_email="buyer@example.com",
        discount_percent=10,
    )
    assert not has_previous_purchase(database_path, "buyer@example.com")


@pytest.mark.parametrize(
    "overrides",
    [{}, {"stripe_first_order_coupon_id": None}],
    ids=["wrong code", "coupon not configured"],
)
def test_invalid_code_is_refused_without_echoing_it(
    captured, tmp_path: Path, overrides: dict[str, object]
) -> None:
    use_settings(tmp_path / "orders.db", **overrides)
    code = "WELCOME10" if overrides else "FREESTUFF"

    response = client.post(
        "/api/checkout/session",
        json={"items": [CARPLAY], "email": "buyer@example.com", "discountCode": code},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "DISCOUNT_INVALID"
    assert code not in response.text
    assert captured == {}


def test_code_requires_an_email(captured, tmp_path: Path) -> None:
    use_settings(tmp_path / "orders.db")

    response = client.post(
        "/api/checkout/session", json={"items": [CARPLAY], "discountCode": "WELCOME10"}
    )

    assert response.status_code == 422
    assert captured == {}


def discounted_order(database_path: Path, amount_total: int = 4999) -> None:
    create_pending_order(
        database_path,
        order_reference="asc_discount",
        cart_reference="cart",
        amount_total=amount_total,
        customer_email="buyer@example.com",
        discount_percent=10,
    )


def settle(database_path: Path, **session: object) -> bool:
    values: dict[str, object] = {
        "event_id": "evt_discount",
        "event_type": "checkout.session.completed",
        "stripe_session_id": "cs_discount",
        "order_reference": "asc_discount",
        "new_status": "paid",
        "currency": "gbp",
        "mode": "payment",
        "customer_email": "Buyer@Example.com",
        **session,
    }
    return process_stripe_event(database_path, **values)  # type: ignore[arg-type]


def order_row(database_path: Path) -> tuple[object, ...]:
    with sqlite3.connect(database_path) as connection:
        return connection.execute(
            "SELECT status, customer_email FROM orders WHERE order_reference = 'asc_discount'"
        ).fetchone()


def test_discounted_payment_is_accepted(tmp_path: Path) -> None:
    database_path = tmp_path / "orders.db"
    discounted_order(database_path)  # £49.99, 10% = 499.9p, Stripe rounds to 500p

    settle(database_path, amount_subtotal=4999, amount_discount=500, amount_total=4499)

    assert order_row(database_path) == ("paid", "buyer@example.com")
    assert has_previous_purchase(database_path, "buyer@example.com")


@pytest.mark.parametrize(
    "amounts",
    [
        {"amount_subtotal": 4999, "amount_discount": 1000, "amount_total": 3999},
        {"amount_subtotal": 3999, "amount_discount": 400, "amount_total": 3599},
        {"amount_subtotal": 4999, "amount_discount": 500, "amount_total": 4000},
        {"amount_total": 4499},
    ],
    ids=[
        "discount too large",
        "wrong subtotal",
        "total doesn't add up",
        "missing details",
    ],
)
def test_discounted_payment_with_wrong_amounts_is_rejected(
    tmp_path: Path, amounts: dict[str, int]
) -> None:
    database_path = tmp_path / "orders.db"
    discounted_order(database_path)

    with pytest.raises(StripeEventOrderMismatchError):
        settle(database_path, **amounts)


def test_discounted_payment_from_another_email_is_rejected(tmp_path: Path) -> None:
    database_path = tmp_path / "orders.db"
    discounted_order(database_path)

    with pytest.raises(StripeEventOrderMismatchError):
        settle(
            database_path,
            amount_subtotal=4999,
            amount_discount=500,
            amount_total=4499,
            customer_email="someone-else@example.com",
        )


def test_undiscounted_order_cannot_be_paid_at_a_discount(tmp_path: Path) -> None:
    database_path = tmp_path / "orders.db"
    create_pending_order(
        database_path,
        order_reference="asc_discount",
        cart_reference="cart",
        amount_total=4999,
    )

    with pytest.raises(StripeEventOrderMismatchError):
        settle(
            database_path, amount_subtotal=4999, amount_discount=500, amount_total=4499
        )


def test_webhook_saves_the_buyer_email_on_paid_orders(
    monkeypatch, tmp_path: Path
) -> None:
    database_path = tmp_path / "orders.db"
    create_pending_order(
        database_path,
        order_reference="asc_discount",
        cart_reference="cart",
        amount_total=4999,
    )

    def fake_construct_event(**_: object) -> dict[str, object]:
        return {
            "id": "evt_email",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_discount",
                    "payment_status": "paid",
                    "amount_total": 4999,
                    "amount_subtotal": 4999,
                    "total_details": {"amount_discount": 0},
                    "currency": "gbp",
                    "mode": "payment",
                    "customer_details": {"email": "Buyer+shop@Example.com"},
                    "metadata": {"order_reference": "asc_discount"},
                }
            },
        }

    monkeypatch.setattr("app.main.stripe.Webhook.construct_event", fake_construct_event)
    use_settings(database_path)

    response = client.post(
        "/api/stripe/webhook", content=b"{}", headers={"stripe-signature": "valid"}
    )

    assert response.status_code == 200
    assert order_row(database_path) == ("paid", "buyer@example.com")


def open_discounted_checkout(database_path: Path) -> None:
    create_pending_order(
        database_path,
        order_reference="asc_first_tab",
        cart_reference="cart",
        amount_total=4999,
        customer_email="buyer@example.com",
        discount_percent=10,
    )
    attach_stripe_session(
        database_path, order_reference="asc_first_tab", stripe_session_id="cs_first_tab"
    )


DISCOUNTED_CART = {
    "items": [CARPLAY],
    "email": "buyer@example.com",
    "discountCode": "WELCOME10",
}


def test_a_new_discounted_checkout_closes_the_earlier_one(
    captured, monkeypatch, tmp_path: Path
) -> None:
    database_path = tmp_path / "orders.db"
    open_discounted_checkout(database_path)
    expired: list[str] = []
    monkeypatch.setattr(
        "app.main.stripe.checkout.Session.expire",
        lambda session_id, **_: expired.append(session_id),
    )
    use_settings(database_path)

    response = client.post("/api/checkout/session", json=DISCOUNTED_CART)

    assert response.status_code == 200
    assert expired == ["cs_first_tab"]
    assert captured["discounts"] == [{"coupon": "coupon_first_order"}]


@pytest.mark.parametrize(
    ("earlier_status", "expected_status"), [("complete", 409), ("expired", 200)]
)
def test_an_earlier_checkout_that_cannot_be_closed(
    captured, monkeypatch, tmp_path: Path, earlier_status: str, expected_status: int
) -> None:
    database_path = tmp_path / "orders.db"
    open_discounted_checkout(database_path)

    def not_open(session_id: str, **_: object) -> None:
        raise stripe.InvalidRequestError("Session is not open", param=None)

    monkeypatch.setattr("app.main.stripe.checkout.Session.expire", not_open)
    monkeypatch.setattr(
        "app.main.stripe.checkout.Session.retrieve",
        lambda session_id, **_: {"id": session_id, "status": earlier_status},
    )
    use_settings(database_path)

    response = client.post("/api/checkout/session", json=DISCOUNTED_CART)

    assert response.status_code == expected_status
    if expected_status == 409:
        assert response.json()["detail"]["code"] == "DISCOUNT_NOT_ELIGIBLE"
        assert captured == {}
