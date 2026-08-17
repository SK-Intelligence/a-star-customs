from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app


client = TestClient(app)


def unconfigured_settings() -> Settings:
    return Settings(
        web3forms_access_key=None,
        stripe_secret_key=None,
        stripe_webhook_secret=None,
    )


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_health() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_contact_requires_provider_configuration() -> None:
    app.dependency_overrides[get_settings] = unconfigured_settings

    response = client.post(
        "/api/contact",
        json={
            "name": "Test Customer",
            "email": "customer@example.com",
            "message": "Please contact me about an installation.",
        },
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "Contact form delivery is not configured."}


def test_contact_validates_input_before_configuration() -> None:
    app.dependency_overrides[get_settings] = unconfigured_settings

    response = client.post(
        "/api/contact",
        json={"name": "A", "email": "not-an-email", "message": "short"},
    )

    assert response.status_code == 422


def test_checkout_requires_stripe_configuration_for_valid_catalog_item() -> None:
    app.dependency_overrides[get_settings] = unconfigured_settings

    response = client.post(
        "/api/checkout/session",
        json={
            "items": [
                {
                    "productId": "prod_01KFVHY3MK70RA36DKE21WFPNM",
                    "variantId": "variant_01KFVHY3PGHQ09EW3812HRKBBZ",
                    "quantity": 1,
                }
            ]
        },
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "Checkout is not configured."}


def test_checkout_rejects_unknown_product() -> None:
    app.dependency_overrides[get_settings] = unconfigured_settings

    response = client.post(
        "/api/checkout/session",
        json={
            "items": [
                {"productId": "unknown", "variantId": "unknown", "quantity": 1}
            ]
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Product not found: unknown."}


def test_checkout_rejects_variant_from_another_product() -> None:
    app.dependency_overrides[get_settings] = unconfigured_settings

    response = client.post(
        "/api/checkout/session",
        json={
            "items": [
                {
                    "productId": "prod_01KFVHY3MK70RA36DKE21WFPNM",
                    "variantId": "variant_01KCFRCKV84EMEE32KZB4QF9MK",
                    "quantity": 1,
                }
            ]
        },
    )

    assert response.status_code == 404
    assert response.json() == {
        "detail": "Variant not found: variant_01KCFRCKV84EMEE32KZB4QF9MK."
    }


def test_checkout_rejects_non_purchasable_catalog_item() -> None:
    app.dependency_overrides[get_settings] = unconfigured_settings

    response = client.post(
        "/api/checkout/session",
        json={
            "items": [
                {
                    "productId": "prod_01KD6J6R9BH67WN9R5VHP4SJEG",
                    "variantId": "variant_01KD6J6RBN25P22MN2J226EMWG",
                    "quantity": 1,
                }
            ]
        },
    )

    assert response.status_code == 409


def test_checkout_accepts_only_catalog_identifiers_and_quantity() -> None:
    app.dependency_overrides[get_settings] = unconfigured_settings

    response = client.post(
        "/api/checkout/session",
        json={
            "items": [
                {
                    "productId": "prod_01KFVHY3MK70RA36DKE21WFPNM",
                    "variantId": "variant_01KFVHY3PGHQ09EW3812HRKBBZ",
                    "quantity": 1,
                    "price": 1,
                }
            ]
        },
    )

    assert response.status_code == 422


def test_checkout_rejects_empty_cart() -> None:
    app.dependency_overrides[get_settings] = unconfigured_settings

    response = client.post("/api/checkout/session", json={"items": []})

    assert response.status_code == 422


def test_checkout_rejects_duplicate_lines() -> None:
    app.dependency_overrides[get_settings] = unconfigured_settings
    line = {
        "productId": "prod_01KFVHY3MK70RA36DKE21WFPNM",
        "variantId": "variant_01KFVHY3PGHQ09EW3812HRKBBZ",
        "quantity": 1,
    }

    response = client.post(
        "/api/checkout/session",
        json={"items": [line, line]},
    )

    assert response.status_code == 422


def test_checkout_rejects_more_than_fifty_lines() -> None:
    app.dependency_overrides[get_settings] = unconfigured_settings
    lines = [
        {
            "productId": f"product-{index}",
            "variantId": f"variant-{index}",
            "quantity": 1,
        }
        for index in range(51)
    ]

    response = client.post("/api/checkout/session", json={"items": lines})

    assert response.status_code == 422


def test_webhook_requires_configuration() -> None:
    app.dependency_overrides[get_settings] = unconfigured_settings

    response = client.post(
        "/api/stripe/webhook",
        content=b"{}",
        headers={"stripe-signature": "invalid"},
    )

    assert response.status_code == 503


def test_webhook_rejects_invalid_signature() -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_webhook_secret="whsec_test"
    )

    response = client.post(
        "/api/stripe/webhook",
        content=b"{}",
        headers={"stripe-signature": "invalid"},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid Stripe webhook signature."}
