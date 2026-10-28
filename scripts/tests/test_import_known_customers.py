"""Self-tests for scripts/import_known_customers.py."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import import_known_customers as importer  # noqa: E402


def test_imports_a_stripe_style_export(tmp_path: Path, capsys) -> None:
    export = tmp_path / "customers.csv"
    export.write_text(
        "﻿id,Email,Name\n"
        "cus_1,Jane.Doe@gmail.com,Jane\n"
        "cus_2,janedoe+2@gmail.com,Jane again\n"
        "cus_3,,No email\n"
        "cus_4,sam@example.com,Sam\n",
        encoding="utf-8",
    )
    database = tmp_path / "orders.db"

    assert importer.main([str(export), "--database", str(database)]) == 0

    with sqlite3.connect(database) as connection:
        emails = [
            row[0] for row in connection.execute("SELECT email FROM known_customers")
        ]
    assert sorted(emails) == ["janedoe@gmail.com", "sam@example.com"]
    assert "Read 3 addresses; 2 added" in capsys.readouterr().out


def test_rejects_a_file_without_an_email_column(tmp_path: Path) -> None:
    export = tmp_path / "names.csv"
    export.write_text("name\nJane\n", encoding="utf-8")

    with pytest.raises(SystemExit, match="no 'email' column"):
        importer.main([str(export), "--database", str(tmp_path / "orders.db")])
