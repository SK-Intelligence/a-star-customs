"""Failure paths: a broken catalogue, add-on file or reviews database answers 503, never 500."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.catalog as catalog_module
import app.main as main_module
from app.addons import AddOnConfigurationError
from app.catalog import CatalogConfigurationError, load_catalog
from app.config import Settings, get_settings
from app.main import app

client = TestClient(app)
PRODUCT_ID = "prod_01KFVHY3MK70RA36DKE21WFPNM"
VARIANT_ID = "variant_01KFVHY3PGHQ09EW3812HRKBBZ"
REVIEW = {"name": "Alex Driver", "rating": 5, "comment": "Excellent service."}


def teardown_function() -> None:
    app.dependency_overrides.clear()
    load_catalog.cache_clear()


def _raise(error: type[Exception]):
    def loader() -> None:
        raise error("unavailable")

    return loader


def test_reviews_answer_503_when_the_catalog_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(main_module, "load_catalog", _raise(CatalogConfigurationError))

    response = client.get(f"/api/reviews/{PRODUCT_ID}")

    assert response.status_code == 503
    assert response.json() == {
        "detail": "The product catalog is temporarily unavailable."
    }


@pytest.mark.parametrize("method", ["get", "post"])
def test_reviews_answer_503_when_the_database_cannot_open(
    tmp_path: Path, method: str
) -> None:
    # A directory where the database file should be: sqlite3 cannot open it.
    app.dependency_overrides[get_settings] = lambda: Settings(
        reviews_database_path=tmp_path
    )

    if method == "get":
        response = client.get(f"/api/reviews/{PRODUCT_ID}")
    else:
        response = client.post(f"/api/reviews/{PRODUCT_ID}", json=REVIEW)

    assert response.status_code == 503
    assert "temporarily unavailable" in response.json()["detail"]


@pytest.mark.parametrize(
    ("target", "error", "detail"),
    [
        (
            "load_catalog",
            CatalogConfigurationError,
            "The product catalog is temporarily unavailable.",
        ),
        (
            "load_add_ons",
            AddOnConfigurationError,
            "The add-on configuration is temporarily unavailable.",
        ),
    ],
)
def test_checkout_answers_503_when_configuration_is_unavailable(
    monkeypatch: pytest.MonkeyPatch, target: str, error: type[Exception], detail: str
) -> None:
    monkeypatch.setattr(main_module, target, _raise(error))

    response = client.post(
        "/api/checkout/session",
        json={
            "items": [{"productId": PRODUCT_ID, "variantId": VARIANT_ID, "quantity": 1}]
        },
    )

    assert response.status_code == 503
    assert response.json() == {"detail": detail}


@pytest.mark.parametrize(
    "content",
    [
        "{}",  # not a list
        "not json",
        lambda products: json.dumps(products + products[:1]),  # duplicate product ID
    ],
)
def test_load_catalog_rejects_a_malformed_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, content: object
) -> None:
    if callable(content):
        content = content(json.loads(catalog_module.CATALOG_PATH.read_text("utf-8")))
    broken = tmp_path / "catalog.json"
    broken.write_text(str(content), encoding="utf-8")
    monkeypatch.setattr(catalog_module, "CATALOG_PATH", broken)
    load_catalog.cache_clear()

    with pytest.raises(CatalogConfigurationError):
        load_catalog()
