from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Literal


OrderStatus = Literal["pending", "paid", "unpaid", "expired"]

ORDER_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS orders (
    order_reference TEXT PRIMARY KEY,
    stripe_session_id TEXT UNIQUE,
    cart_reference TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'unpaid', 'expired')),
    amount_total INTEGER NOT NULL CHECK (amount_total >= 0),
    currency TEXT NOT NULL,
    customer_email TEXT,
    discount_percent INTEGER NOT NULL DEFAULT 0
        CHECK (discount_percent BETWEEN 0 AND 100),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""

# Customers who bought before this site (old shop, phone or WhatsApp bookings), imported with
# scripts/import_known_customers.py so they don't count as first-time buyers.
KNOWN_CUSTOMER_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS known_customers (
    email TEXT PRIMARY KEY,
    added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""

EVENT_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS stripe_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""

GMAIL_DOMAINS = {"gmail.com", "googlemail.com"}


@dataclass(frozen=True)
class StoredOrder:
    order_reference: str
    stripe_session_id: str | None
    status: OrderStatus
    amount_total: int
    currency: str


def normalize_email(email: str) -> str:
    """One key per inbox, so a returning customer can't pass as new.

    Lowercases, drops a "+tag", and for Gmail ignores dots and the googlemail alias.
    """

    local, _, domain = email.strip().lower().rpartition("@")
    local = local.split("+", 1)[0]
    if domain in GMAIL_DOMAINS:
        local = local.replace(".", "")
        domain = "gmail.com"
    return f"{local}@{domain}"


class StripeEventOrderNotFoundError(RuntimeError):
    """A handled Checkout event could not be reconciled to a local order."""


class StripeEventOrderMismatchError(RuntimeError):
    """A signed Checkout event does not match the local trusted order totals."""


def _connect(database_path: Path) -> sqlite3.Connection:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path, timeout=5.0)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_orders_database(database_path: Path) -> None:
    with _connect(database_path) as connection:
        connection.execute(ORDER_TABLE_SQL)
        columns = connection.execute("PRAGMA table_info(orders)").fetchall()
        session_column = next(
            (column for column in columns if column["name"] == "stripe_session_id"),
            None,
        )
        if session_column is not None and session_column["notnull"]:
            connection.executescript(
                """
                DROP INDEX IF EXISTS idx_orders_stripe_session;
                ALTER TABLE orders RENAME TO orders_legacy;
                """
            )
            connection.execute(ORDER_TABLE_SQL)
            connection.execute(
                """
                INSERT INTO orders (
                    order_reference,
                    stripe_session_id,
                    cart_reference,
                    status,
                    amount_total,
                    currency,
                    created_at,
                    updated_at
                )
                SELECT
                    order_reference,
                    stripe_session_id,
                    cart_reference,
                    status,
                    amount_total,
                    currency,
                    created_at,
                    updated_at
                FROM orders_legacy
                """
            )
            connection.execute("DROP TABLE orders_legacy")
        existing = {
            column["name"]
            for column in connection.execute("PRAGMA table_info(orders)").fetchall()
        }
        if "customer_email" not in existing:
            connection.execute("ALTER TABLE orders ADD COLUMN customer_email TEXT")
        if "discount_percent" not in existing:
            connection.execute(
                "ALTER TABLE orders ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 0"
            )
        connection.execute(EVENT_TABLE_SQL)
        connection.execute(KNOWN_CUSTOMER_TABLE_SQL)
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders (stripe_session_id)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders (customer_email)"
        )


def has_previous_purchase(database_path: Path, email: str) -> bool:
    """True when this inbox has a paid order or is on the imported past-customer list."""

    initialize_orders_database(database_path)
    key = normalize_email(email)
    with _connect(database_path) as connection:
        row = connection.execute(
            """
            SELECT 1 FROM orders WHERE customer_email = ? AND status = 'paid'
            UNION ALL
            SELECT 1 FROM known_customers WHERE email = ?
            LIMIT 1
            """,
            (key, key),
        ).fetchone()
    return row is not None


def add_known_customers(database_path: Path, emails: list[str]) -> int:
    """Record past customers; returns how many were new to the list."""

    initialize_orders_database(database_path)
    keys = {normalize_email(email) for email in emails if "@" in email}
    with _connect(database_path) as connection:
        before = connection.total_changes
        connection.executemany(
            "INSERT OR IGNORE INTO known_customers (email) VALUES (?)",
            [(key,) for key in sorted(keys)],
        )
        return connection.total_changes - before


