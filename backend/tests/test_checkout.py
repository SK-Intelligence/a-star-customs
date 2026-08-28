from __future__ import annotations

import sqlite3
from pathlib import Path
from types import SimpleNamespace

import stripe
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app


client = TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


def single_item_cart() -> dict[str, object]:
    return {
        "items": [
            {
                "productId": "prod_01KFVHY3MK70RA36DKE21WFPNM",
                "variantId": "variant_01KFVHY3PGHQ09EW3812HRKBBZ",
                "quantity": 1,
            }
        ]
    }


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
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
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
                    "productId": "prod_01K6GY7W0PTTBFMH5DHF9Z75EN",
                    "variantId": "variant_01K6GY7W48DGBZ4D4D9JTD3E54",
                    "quantity": 1,
                    "buildId": "trusted-price-build",
                    "lineType": "base",
                },
                {
                    "productId": "prod_01KCFRCKR5NV5VGCM7ZTKCZ5DE",
                    "variantId": "variant_01KCFRCKV84EMEE32KZB4QF9MK",
                    "quantity": 1,
                    "buildId": "trusted-price-build",
                    "lineType": "addon",
                },
            ]
        },
    )

    assert response.status_code == 200
    response_payload = response.json()
    assert response_payload["url"] == "https://checkout.stripe.com/c/pay/test"
    assert response_payload["orderReference"].startswith("asc_")
    line_items = captured["line_items"]  # type: ignore[assignment]
    assert len(line_items) == 3
    assert line_items[0]["price_data"]["currency"] == "gbp"
    assert line_items[0]["price_data"]["unit_amount"] == 4999
    assert line_items[0]["price_data"]["product_data"]["description"] == (
        "Wireless Carplay Adapter"
    )
    assert line_items[0]["quantity"] == 2
    assert line_items[1]["price_data"]["unit_amount"] == 37499
    assert line_items[1]["price_data"]["product_data"]["description"] == (
        "Ambient Lighting (Universal)"
    )
    assert line_items[1]["quantity"] == 1
    assert line_items[2]["price_data"]["unit_amount"] == 4999
    assert line_items[2]["price_data"]["product_data"]["description"] == (
        "Premium Pack: 25+ Animations & Start-Up Effects (Add-On)"
    )
    assert line_items[2]["quantity"] == 1
    assert captured["cancel_url"] == "http://localhost:5173/checkout"
    assert captured["payment_method_configuration"] == "pmc_test_checkout"
    assert "payment_method_types" not in captured
    assert str(captured["idempotency_key"]).startswith("asc_")
    metadata = captured["metadata"]  # type: ignore[assignment]
    assert metadata["order_reference"] == captured["idempotency_key"]
    assert len(metadata["cart_reference"]) == 20
    assert metadata["line_count"] == "3"
    assert metadata["build_count"] == "1"
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
    assert order == ("cs_test_created", "pending", 52496, "gbp")


def test_order_initialization_failure_prevents_stripe_session_creation(
    monkeypatch,
    tmp_path: Path,
) -> None:
    def fail_order_creation(*_: object, **__: object) -> None:
        raise sqlite3.OperationalError("database unavailable")

    def unexpected_stripe_call(**_: object) -> None:
        raise AssertionError("Stripe must not be called before the order exists")

    monkeypatch.setattr("app.main.create_pending_order", fail_order_creation)
    monkeypatch.setattr("app.main.stripe.checkout.Session.create", unexpected_stripe_call)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=tmp_path / "orders.db",
    )

    response = client.post("/api/checkout/session", json=single_item_cart())

    assert response.status_code == 503
    assert response.json() == {
        "detail": "The order could not be initialized. Please try again later."
    }


def test_session_attach_failure_keeps_recoverable_order_reference(
    monkeypatch,
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "orders.db"
    captured: dict[str, object] = {}

    def fake_create(**kwargs: object) -> SimpleNamespace:
        captured.update(kwargs)
        return SimpleNamespace(
            id="cs_test_attach_failure",
            url="https://checkout.stripe.com/c/pay/recoverable",
        )

    def fail_attach(*_: object, **__: object) -> None:
        raise sqlite3.OperationalError("database locked")

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fake_create)
    monkeypatch.setattr("app.main.attach_stripe_session", fail_attach)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=database_path,
    )

    response = client.post("/api/checkout/session", json=single_item_cart())

    assert response.status_code == 503
    with sqlite3.connect(database_path) as connection:
        order = connection.execute(
            "SELECT order_reference, stripe_session_id, status FROM orders"
        ).fetchone()
    metadata = captured["metadata"]  # type: ignore[assignment]
    assert order == (metadata["order_reference"], None, "pending")


