"""Fail when the public and server catalog snapshots drift or reference missing media."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_CATALOG = ROOT / "frontend" / "src" / "data" / "catalog.json"
BACKEND_CATALOG = ROOT / "backend" / "app" / "catalog.json"
PUBLIC_DIR = ROOT / "frontend" / "public"


def load_catalog(path: Path) -> list[dict[str, Any]]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise ValueError(f"{path} must contain a JSON array")
    return value


def main() -> None:
    frontend = load_catalog(FRONTEND_CATALOG)
    backend = load_catalog(BACKEND_CATALOG)
    if frontend != backend:
        raise SystemExit("Catalog check failed: frontend and backend snapshots differ.")

    product_ids: set[str] = set()
    slugs: set[str] = set()
    variant_ids: set[str] = set()
    missing_images: list[str] = []

    for product in frontend:
        product_id = product.get("id")
        slug = product.get("slug")
        if not isinstance(product_id, str) or not product_id:
            raise SystemExit("Catalog check failed: a product has no valid ID.")
        if not isinstance(slug, str) or not slug:
            raise SystemExit(f"Catalog check failed: product {product_id} has no valid slug.")
        if product_id in product_ids or slug in slugs:
            raise SystemExit(f"Catalog check failed: duplicate product ID or slug at {slug}.")
        product_ids.add(product_id)
        slugs.add(slug)

        variants = product.get("variants")
        if not isinstance(variants, list) or not variants:
            raise SystemExit(f"Catalog check failed: product {slug} has no variants.")
        for variant in variants:
            variant_id = variant.get("id")
            price = variant.get("price")
            if not isinstance(variant_id, str) or variant_id in variant_ids:
                raise SystemExit(f"Catalog check failed: invalid or duplicate variant in {slug}.")
            if not isinstance(price, int) or price < 0:
                raise SystemExit(f"Catalog check failed: invalid price in {slug}.")
            variant_ids.add(variant_id)

        for image in product.get("images", []):
            if not isinstance(image, str) or not image.startswith("/"):
                raise SystemExit(f"Catalog check failed: invalid image path in {slug}.")
            if not (PUBLIC_DIR / image.lstrip("/")).is_file():
                missing_images.append(image)

    if missing_images:
        raise SystemExit(
            "Catalog check failed: missing images:\n" + "\n".join(sorted(set(missing_images)))
        )

    print(
        f"Catalog check passed: {len(frontend)} products, "
        f"{len(variant_ids)} variants, all referenced media present."
    )


if __name__ == "__main__":
    main()
