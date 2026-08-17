from __future__ import annotations

import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app


client = TestClient(app)
PRODUCT_ID = "prod_01KFVHY3MK70RA36DKE21WFPNM"


def teardown_function() -> None:
    app.dependency_overrides.clear()


def configure_reviews(database_path: Path) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        reviews_database_path=database_path
    )


def test_submitted_review_is_pending_and_not_public(tmp_path: Path) -> None:
    database_path = tmp_path / "reviews.db"
    configure_reviews(database_path)

    submitted = client.post(
        f"/api/reviews/{PRODUCT_ID}",
        json={"name": "Alex Driver", "rating": 5, "comment": "Excellent service."},
    )
    public_reviews = client.get(f"/api/reviews/{PRODUCT_ID}")

    assert submitted.status_code == 202
    assert submitted.json() == {"status": "submitted"}
    assert public_reviews.status_code == 200
    assert public_reviews.json() == {"reviews": []}
    with sqlite3.connect(database_path) as connection:
        stored = connection.execute(
            "SELECT product_id, status FROM product_reviews"
        ).fetchone()
    assert stored == (PRODUCT_ID, "pending")


def test_get_returns_only_approved_reviews(tmp_path: Path) -> None:
    database_path = tmp_path / "reviews.db"
    configure_reviews(database_path)
    for name in ("Approved Customer", "Pending Customer"):
        response = client.post(
            f"/api/reviews/{PRODUCT_ID}",
            json={"name": name, "rating": 4, "comment": "A useful product review."},
        )
        assert response.status_code == 202

    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "UPDATE product_reviews SET status = 'approved' WHERE name = ?",
            ("Approved Customer",),
        )

    response = client.get(f"/api/reviews/{PRODUCT_ID}")

    assert response.status_code == 200
    body = response.json()
    assert len(body["reviews"]) == 1
    assert body["reviews"][0]["name"] == "Approved Customer"
    assert body["reviews"][0]["rating"] == 4
    assert "status" not in body["reviews"][0]


def test_review_rejects_unknown_product_without_creating_database(tmp_path: Path) -> None:
    database_path = tmp_path / "reviews.db"
    configure_reviews(database_path)

    response = client.post(
        "/api/reviews/not-a-product",
        json={"name": "Alex Driver", "rating": 5, "comment": "Excellent service."},
    )

    assert response.status_code == 404
    assert not database_path.exists()


def test_review_submission_is_strictly_validated(tmp_path: Path) -> None:
    database_path = tmp_path / "reviews.db"
    configure_reviews(database_path)

    response = client.post(
        f"/api/reviews/{PRODUCT_ID}",
        json={
            "name": "A",
            "rating": 6,
            "comment": "bad",
            "approved": True,
        },
    )

    assert response.status_code == 422
    assert not database_path.exists()