def test_stripe_creation_failure_leaves_durable_draft_without_session(
    monkeypatch,
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "orders.db"

    def fail_stripe_create(**_: object) -> None:
        raise stripe.APIConnectionError("provider unavailable")

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fail_stripe_create)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=database_path,
    )

    response = client.post("/api/checkout/session", json=single_item_cart())

    assert response.status_code == 502
    with sqlite3.connect(database_path) as connection:
        order = connection.execute(
            "SELECT stripe_session_id, status FROM orders"
        ).fetchone()
    assert order == (None, "pending")


AMBIENT_BASE = {
    "productId": "prod_01K6GY7W0PTTBFMH5DHF9Z75EN",
    "variantId": "variant_01K6GY7W48DGBZ4D4D9JTD3E54",
}
SPEAKER_ADD_ON = {
    "productId": "prod_01KCFR1PBNK4HHMX64NN0BPCCK",
    "variantId": "variant_01KCFR1PF6SSFRX0GSDM2FDNDH",
}
PREMIUM_ADD_ON = {
    "productId": "prod_01KCFRCKR5NV5VGCM7ZTKCZ5DE",
    "variantId": "variant_01KCFRCKV84EMEE32KZB4QF9MK",
}
PANORAMIC_BASE = {
    "productId": "prod_01KD6GH4TK6C5TEX6AK8PBD4PV",
    "variantId": "variant_01KD6GH4X2KGPC68E2VN6YH25Q",
}


def test_checkout_accepts_stacked_add_ons_on_a_compatible_listing(
    monkeypatch,
    tmp_path: Path,
) -> None:
    captured: dict[str, object] = {}

    def fake_create(**kwargs: object) -> SimpleNamespace:
        captured.update(kwargs)
        return SimpleNamespace(
            id="cs_test_panoramic_build",
            url="https://checkout.stripe.com/c/pay/panoramic-build",
        )

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fake_create)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=tmp_path / "orders.db",
    )

    response = client.post(
        "/api/checkout/session",
        json={
            "items": [
                {
                    **AMBIENT_BASE,
                    "quantity": 1,
                    "buildId": "panoramic-build",
                    "lineType": "base",
                },
                {
                    **SPEAKER_ADD_ON,
                    "quantity": 1,
                    "buildId": "panoramic-build",
                    "lineType": "addon",
                },
                {
                    **PREMIUM_ADD_ON,
                    "quantity": 1,
                    "buildId": "panoramic-build",
                    "lineType": "addon",
                },
            ]
        },
    )

    assert response.status_code == 200
    line_items = captured["line_items"]  # type: ignore[assignment]
    assert [
        item["price_data"]["product_data"]["metadata"]["line_type"]
        for item in line_items
    ] == ["base", "addon", "addon"]


