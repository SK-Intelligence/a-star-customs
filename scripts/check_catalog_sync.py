"""Fail when the public and server catalog snapshots drift or reference missing media."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_CATALOG = ROOT / "frontend" / "src" / "data" / "catalog.json"
BACKEND_CATALOG = ROOT / "backend" / "app" / "catalog.json"
FRONTEND_ADD_ONS = ROOT / "frontend" / "src" / "data" / "add-ons.json"
BACKEND_ADD_ONS = ROOT / "backend" / "app" / "add-ons.json"
PUBLIC_DIR = ROOT / "frontend" / "public"


def load_json_array(path: Path) -> list[dict[str, Any]]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise ValueError(f"{path} must contain a JSON array")
    return value


def main() -> None:
    frontend = load_json_array(FRONTEND_CATALOG)
    backend = load_json_array(BACKEND_CATALOG)
    if frontend != backend:
        raise SystemExit("Catalog check failed: frontend and backend snapshots differ.")

    frontend_add_ons = load_json_array(FRONTEND_ADD_ONS)
    backend_add_ons = load_json_array(BACKEND_ADD_ONS)
    if frontend_add_ons != backend_add_ons:
        raise SystemExit("Catalog check failed: frontend and backend add-on configs differ.")

    product_ids: set[str] = set()
    products_by_id: dict[str, dict[str, Any]] = {}
    slugs: set[str] = set()
    variant_ids: set[str] = set()
    variants_by_product_id: dict[str, set[str]] = {}
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
        products_by_id[product_id] = product
        slugs.add(slug)

        variants = product.get("variants")
        if not isinstance(variants, list) or not variants:
            raise SystemExit(f"Catalog check failed: product {slug} has no variants.")
        product_variant_ids: set[str] = set()
        for variant in variants:
            variant_id = variant.get("id")
            price = variant.get("price")
            if not isinstance(variant_id, str) or variant_id in variant_ids:
                raise SystemExit(f"Catalog check failed: invalid or duplicate variant in {slug}.")
            if not isinstance(price, int) or price < 0:
                raise SystemExit(f"Catalog check failed: invalid price in {slug}.")
            variant_ids.add(variant_id)
            product_variant_ids.add(variant_id)
        variants_by_product_id[product_id] = product_variant_ids

        for image in product.get("images", []):
            if not isinstance(image, str) or not image.startswith("/"):
                raise SystemExit(f"Catalog check failed: invalid image path in {slug}.")
            if not (PUBLIC_DIR / image.lstrip("/")).is_file():
                missing_images.append(image)

    if missing_images:
        raise SystemExit(
            "Catalog check failed: missing images:\n" + "\n".join(sorted(set(missing_images)))
        )

    add_on_ids: set[str] = set()
    active_add_on_variants: set[tuple[str, str]] = set()
    for add_on in frontend_add_ons:
        add_on_id = add_on.get("id")
        status = add_on.get("status")
        label = add_on.get("label")
        description = add_on.get("description")
        compatible_product_ids = add_on.get("compatibleProductIds")
        product_id = add_on.get("productId")
        variant_id = add_on.get("variantId")

        if not isinstance(add_on_id, str) or not add_on_id or add_on_id in add_on_ids:
            raise SystemExit("Catalog check failed: invalid or duplicate add-on ID.")
        add_on_ids.add(add_on_id)
        if status not in {"active", "disabled"}:
            raise SystemExit(f"Catalog check failed: invalid status for add-on {add_on_id}.")
        if not isinstance(label, str) or not label.strip():
            raise SystemExit(f"Catalog check failed: add-on {add_on_id} has no label.")
        if not isinstance(description, str) or not description.strip():
            raise SystemExit(f"Catalog check failed: add-on {add_on_id} has no description.")
        if (
            not isinstance(compatible_product_ids, list)
            or not compatible_product_ids
            or len(compatible_product_ids) != len(set(compatible_product_ids))
            or any(product not in product_ids for product in compatible_product_ids)
        ):
            raise SystemExit(
                f"Catalog check failed: add-on {add_on_id} has invalid compatible products."
            )

        if status == "disabled":
            if product_id is not None or variant_id is not None:
                raise SystemExit(
                    f"Catalog check failed: disabled add-on {add_on_id} must not be purchasable."
                )
            continue

        if (
            not isinstance(product_id, str)
            or not isinstance(variant_id, str)
            or variant_id not in variants_by_product_id.get(product_id, set())
        ):
            raise SystemExit(
                f"Catalog check failed: active add-on {add_on_id} has invalid catalog IDs."
            )
        add_on_product = products_by_id[product_id]
        add_on_variant = next(
            variant
            for variant in add_on_product["variants"]
            if variant.get("id") == variant_id
        )
        if (
            add_on_product.get("purchasable") is not True
            or add_on_product.get("available") is not True
            or add_on_variant.get("available") is not True
            or not isinstance(add_on_variant.get("price"), int)
            or add_on_variant["price"] <= 0
        ):
            raise SystemExit(
                f"Catalog check failed: active add-on {add_on_id} is not sellable."
            )
        catalog_pair = (product_id, variant_id)
        if catalog_pair in active_add_on_variants:
            raise SystemExit(
                f"Catalog check failed: duplicate active catalog item for add-on {add_on_id}."
            )
        active_add_on_variants.add(catalog_pair)

    print(
        f"Catalog check passed: {len(frontend)} products, "
        f"{len(variant_ids)} variants, {len(frontend_add_ons)} add-ons, "
        "all referenced media present."
    )


if __name__ == "__main__":
    main()
