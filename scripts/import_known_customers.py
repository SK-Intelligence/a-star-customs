"""Import past customers so the first-order discount code rejects them.

Takes CSV files with an email column (a Stripe customer export works as-is) and records each
address in the orders database. Run it wherever ORDERS_DATABASE_PATH points, e.g. on the
production volume:

    python scripts/import_known_customers.py customers.csv [more.csv ...] [--database PATH]
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.orders import add_known_customers  # noqa: E402


DEFAULT_DATABASE = ROOT / "backend" / "data" / "orders.db"


def database_path(value: str | None) -> Path:
    configured = value or os.getenv("ORDERS_DATABASE_PATH")
    return Path(configured).expanduser().resolve() if configured else DEFAULT_DATABASE


def read_emails(path: Path) -> list[str]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        column = next(
            (
                name
                for name in reader.fieldnames or []
                if name.strip().lower() == "email"
            ),
            None,
        )
        if column is None:
            raise SystemExit(f"{path}: no 'email' column found.")
        return [row[column].strip() for row in reader if (row[column] or "").strip()]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("csv_files", nargs="+", type=Path)
    parser.add_argument(
        "--database", help="orders database (default: ORDERS_DATABASE_PATH)"
    )
    args = parser.parse_args(argv)

    emails = [email for path in args.csv_files for email in read_emails(path)]
    added = add_known_customers(database_path(args.database), emails)
    print(f"Read {len(emails)} addresses; {added} added to the past-customer list.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