def test_checkout_accepts_active_add_ons_on_any_main_listing(
    monkeypatch,
    tmp_path: Path,
) -> None:
    def fake_create(**_: object) -> SimpleNamespace:
        return SimpleNamespace(
            id="cs_test_universal_add_on",
            url="https://checkout.stripe.com/c/pay/universal-add-on",
        )

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fake_create)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=tmp_path / "orders.db",
    )
    response = client.post(
        "/api/checkout/session",
        json={
            "items": [
                {
                    **PANORAMIC_BASE,
                    "quantity": 1,
                    "buildId": "unrelated-build",
                    "lineType": "base",
                },
                {
                    **SPEAKER_ADD_ON,
                    "quantity": 1,
                    "buildId": "unrelated-build",
                    "lineType": "addon",
                },
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["url"] == "https://checkout.stripe.com/c/pay/universal-add-on"


def test_checkout_forwards_grouping_to_line_metadata_and_cart_hash(
    monkeypatch,
    tmp_path: Path,
) -> None:
    sessions: list[dict[str, object]] = []

    def fake_create(**kwargs: object) -> SimpleNamespace:
        sessions.append(kwargs)
        return SimpleNamespace(
            id=f"cs_test_grouped_{len(sessions)}",
            url=f"https://checkout.stripe.com/c/pay/grouped-{len(sessions)}",
        )

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fake_create)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=tmp_path / "orders.db",
    )

    def grouped_cart(first_build_id: str, second_build_id: str) -> dict[str, object]:
        return {
            "items": [
                {
                    **AMBIENT_BASE,
                    "quantity": 1,
                    "buildId": first_build_id,
                    "lineType": "base",
                },
                {
                    **SPEAKER_ADD_ON,
                    "quantity": 1,
                    "buildId": first_build_id,
                    "lineType": "addon",
                },
                {
                    **AMBIENT_BASE,
                    "quantity": 1,
                    "buildId": second_build_id,
                    "lineType": "base",
                },
                {
                    **PREMIUM_ADD_ON,
                    "quantity": 1,
                    "buildId": second_build_id,
                    "lineType": "addon",
                },
            ]
        }

    first_response = client.post(
        "/api/checkout/session",
        json=grouped_cart("build-one", "build-two"),
    )
    second_response = client.post(
        "/api/checkout/session",
        json=grouped_cart("build-three", "build-four"),
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    first_line_items = sessions[0]["line_items"]  # type: ignore[assignment]
    assert first_line_items[0]["price_data"]["product_data"]["metadata"] == {
        "product_id": AMBIENT_BASE["productId"],
        "variant_id": AMBIENT_BASE["variantId"],
        "line_type": "base",
        "build_id": "build-one",
    }
    assert first_line_items[1]["price_data"]["product_data"]["metadata"][
        "line_type"
    ] == "addon"
    first_metadata = sessions[0]["metadata"]  # type: ignore[assignment]
    second_metadata = sessions[1]["metadata"]  # type: ignore[assignment]
    assert first_metadata["build_count"] == "2"
    assert first_metadata["cart_reference"] != second_metadata["cart_reference"]


def test_checkout_preserves_legacy_standalone_payload(monkeypatch, tmp_path: Path) -> None:
    captured: dict[str, object] = {}

    def fake_create(**kwargs: object) -> SimpleNamespace:
        captured.update(kwargs)
        return SimpleNamespace(
            id="cs_test_legacy",
            url="https://checkout.stripe.com/c/pay/legacy",
        )

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fake_create)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=tmp_path / "orders.db",
    )

    response = client.post("/api/checkout/session", json=single_item_cart())

    assert response.status_code == 200
    line_items = captured["line_items"]  # type: ignore[assignment]
    assert line_items[0]["price_data"]["product_data"]["metadata"] == {
        "product_id": "prod_01KFVHY3MK70RA36DKE21WFPNM",
        "variant_id": "variant_01KFVHY3PGHQ09EW3812HRKBBZ",
        "line_type": "standalone",
    }


def test_checkout_rejects_active_add_on_as_standalone() -> None:
    response = client.post(
        "/api/checkout/session",
        json={"items": [{**SPEAKER_ADD_ON, "quantity": 1}]},
    )

    assert response.status_code == 409
    assert response.json() == {
        "detail": {
            "code": "BUILD_INVALID",
            "message": "The configured product build is invalid.",
        }
    }


@pytest.mark.parametrize(
    "items",
    [
        [
            {
                **SPEAKER_ADD_ON,
                "quantity": 1,
                "buildId": "orphan",
                "lineType": "addon",
            }
        ],
        [
            {
                **AMBIENT_BASE,
                "quantity": 1,
                "buildId": "duplicate-base",
                "lineType": "base",
            },
            {
                "productId": "prod_01KRGYB92HFEDJ2669V89535NR",
                "variantId": "variant_01KRGYB95N2F3J300J4DD7WQ1F",
                "quantity": 1,
                "buildId": "duplicate-base",
                "lineType": "base",
            },
        ],
        [
            {
                **AMBIENT_BASE,
                "quantity": 2,
                "buildId": "quantity-mismatch",
                "lineType": "base",
            },
            {
                **SPEAKER_ADD_ON,
                "quantity": 1,
                "buildId": "quantity-mismatch",
                "lineType": "addon",
            },
        ],
        [
            {
                **AMBIENT_BASE,
                "quantity": 1,
                "buildId": "misclassified",
                "lineType": "standalone",
            }
        ],
    ],
)
def test_checkout_rejects_invalid_builds_with_stable_code(
    items: list[dict[str, object]],
) -> None:
    response = client.post("/api/checkout/session", json={"items": items})

    assert response.status_code == 409
    assert response.json() == {
        "detail": {
            "code": "BUILD_INVALID",
            "message": "The configured product build is invalid.",
        }
    }