def create_pending_order(
    database_path: Path,
    *,
    order_reference: str,
    cart_reference: str,
    amount_total: int,
    customer_email: str | None = None,
    discount_percent: int = 0,
) -> None:
    """amount_total is always the full trusted cart total, before any discount."""

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
                currency,
                customer_email,
                discount_percent
            ) VALUES (?, NULL, ?, 'pending', ?, 'gbp', ?, ?)
            """,
            (
                order_reference,
                cart_reference,
                amount_total,
                normalize_email(customer_email) if customer_email else None,
                discount_percent,
            ),
        )


def attach_stripe_session(
    database_path: Path,
    *,
    order_reference: str,
    stripe_session_id: str,
) -> bool:
    initialize_orders_database(database_path)
    with _connect(database_path) as connection:
        attached = connection.execute(
            """
            UPDATE orders
            SET stripe_session_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE order_reference = ?
              AND (stripe_session_id IS NULL OR stripe_session_id = ?)
            """,
            (stripe_session_id, order_reference, stripe_session_id),
        )
    return attached.rowcount == 1


def get_order_by_session_id(
    database_path: Path,
    stripe_session_id: str,
) -> StoredOrder | None:
    initialize_orders_database(database_path)
    with _connect(database_path) as connection:
        row = connection.execute(
            """
            SELECT order_reference, stripe_session_id, status, amount_total, currency
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
        amount_total=row["amount_total"],
        currency=row["currency"],
    )


def _amount_matches(
    trusted_total: int,
    discount_percent: int,
    *,
    amount_total: int | None,
    amount_subtotal: int | None,
    amount_discount: int | None,
) -> bool:
    """Check Stripe's amounts against the trusted cart total.

    Undiscounted orders must match exactly. A discounted order must have the trusted subtotal,
    a discount within a penny of the agreed percentage (Stripe rounds it), and a total that is
    the subtotal minus that discount.
    """

    if not discount_percent:
        return amount_total == trusted_total and not amount_discount
    if amount_total is None or amount_subtotal is None or amount_discount is None:
        return False
    expected_discount = trusted_total * discount_percent / 100
    return (
        amount_subtotal == trusted_total
        and abs(amount_discount - expected_discount) <= 1
        and amount_total == amount_subtotal - amount_discount
    )


def process_stripe_event(
    database_path: Path,
    *,
    event_id: str,
    event_type: str,
    stripe_session_id: str | None,
    order_reference: str | None,
    new_status: OrderStatus | None,
    amount_total: int | None = None,
    currency: str | None = None,
    mode: str | None = None,
    amount_subtotal: int | None = None,
    amount_discount: int | None = None,
    customer_email: str | None = None,
) -> bool:
    """Record, attach, and apply an event atomically; return True for duplicates."""

    initialize_orders_database(database_path)
    with _connect(database_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        inserted = connection.execute(
            "INSERT OR IGNORE INTO stripe_events (event_id, event_type) VALUES (?, ?)",
            (event_id, event_type),
        )
        duplicate = inserted.rowcount == 0
        if duplicate or not stripe_session_id or not new_status:
            return duplicate

        if order_reference:
            connection.execute(
                """
                UPDATE orders
                SET stripe_session_id = COALESCE(stripe_session_id, ?),
                    updated_at = CURRENT_TIMESTAMP
                WHERE order_reference = ?
                  AND (stripe_session_id IS NULL OR stripe_session_id = ?)
                """,
                (stripe_session_id, order_reference, stripe_session_id),
            )

        order = connection.execute(
            """
            SELECT order_reference, status, amount_total, currency,
                   customer_email, discount_percent
            FROM orders
            WHERE stripe_session_id = ?
            """,
            (stripe_session_id,),
        ).fetchone()
        if order is None:
            raise StripeEventOrderNotFoundError(
                f"No order matches Checkout Session {stripe_session_id}."
            )
        if order_reference and order["order_reference"] != order_reference:
            raise StripeEventOrderMismatchError(
                "Stripe order reference does not match."
            )
        if (
            mode != "payment"
            or currency != order["currency"]
            or not _amount_matches(
                order["amount_total"],
                order["discount_percent"],
                amount_total=amount_total,
                amount_subtotal=amount_subtotal,
                amount_discount=amount_discount,
            )
        ):
            raise StripeEventOrderMismatchError(
                "Stripe order amount or currency does not match."
            )
        paid_email = normalize_email(customer_email) if customer_email else None
        if (
            order["discount_percent"]
            and new_status == "paid"
            and paid_email != order["customer_email"]
        ):
            raise StripeEventOrderMismatchError(
                "Stripe customer does not match the discounted order."
            )

        if new_status == "paid":
            connection.execute(
                """
                UPDATE orders
                SET status = 'paid',
                    customer_email = COALESCE(customer_email, ?),
                    updated_at = CURRENT_TIMESTAMP
                WHERE order_reference = ?
                """,
                (paid_email, order["order_reference"]),
            )
        elif order["status"] != "paid":
            connection.execute(
                """
                UPDATE orders
                SET status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE order_reference = ?
                """,
                (new_status, order["order_reference"]),
            )
    return duplicate
