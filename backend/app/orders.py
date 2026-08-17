from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Literal


OrderStatus = Literal["pending", "paid", "unpaid", "expired"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS orders (
    order_reference TEXT PRIMARY KEY,
    stripe_session_id TEXT NOT NULL UNIQUE,
    cart_reference TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'unpaid', 'expired')),
    amount_total INTEGER NOT NULL CHECK (amount_total >= 0),
    currency TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS stripe_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session
ON orders (stripe_session_id);
"""


@dataclass(frozen=True)
class StoredOrder:
    order_reference: str
    stripe_session_id: str
    status: OrderStatus


def _connect(database_path: Path) -> sqlite3.Connection:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path, timeout=5.0)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_orders_database(database_path: Path) -> None:
    with _connect(database_path) as connection:
        connection.executescript(SCHEMA)


def create_pending_order(
    database_path: Path,
    *,
    order_reference: str,
    stripe_session_id: str,
    cart_reference: str,
    amount_total: int,
) -> None:
    initialize_orders_database(database_path)
    with _connect(database_path) as connection:
        connection.execute(
            """
            INSERT INTO orders (
                order_reference,
                stripe_session_id,
                cart_reference,
                status,
                amount_total,
                currency
            ) VALUES (?, ?, ?, 'pending', ?, 'gbp')
            """,
            (order_reference, stripe_session_id, cart_reference, amount_total),
        )


def get_order_by_session_id(
    database_path: Path,
    stripe_session_id: str,
) -> StoredOrder | None:
    initialize_orders_database(database_path)
    with _connect(database_path) as connection:
        row = connection.execute(
            """
            SELECT order_reference, stripe_session_id, status
            FROM orders
            WHERE stripe_session_id = ?
            """,
            (stripe_session_id,),
        ).fetchone()
    if row is None:
        return None
    return StoredOrder(
        order_reference=row["order_reference"],
        stripe_session_id=row["stripe_session_id"],
        status=row["status"],
    )


def process_stripe_event(
    database_path: Path,
    *,
    event_id: str,
    event_type: str,
    stripe_session_id: str | None,
    new_status: OrderStatus | None,
) -> bool:
    """Record and apply an event atomically; return True when it was a duplicate."""

    initialize_orders_database(database_path)
    with _connect(database_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        inserted = connection.execute(
            "INSERT OR IGNORE INTO stripe_events (event_id, event_type) VALUES (?, ?)",
            (event_id, event_type),
        )
        duplicate = inserted.rowcount == 0
        if not duplicate and stripe_session_id and new_status:
            if new_status == "paid":
                connection.execute(
                    """
                    UPDATE orders
                    SET status = 'paid', updated_at = CURRENT_TIMESTAMP
                    WHERE stripe_session_id = ?
                    """,
                    (stripe_session_id,),
                )
            else:
                connection.execute(
                    """
                    UPDATE orders
                    SET status = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE stripe_session_id = ? AND status != 'paid'
                    """,
                    (new_status, stripe_session_id),
                )
    return duplicate
