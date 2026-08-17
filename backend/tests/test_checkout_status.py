from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.orders import attach_stripe_session, create_pending_order, process_stripe_event


client = TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_checkout_status_requires_server_configuration(tmp_path: Path) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key=None,
        orders_database_path=tmp_path / "orders.db",
    )

    response = client.get("/api/checkout/session/cs_test_direct")

    assert response.status_code == 503


def test_checkout_status_rejects_invalid_session_id_without_provider_call(
    monkeypatch,
    tmp_path: Path,
) -> None:
    def unexpected_retrieve(*_: object, **__: object) -> None:
        raise AssertionError("Stripe must not be called for an invalid session ID")

    monkeypatch.setattr("app.main.stripe.checkout.Session.retrieve", unexpected_retrieve)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        orders_database_path=tmp_path / "orders.db",
    )

    response = client.get("/api/checkout/session/not-a-session")

    assert response.status_code == 400


@pytest.mark.parametrize(
    ("payment_status", "expected_status"),
    [("unpaid", "pending"), ("paid", "paid")],
)
def test_checkout_status_is_verified_with_stripe(
    monkeypatch,
    tmp_path: Path,
    payment_status: str,
    expected_status: str,
) -> None:
    database_path = tmp_path / "orders.db"
    create_pending_order(
        database_path,
        order_reference="asc_verified_order",
        cart_reference="cart_test",
        amount_total=4999,
    )
    assert attach_stripe_session(
        database_path,
        order_reference="asc_verified_order",
        stripe_session_id="cs_test_verified",
    )

    def fake_retrieve(session_id: str, **_: object) -> SimpleNamespace:
        assert session_id == "cs_test_verified"
        return SimpleNamespace(
            id="cs_test_verified",
            status="complete",
            payment_status=payment_status,
        )

    monkeypatch.setattr("app.main.stripe.checkout.Session.retrieve", fake_retrieve)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        orders_database_path=database_path,
    )

    response = client.get("/api/checkout/session/cs_test_verified")

    assert response.status_code == 200
    assert response.json() == {
        "orderReference": "asc_verified_order",
        "status": expected_status,
    }


def test_checkout_status_uses_webhook_failure_for_completed_unpaid_session(
    monkeypatch,
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "orders.db"
    create_pending_order(
        database_path,
        order_reference="asc_failed_order",
        cart_reference="cart_failed",
        amount_total=4999,
    )
    assert attach_stripe_session(
        database_path,
        order_reference="asc_failed_order",
        stripe_session_id="cs_test_failed",
    )
    process_stripe_event(
        database_path,
        event_id="evt_failed_order",
        event_type="checkout.session.async_payment_failed",
        stripe_session_id="cs_test_failed",
        order_reference="asc_failed_order",
        new_status="unpaid",
        amount_total=4999,
        currency="gbp",
        mode="payment",
    )

    monkeypatch.setattr(
        "app.main.stripe.checkout.Session.retrieve",
        lambda *_args, **_kwargs: SimpleNamespace(
            id="cs_test_failed",
            status="complete",
            payment_status="unpaid",
        ),
    )
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        orders_database_path=database_path,
    )

    response = client.get("/api/checkout/session/cs_test_failed")

    assert response.status_code == 200
    assert response.json() == {
        "orderReference": "asc_failed_order",
        "status": "unpaid",
    }
