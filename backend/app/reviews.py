from __future__ import annotations

import sqlite3
from pathlib import Path

from app.models import ReviewRequest, ReviewResponse


SCHEMA = """
CREATE TABLE IF NOT EXISTS product_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_reviews_approved
ON product_reviews (product_id, status, created_at DESC);
"""


def _connect(database_path: Path) -> sqlite3.Connection:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path, timeout=5.0)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database(database_path: Path) -> None:
    with _connect(database_path) as connection:
        connection.executescript(SCHEMA)


def submit_review(database_path: Path, product_id: str, review: ReviewRequest) -> None:
    initialize_database(database_path)
    with _connect(database_path) as connection:
        connection.execute(
            """
            INSERT INTO product_reviews (product_id, name, rating, comment, status)
            VALUES (?, ?, ?, ?, 'pending')
            """,
            (product_id, review.name, review.rating, review.comment),
        )


def list_approved_reviews(database_path: Path, product_id: str) -> list[ReviewResponse]:
    initialize_database(database_path)
    with _connect(database_path) as connection:
        rows = connection.execute(
            """
            SELECT name, rating, comment, created_at
            FROM product_reviews
            WHERE product_id = ? AND status = 'approved'
            ORDER BY created_at DESC, id DESC
            """,
            (product_id,),
        ).fetchall()

    return [
        ReviewResponse(
            name=row["name"],
            rating=row["rating"],
            comment=row["comment"],
            createdAt=row["created_at"],
        )
        for row in rows
    ]
