from __future__ import annotations

from typing import Any

import httpx
import pytest
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


class StubAsyncClient:
    response: httpx.Response
    captured_payload: dict[str, Any] | None = None

    def __init__(self, **_: object) -> None:
        pass

    async def __aenter__(self) -> "StubAsyncClient":
        return self

    async def __aexit__(self, *_: object) -> None:
        return None

    async def post(self, url: str, *, json: dict[str, Any]) -> httpx.Response:
        assert url == "https://api.web3forms.com/submit"
        type(self).captured_payload = json
        return type(self).response


def configured_contact_settings() -> Settings:
    return Settings(web3forms_access_key="test_web3forms_key")


def test_health() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_cors_does_not_allow_browser_credentials() -> None:
    response = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-credentials" not in response.headers


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


def test_contact_forwards_valid_payload(monkeypatch) -> None:
    StubAsyncClient.response = httpx.Response(
        200,
        json={"success": True},
        request=httpx.Request("POST", "https://api.web3forms.com/submit"),
    )
    StubAsyncClient.captured_payload = None
    monkeypatch.setattr("app.main.httpx.AsyncClient", StubAsyncClient)
    app.dependency_overrides[get_settings] = configured_contact_settings

    response = client.post(
        "/api/contact",
        json={
            "name": "Test Customer",
            "email": "customer@example.com",
            "phone": "+44 7700 900000",
            "message": "Please contact me about an installation.",
        },
    )

    assert response.status_code == 202
    assert response.json() == {"status": "accepted"}
    assert StubAsyncClient.captured_payload == {
        "access_key": "test_web3forms_key",
        "subject": "New A Star Customs website enquiry",
        "from_name": "A Star Customs Website",
        "name": "Test Customer",
        "email": "customer@example.com",
        "phone": "+44 7700 900000",
        "message": "Please contact me about an installation.",
    }


@pytest.mark.parametrize(
    "provider_response",
    [
        httpx.Response(
            500,
            json={"success": False},
            request=httpx.Request("POST", "https://api.web3forms.com/submit"),
        ),
        httpx.Response(
            200,
            content=b"not-json",
            headers={"Content-Type": "application/json"},
            request=httpx.Request("POST", "https://api.web3forms.com/submit"),
        ),
        httpx.Response(
            200,
            json=[],
            request=httpx.Request("POST", "https://api.web3forms.com/submit"),
        ),
        httpx.Response(
            200,
            json={"success": False},
            request=httpx.Request("POST", "https://api.web3forms.com/submit"),
        ),
    ],
)
def test_contact_handles_provider_failures(
    monkeypatch,
    provider_response: httpx.Response,
) -> None:
    StubAsyncClient.response = provider_response
    monkeypatch.setattr("app.main.httpx.AsyncClient", StubAsyncClient)
    app.dependency_overrides[get_settings] = configured_contact_settings

    response = client.post(
        "/api/contact",
        json={
            "name": "Test Customer",
            "email": "customer@example.com",
            "message": "Please contact me about an installation.",
        },
    )

    assert response.status_code == 502
    assert response.json() == {
        "detail": "Contact form delivery failed. Please try again later."
    }


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
    assert response.json() == {
        "detail": {
            "code": "CHECKOUT_NOT_CONFIGURED",
            "message": "Checkout is not configured.",
        }
    }


def test_checkout_requires_payment_method_configuration_with_secret_key() -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id=None,
    )

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
    assert response.json() == {
        "detail": {
            "code": "CHECKOUT_NOT_CONFIGURED",
            "message": "Checkout is not configured.",
        }
    }


def test_checkout_requires_webhook_configuration_before_taking_payment() -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret=None,
    )

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
    assert response.json() == {
        "detail": {
            "code": "CHECKOUT_NOT_CONFIGURED",
            "message": "Checkout is not configured.",
        }
    }


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
