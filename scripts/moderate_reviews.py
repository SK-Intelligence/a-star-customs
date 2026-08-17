"""List and moderate pending product reviews without exposing an admin web route."""

from __future__ import annotations

import argparse
import os
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE = ROOT / "backend" / "data" / "reviews.db"


def database_path(value: str | None) -> Path:
    configured = value or os.getenv("REVIEWS_DATABASE_PATH")
    return Path(configured).expanduser().resolve() if configured else DEFAULT_DATABASE


def require_database(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        raise SystemExit(f"Review database not found: {path}")
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    return connection


def list_reviews(connection: sqlite3.Connection, status: str) -> None:
    rows = connection.execute(
        """
        SELECT id, product_id, name, rating, comment, status, created_at
        FROM product_reviews
        WHERE status = ?
        ORDER BY created_at ASC, id ASC
        """,
        (status,),
    ).fetchall()
    if not rows:
        print(f"No {status} reviews.")
        return
    for row in rows:
        comment = " ".join(str(row["comment"]).split())
        print(
            f"#{row['id']} [{row['status']}] {row['rating']}/5 "
            f"{row['name']} · {row['product_id']} · {row['created_at']}\n{comment}\n"
        )


def update_review(connection: sqlite3.Connection, review_id: int, status: str) -> None:
    result = connection.execute(
        "UPDATE product_reviews SET status = ? WHERE id = ? AND status = 'pending'",
        (status, review_id),
    )
    connection.commit()
    if result.rowcount != 1:
        raise SystemExit(f"Pending review #{review_id} was not found.")
    print(f"Review #{review_id} marked {status}.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", help="Path to reviews.db")
    subparsers = parser.add_subparsers(dest="command", required=True)

    list_parser = subparsers.add_parser("list", help="List reviews by status")
    list_parser.add_argument(
        "--status", choices=("pending", "approved", "rejected"), default="pending"
    )
    for command in ("approve", "reject"):
        command_parser = subparsers.add_parser(command, help=f"{command.title()} a pending review")
        command_parser.add_argument("review_id", type=int)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    with require_database(database_path(args.database)) as connection:
        if args.command == "list":
            list_reviews(connection, args.status)
        else:
            update_review(connection, args.review_id, "approved" if args.command == "approve" else "rejected")


if __name__ == "__main__":
    main()
