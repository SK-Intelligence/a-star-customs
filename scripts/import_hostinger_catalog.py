"""One-time migration utility for the company's existing public Hostinger catalog.

The generated storefront does not make runtime requests to Hostinger. Re-run this
script before final cutover if the source catalog changes.
"""

from __future__ import annotations

import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
BACKEND = ROOT / "backend"
PRODUCTS_DIR = FRONTEND / "public" / "images" / "products"
SITE_DIR = FRONTEND / "public" / "images" / "site"
FONTS_DIR = FRONTEND / "public" / "fonts"

STORE_ID = "store_01K4R1BZDYA3NY80HWDBGHZTTV"
PRODUCT_API = f"https://api-ecommerce.hostinger.com/store/{STORE_ID}/products"
COLLECTIONS_API = (
    f"https://api-ecommerce.hostinger.com/store/{STORE_ID}/collections"
)
SITE_ASSET_ROOT = "https://assets.zyrosite.com/A85MjQWzv9S34zLw"

SITE_ASSETS = {
    "logo.png": "img-20250909-wa0003-removebg-preview-YKb82bx1KaigGDJE.png",
    "hero.jpg": "a-star-customs-starlights-pic-dJoP8rEDO7hqQryP.jpg",
    "service-ambient.jpg": "img-20250909-wa0069-AE07EGjOVkUoP6NW.jpg",
    "service-starlights.jpg": "img-20250909-wa0082-d95ZMGnDRGurOvre.jpg",
    "service-screen.webp": "img_9590heic-YrD4zBO85NCZDvQx.webp",
    "service-rims.jpg": "img-20251216-wa0018-84dVnRfLGvB68QQd.jpg",
    "service-dashcam.jpg": "dashcam-1-a-star-Zw48cOmV7lvcStZH.jpg",
    "service-steering.jpeg": "steering-wheel-custom-1-ndvSBWKb1UcWIgzp.jpeg",
    "gallery-ambient-01.jpeg": "purple-tron-c63-seats-IXaH6kouMeBgJmBB.jpeg",
    "gallery-ambient-02.jpeg": "blue-and-purple-ambients-ibH4V8HBKq2oqCnt.jpeg",
    "gallery-ambient-03.jpg": "img-20251124-wa0033-SNOoPljzvpFYsG5i.jpg",
    "gallery-screen-01.jpg": "img-20251216-wa0015-VejQ4r6IdYJgz4zN.jpg",
    "gallery-screen-02.jpg": "img-20250909-wa0084-Yle4zeO1qzfpJn0W.jpg",
    "gallery-screen-03.webp": "img_0223heic-d95Zy6N2nacPoxO6.webp",
    "gallery-stars-01.jpg": "img-20251124-wa0008-VuMdwR6sJNCIeJTT.jpg",
    "gallery-stars-02.jpg": "img-20251124-wa0016-6seBWH5Mshm4tBrY.jpg",
    "gallery-stars-07.jpg": "whatsapp-image-2025-12-16-at-12.02.48_90c20eb5-GxFo0tvHgMss6tUO.jpg",
    "gallery-stars-03.jpg": "img-20250909-wa0055-A0xv2x8B0Mf11yrP.jpg",
    "gallery-stars-04.webp": "img_7650-high-mjE40DWJRxHDGgEY.webp",
    "gallery-stars-05.jpg": "img-20250909-wa0058-AVLxGXVRV9sqZK3l.jpg",
    "gallery-stars-06.jpeg": "red-starlights-g5aJWRkWoq0P4UHU.jpeg",
    "gallery-rims-01.jpg": "img-20250909-wa0059-A3QlBGlD8McZLrpN.jpg",
    "gallery-rims-02.webp": "img_1236-AMqDMznlwpujKrNQ.webp",
    "gallery-steering-01.webp": "img_0276jpg-A1azDNKBLkib55Q3.webp",
    "gallery-steering-02.webp": "image-AR01nzJM5PSJMoy3.webp",
    "gallery-steering-03.jpg": "img_0278jpg-mk340MDql9Sz5kJZ.jpg",
    "gallery-dashcam-01.jpg": "img-20250909-wa0006-AGBz7jRbrNiVGkGX.jpg",
    "gallery-dashcam-02.jpg": "img-20250909-wa0004-YX4jG96nQohZNJj5.jpg",
    "gallery-dashcam-03.jpg": "img-20250909-wa0008-AoP4z1Ow41Hp9J3p.jpg",
    "gallery-dashcam-04.jpg": "img-20250909-wa0007-dJoP8012lzTRQE54.jpg",
    "gallery-dashcam-05.webp": "img_0248heic-YD0Ea5q8DocWnPKo.webp",
    "gallery-dashcam-06.jpg": "img-20251124-wa0009-3huwsH3A3sDJw2SP.jpg",
    "gallery-dashcam-07.jpg": "whatsapp-image-2025-12-10-at-11.54.38_61469a70-lPzCy7UvXy1JyZ3N.jpg",
    "gallery-dashcam-08.jpg": "whatsapp-image-2025-12-10-at-11.54.38_0176645a-yW3stc7hTsmtpoEl.jpg",
}

ALLOWED_HTML_TAGS = {"p", "strong", "em", "ul", "ol", "li", "h2", "h3", "br"}


class CatalogHtmlSanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        if tag in ALLOWED_HTML_TAGS:
            self.parts.append(f"<{tag}>")

    def handle_endtag(self, tag: str) -> None:
        if tag in ALLOWED_HTML_TAGS and tag != "br":
            self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        self.parts.append(
            data.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        )

    def output(self) -> str:
        return "".join(self.parts).strip()


def fetch_bytes(url: str) -> bytes:
    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "Chrome/124 Safari/537.36 AStarCustomsMigration/1.0"
            )
        },
    )
    with urlopen(request, timeout=60) as response:
        return response.read()


def fetch_json(url: str) -> dict[str, Any]:
    return json.loads(fetch_bytes(url))


def sanitize_html(value: str | None) -> str:
    sanitizer = CatalogHtmlSanitizer()
    sanitizer.feed(value or "")
    return sanitizer.output()


def safe_stem(slug: str) -> str:
    normalized = re.sub(r"[^a-z0-9-]+", "-", slug.lower()).strip("-")
    return normalized or "product"


def extension_for(url: str) -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    return suffix if suffix in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"


def download(url: str, destination: Path, *, overwrite: bool = False) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not overwrite and destination.exists() and destination.stat().st_size > 0:
        return
    destination.write_bytes(fetch_bytes(url))


def fetch_all_products() -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    offset = 0
    limit = 100
    while True:
        url = (
            f"{PRODUCT_API}?order=ASC&sort_by=price&offset={offset}&limit={limit}"
            "&exclude_types=subscription"
        )
        batch = fetch_json(url).get("products", [])
        if not isinstance(batch, list):
            raise RuntimeError("Hostinger product API returned an invalid payload")
        products.extend(batch)
        if len(batch) < limit:
            return products
        offset += limit


def import_catalog(*, refresh_assets: bool) -> list[dict[str, Any]]:
    collection_payload = fetch_json(COLLECTIONS_API)
    collections = {
        item["id"]: item["title"].strip()
        for item in collection_payload.get("collections", [])
    }
    migrated: list[dict[str, Any]] = []

    for product in fetch_all_products():
        slug = product["slug"].strip()
        image_paths: list[str] = []
        for index, image in enumerate(product.get("images", []), start=1):
            source_url = image["url"]
            filename = f"{safe_stem(slug)}-{index:02d}{extension_for(source_url)}"
            download(source_url, PRODUCTS_DIR / filename, overwrite=refresh_assets)
            image_paths.append(f"/images/products/{filename}")

        variants = []
        for variant in product.get("variants", []):
            price = (variant.get("prices") or [{}])[0]
            variants.append(
                {
                    "id": variant["id"],
                    "title": variant["title"].strip(),
                    "price": int(price.get("amount") or 0),
                    "available": bool(variant.get("is_available", True)),
                }
            )

        collection_ids = [
            item["collection_id"] for item in product.get("product_collections", [])
        ]
        migrated.append(
            {
                "id": product["id"],
                "slug": slug,
                "title": product["title"].strip(),
                "subtitle": (product.get("subtitle") or "").strip() or None,
                "ribbonText": (product.get("ribbon_text") or "").strip() or None,
                "descriptionHtml": sanitize_html(product.get("description")),
                "images": image_paths,
                "collectionIds": collection_ids,
                "collections": [
                    collections[item] for item in collection_ids if item in collections
                ],
                "variants": variants,
                "purchasable": bool(product.get("purchasable")),
                "available": bool(product.get("is_available")),
                "updatedAt": product.get("updated_at"),
            }
        )

    migrated.sort(key=lambda product: product["variants"][0]["price"])
    return migrated


def import_site_assets(*, refresh_assets: bool) -> None:
    for local_name, source_name in SITE_ASSETS.items():
        download(
            f"{SITE_ASSET_ROOT}/{source_name}",
            SITE_DIR / local_name,
            overwrite=refresh_assets,
        )

    bebas_url = (
        "https://cdn.zyrosite.com/u1/google-fonts/font-file"
        "?family=Bebas+Neue:wght@400&subset=latin&display=swap"
    )
    download(bebas_url, FONTS_DIR / "bebas-neue.woff2", overwrite=refresh_assets)

    css = fetch_bytes(
        "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap"
    ).decode("utf-8")
    font_urls = re.findall(r"url\((https://[^)]+\.woff2)\)", css)
    if not font_urls:
        raise RuntimeError("Unable to locate Manrope font file")
    download(font_urls[-1], FONTS_DIR / "manrope.woff2", overwrite=refresh_assets)


def write_catalog(catalog: list[dict[str, Any]]) -> None:
    encoded = json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"
    frontend_target = FRONTEND / "src" / "data" / "catalog.json"
    backend_target = BACKEND / "app" / "catalog.json"
    frontend_target.parent.mkdir(parents=True, exist_ok=True)
    backend_target.parent.mkdir(parents=True, exist_ok=True)
    frontend_target.write_text(encoded, encoding="utf-8")
    backend_target.write_text(encoded, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--refresh-assets",
        action="store_true",
        help="Replace existing local media with the latest source bytes.",
    )
    args = parser.parse_args()
    catalog = import_catalog(refresh_assets=args.refresh_assets)
    import_site_assets(refresh_assets=args.refresh_assets)
    write_catalog(catalog)
    print(f"Migrated {len(catalog)} products and {len(SITE_ASSETS)} site assets.")


if __name__ == "__main__":
    main()
