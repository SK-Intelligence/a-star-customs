from __future__ import annotations

import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.orders import attach_stripe_session, create_pending_order, process_stripe_event


client = TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_webhook_durably_updates_order_and_deduplicates(
    monkeypatch,
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "orders.db"
    create_pending_order(
        database_path,
        order_reference="asc_test_order",
        cart_reference="cart_test",
        amount_total=4999,
    )

    def fake_construct_event(**_: object) -> dict[str, object]:
        return {
            "id": "evt_test_123",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_paid",
                    "payment_status": "paid",
                    "metadata": {"order_reference": "asc_test_order"},
                }
            },
        }

    monkeypatch.setattr("app.main.stripe.Webhook.construct_event", fake_construct_event)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_webhook_secret="whsec_test",
        orders_database_path=database_path,
    )

    first = client.post(
        "/api/stripe/webhook",
        content=b'{"id":"evt_test_123"}',
        headers={"stripe-signature": "valid-test-signature"},
    )
    second = client.post(
        "/api/stripe/webhook",
        content=b'{"id":"evt_test_123"}',
        headers={"stripe-signature": "valid-test-signature"},
    )

    assert first.status_code == 200
    assert first.json() == {"received": True, "duplicate": False}
    assert second.status_code == 200
    assert second.json() == {"received": True, "duplicate": True}
    with sqlite3.connect(database_path) as connection:
        order_status = connection.execute(
            "SELECT stripe_session_id, status FROM orders WHERE order_reference = ?",
            ("asc_test_order",),
        ).fetchone()
        event_count = connection.execute("SELECT COUNT(*) FROM stripe_events").fetchone()
    assert order_status == ("cs_test_paid", "paid")
    assert event_count == (1,)

    assert attach_stripe_session(
        database_path,
        order_reference="asc_test_order",
        stripe_session_id="cs_test_paid",
    )

    process_stripe_event(
        database_path,
        event_id="evt_late_failure",
        event_type="checkout.session.async_payment_failed",
        stripe_session_id="cs_test_paid",
        order_reference="asc_test_order",
        new_status="unpaid",
    )
    with sqlite3.connect(database_path) as connection:
        final_status = connection.execute(
            "SELECT status FROM orders WHERE stripe_session_id = ?",
            ("cs_test_paid",),
        ).fetchone()
    assert final_status == ("paid",)
