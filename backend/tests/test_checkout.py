from __future__ import annotations

import sqlite3
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app


client = TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_checkout_uses_all_trusted_catalog_prices(monkeypatch, tmp_path: Path) -> None:
    captured: dict[str, object] = {}

    def fake_create(**kwargs: object) -> SimpleNamespace:
        captured.update(kwargs)
        return SimpleNamespace(
            id="cs_test_created",
            url="https://checkout.stripe.com/c/pay/test",
        )

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fake_create)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        orders_database_path=tmp_path / "orders.db",
    )

    response = client.post(
        "/api/checkout/session",
        json={
            "items": [
                {
                    "productId": "prod_01KFVHY3MK70RA36DKE21WFPNM",
                    "variantId": "variant_01KFVHY3PGHQ09EW3812HRKBBZ",
                    "quantity": 2,
                },
                {
                    "productId": "prod_01KCFRCKR5NV5VGCM7ZTKCZ5DE",
                    "variantId": "variant_01KCFRCKV84EMEE32KZB4QF9MK",
                    "quantity": 1,
                },
            ]
        },
    )

    assert response.status_code == 200
    assert response.json() == {"url": "https://checkout.stripe.com/c/pay/test"}
    line_items = captured["line_items"]  # type: ignore[assignment]
    assert len(line_items) == 2
    assert line_items[0]["price_data"]["currency"] == "gbp"
    assert line_items[0]["price_data"]["unit_amount"] == 4999
    assert line_items[0]["quantity"] == 2
    assert line_items[1]["price_data"]["unit_amount"] == 4999
    assert line_items[1]["quantity"] == 1
    assert captured["cancel_url"] == "http://localhost:5173/checkout"
    assert str(captured["idempotency_key"]).startswith("asc_")
    metadata = captured["metadata"]  # type: ignore[assignment]
    assert metadata["order_reference"] == captured["idempotency_key"]
    assert len(metadata["cart_reference"]) == 20
    assert metadata["line_count"] == "2"
    assert captured["shipping_address_collection"] == {"allowed_countries": ["GB"]}
    shipping_rate = captured["shipping_options"][0]["shipping_rate_data"]
    assert shipping_rate["fixed_amount"] == {"amount": 0, "currency": "gbp"}
    with sqlite3.connect(tmp_path / "orders.db") as connection:
        order = connection.execute(
            """
            SELECT stripe_session_id, status, amount_total, currency
            FROM orders
            """
        ).fetchone()
    assert order == ("cs_test_created", "pending", 14997, "gbp")
