from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from types import SimpleNamespace

import stripe
import pytest
from fastapi.testclient import TestClient

from app.addons import add_ons_for_product, load_add_ons
from app.catalog import load_catalog
from app.config import Settings, get_settings
from app.main import app


client = TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


def single_item_cart() -> dict[str, object]:
    return {
        "items": [
            {
                "productId": "prod_01KFVHY3MK70RA36DKE21WFPNM",
                "variantId": "variant_01KFVHY3PGHQ09EW3812HRKBBZ",
                "quantity": 1,
            }
        ]
    }


def test_checkout_uses_all_trusted_catalog_prices(monkeypatch, tmp_path: Path) -> None:
    captured: dict[str, object] = {}

    def fake_create(**kwargs: object) -> SimpleNamespace:
        captured.update(kwargs)
        return SimpleNamespace(
            id="cs_test_created",
            url="https://checkout.stripe.com/c/pay/test",
        )

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fake_create)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=tmp_path / "orders.db",
    )

    response = client.post(
        "/api/checkout/session",
        json={
            "items": [
                {
                    "productId": "prod_01KFVHY3MK70RA36DKE21WFPNM",
                    "variantId": "variant_01KFVHY3PGHQ09EW3812HRKBBZ",
                    "quantity": 2,
                },
                {
                    "productId": "prod_01K6GY7W0PTTBFMH5DHF9Z75EN",
                    "variantId": "variant_01K6GY7W48DGBZ4D4D9JTD3E54",
                    "quantity": 1,
                    "buildId": "trusted-price-build",
                    "lineType": "base",
                },
                {
                    "productId": "prod_01KCFRCKR5NV5VGCM7ZTKCZ5DE",
                    "variantId": "variant_01KCFRCKV84EMEE32KZB4QF9MK",
                    "quantity": 1,
                    "buildId": "trusted-price-build",
                    "lineType": "addon",
                },
            ]
        },
    )

    assert response.status_code == 200
    response_payload = response.json()
    assert response_payload["url"] == "https://checkout.stripe.com/c/pay/test"
    assert response_payload["orderReference"].startswith("asc_")
    line_items = captured["line_items"]  # type: ignore[assignment]
    assert len(line_items) == 3
    assert line_items[0]["price_data"]["currency"] == "gbp"
    assert line_items[0]["price_data"]["unit_amount"] == 4999
    assert line_items[0]["price_data"]["product_data"]["description"] == (
        "Wireless Carplay Adapter"
    )
    assert line_items[0]["quantity"] == 2
    assert line_items[1]["price_data"]["unit_amount"] == 37499
    assert line_items[1]["price_data"]["product_data"]["description"] == (
        "Ambient Lighting (Universal)"
    )
    assert line_items[1]["quantity"] == 1
    assert line_items[2]["price_data"]["unit_amount"] == 4999
    assert line_items[2]["price_data"]["product_data"]["description"] == (
        "Premium Pack: 25+ Animations & Start-Up Effects (Add-On)"
    )
    assert line_items[2]["quantity"] == 1
    assert captured["cancel_url"] == "http://localhost:5173/checkout"
    assert captured["payment_method_configuration"] == "pmc_test_checkout"
    assert "payment_method_types" not in captured
    assert str(captured["idempotency_key"]).startswith("asc_")
    metadata = captured["metadata"]  # type: ignore[assignment]
    assert metadata["order_reference"] == captured["idempotency_key"]
    assert len(metadata["cart_reference"]) == 20
    assert metadata["line_count"] == "3"
    assert metadata["build_count"] == "1"
    assert captured["shipping_address_collection"] == {"allowed_countries": ["GB"]}
    shipping_rate = captured["shipping_options"][0]["shipping_rate_data"]
    assert shipping_rate["fixed_amount"] == {"amount": 0, "currency": "gbp"}
    with sqlite3.connect(tmp_path / "orders.db") as connection:
        order = connection.execute(
            """
            SELECT stripe_session_id, status, amount_total, currency
            FROM orders
            """
        ).fetchone()
    assert order == ("cs_test_created", "pending", 52496, "gbp")


def test_order_initialization_failure_prevents_stripe_session_creation(
    monkeypatch,
    tmp_path: Path,
) -> None:
    def fail_order_creation(*_: object, **__: object) -> None:
        raise sqlite3.OperationalError("database unavailable")

    def unexpected_stripe_call(**_: object) -> None:
        raise AssertionError("Stripe must not be called before the order exists")

    monkeypatch.setattr("app.main.create_pending_order", fail_order_creation)
    monkeypatch.setattr(
        "app.main.stripe.checkout.Session.create", unexpected_stripe_call
    )
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=tmp_path / "orders.db",
    )

    response = client.post("/api/checkout/session", json=single_item_cart())

    assert response.status_code == 503
    assert response.json() == {
        "detail": "The order could not be initialized. Please try again later."
    }


def test_session_attach_failure_keeps_recoverable_order_reference(
    monkeypatch,
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "orders.db"
    captured: dict[str, object] = {}

    def fake_create(**kwargs: object) -> SimpleNamespace:
        captured.update(kwargs)
        return SimpleNamespace(
            id="cs_test_attach_failure",
            url="https://checkout.stripe.com/c/pay/recoverable",
        )

    def fail_attach(*_: object, **__: object) -> None:
        raise sqlite3.OperationalError("database locked")

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fake_create)
    monkeypatch.setattr("app.main.attach_stripe_session", fail_attach)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=database_path,
    )

    response = client.post("/api/checkout/session", json=single_item_cart())

    assert response.status_code == 503
    with sqlite3.connect(database_path) as connection:
        order = connection.execute(
            "SELECT order_reference, stripe_session_id, status FROM orders"
        ).fetchone()
    metadata = captured["metadata"]  # type: ignore[assignment]
    assert order == (metadata["order_reference"], None, "pending")


def test_stripe_creation_failure_leaves_durable_draft_without_session(
    monkeypatch,
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "orders.db"

    def fail_stripe_create(**_: object) -> None:
        raise stripe.APIConnectionError("provider unavailable")

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fail_stripe_create)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=database_path,
    )

    response = client.post("/api/checkout/session", json=single_item_cart())

    assert response.status_code == 502
    with sqlite3.connect(database_path) as connection:
        order = connection.execute(
            "SELECT stripe_session_id, status FROM orders"
        ).fetchone()
    assert order == (None, "pending")


AMBIENT_BASE = {
    "productId": "prod_01K6GY7W0PTTBFMH5DHF9Z75EN",
    "variantId": "variant_01K6GY7W48DGBZ4D4D9JTD3E54",
}
SPEAKER_ADD_ON = {
    "productId": "prod_01KCFR1PBNK4HHMX64NN0BPCCK",
    "variantId": "variant_01KCFR1PF6SSFRX0GSDM2FDNDH",
}
PREMIUM_ADD_ON = {
    "productId": "prod_01KCFRCKR5NV5VGCM7ZTKCZ5DE",
    "variantId": "variant_01KCFRCKV84EMEE32KZB4QF9MK",
}
PANORAMIC_BASE = {
    "productId": "prod_01KD6GH4TK6C5TEX6AK8PBD4PV",
    "variantId": "variant_01KD6GH4X2KGPC68E2VN6YH25Q",
}


def test_checkout_accepts_stacked_add_ons_on_a_compatible_listing(
    monkeypatch,
    tmp_path: Path,
) -> None:
    captured: dict[str, object] = {}

    def fake_create(**kwargs: object) -> SimpleNamespace:
        captured.update(kwargs)
        return SimpleNamespace(
            id="cs_test_panoramic_build",
            url="https://checkout.stripe.com/c/pay/panoramic-build",
        )

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fake_create)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=tmp_path / "orders.db",
    )

    response = client.post(
        "/api/checkout/session",
        json={
            "items": [
                {
                    **AMBIENT_BASE,
                    "quantity": 1,
                    "buildId": "panoramic-build",
                    "lineType": "base",
                },
                {
                    **SPEAKER_ADD_ON,
                    "quantity": 1,
                    "buildId": "panoramic-build",
                    "lineType": "addon",
                },
                {
                    **PREMIUM_ADD_ON,
                    "quantity": 1,
                    "buildId": "panoramic-build",
                    "lineType": "addon",
                },
            ]
        },
    )

    assert response.status_code == 200
    line_items = captured["line_items"]  # type: ignore[assignment]
    assert [
        item["price_data"]["product_data"]["metadata"]["line_type"]
        for item in line_items
    ] == ["base", "addon", "addon"]


def test_checkout_rejects_add_on_for_an_incompatible_product_family(
    monkeypatch,
    tmp_path: Path,
) -> None:
    def fake_create(**_: object) -> SimpleNamespace:
        return SimpleNamespace(
            id="cs_test_universal_add_on",
            url="https://checkout.stripe.com/c/pay/universal-add-on",
        )

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fake_create)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=tmp_path / "orders.db",
    )
    response = client.post(
        "/api/checkout/session",
        json={
            "items": [
                {
                    **PANORAMIC_BASE,
                    "quantity": 1,
                    "buildId": "unrelated-build",
                    "lineType": "base",
                },
                {
                    **SPEAKER_ADD_ON,
                    "quantity": 1,
                    "buildId": "unrelated-build",
                    "lineType": "addon",
                },
            ]
        },
    )

    assert response.status_code == 409
    assert response.json() == {
        "detail": {
            "code": "BUILD_INVALID",
            "message": "The configured product build is invalid.",
        }
    }


def test_checkout_forwards_grouping_to_line_metadata_and_cart_hash(
    monkeypatch,
    tmp_path: Path,
) -> None:
    sessions: list[dict[str, object]] = []

    def fake_create(**kwargs: object) -> SimpleNamespace:
        sessions.append(kwargs)
        return SimpleNamespace(
            id=f"cs_test_grouped_{len(sessions)}",
            url=f"https://checkout.stripe.com/c/pay/grouped-{len(sessions)}",
        )

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fake_create)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=tmp_path / "orders.db",
    )

    def grouped_cart(first_build_id: str, second_build_id: str) -> dict[str, object]:
        return {
            "items": [
                {
                    **AMBIENT_BASE,
                    "quantity": 1,
                    "buildId": first_build_id,
                    "lineType": "base",
                },
                {
                    **SPEAKER_ADD_ON,
                    "quantity": 1,
                    "buildId": first_build_id,
                    "lineType": "addon",
                },
                {
                    **AMBIENT_BASE,
                    "quantity": 1,
                    "buildId": second_build_id,
                    "lineType": "base",
                },
                {
                    **PREMIUM_ADD_ON,
                    "quantity": 1,
                    "buildId": second_build_id,
                    "lineType": "addon",
                },
            ]
        }

    first_response = client.post(
        "/api/checkout/session",
        json=grouped_cart("build-one", "build-two"),
    )
    second_response = client.post(
        "/api/checkout/session",
        json=grouped_cart("build-three", "build-four"),
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    first_line_items = sessions[0]["line_items"]  # type: ignore[assignment]
    assert first_line_items[0]["price_data"]["product_data"]["metadata"] == {
        "product_id": AMBIENT_BASE["productId"],
        "variant_id": AMBIENT_BASE["variantId"],
        "line_type": "base",
        "build_id": "build-one",
    }
    assert (
        first_line_items[1]["price_data"]["product_data"]["metadata"]["line_type"]
        == "addon"
    )
    first_metadata = sessions[0]["metadata"]  # type: ignore[assignment]
    second_metadata = sessions[1]["metadata"]  # type: ignore[assignment]
    assert first_metadata["build_count"] == "2"
    assert first_metadata["cart_reference"] != second_metadata["cart_reference"]


def test_checkout_preserves_legacy_standalone_payload(
    monkeypatch, tmp_path: Path
) -> None:
    captured: dict[str, object] = {}

    def fake_create(**kwargs: object) -> SimpleNamespace:
        captured.update(kwargs)
        return SimpleNamespace(
            id="cs_test_legacy",
            url="https://checkout.stripe.com/c/pay/legacy",
        )

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fake_create)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=tmp_path / "orders.db",
    )

    response = client.post("/api/checkout/session", json=single_item_cart())

    assert response.status_code == 200
    line_items = captured["line_items"]  # type: ignore[assignment]
    assert line_items[0]["price_data"]["product_data"]["metadata"] == {
        "product_id": "prod_01KFVHY3MK70RA36DKE21WFPNM",
        "variant_id": "variant_01KFVHY3PGHQ09EW3812HRKBBZ",
        "line_type": "standalone",
    }


def test_checkout_rejects_active_add_on_as_standalone() -> None:
    response = client.post(
        "/api/checkout/session",
        json={"items": [{**SPEAKER_ADD_ON, "quantity": 1}]},
    )

    assert response.status_code == 409
    assert response.json() == {
        "detail": {
            "code": "BUILD_INVALID",
            "message": "The configured product build is invalid.",
        }
    }


@pytest.mark.parametrize(
    "items",
    [
        [
            {
                **SPEAKER_ADD_ON,
                "quantity": 1,
                "buildId": "orphan",
                "lineType": "addon",
            }
        ],
        [
            {
                **AMBIENT_BASE,
                "quantity": 1,
                "buildId": "duplicate-base",
                "lineType": "base",
            },
            {
                "productId": "prod_01KRGYB92HFEDJ2669V89535NR",
                "variantId": "variant_01KRGYB95N2F3J300J4DD7WQ1F",
                "quantity": 1,
                "buildId": "duplicate-base",
                "lineType": "base",
            },
        ],
        [
            {
                **AMBIENT_BASE,
                "quantity": 2,
                "buildId": "quantity-mismatch",
                "lineType": "base",
            },
            {
                **SPEAKER_ADD_ON,
                "quantity": 1,
                "buildId": "quantity-mismatch",
                "lineType": "addon",
            },
        ],
        [
            {
                **AMBIENT_BASE,
                "quantity": 1,
                "buildId": "misclassified",
                "lineType": "standalone",
            }
        ],
    ],
)
def test_checkout_rejects_invalid_builds_with_stable_code(
    items: list[dict[str, object]],
) -> None:
    response = client.post("/api/checkout/session", json={"items": items})

    assert response.status_code == 409
    assert response.json() == {
        "detail": {
            "code": "BUILD_INVALID",
            "message": "The configured product build is invalid.",
        }
    }


C_CLASS_BASE = {
    "productId": "prod_01KS68E0X8NM8FT2FXN6S0YXCF",
    "variantId": "variant_01KS68E0Z7ZWA7WJVATE0RXWHR",
}
C_CLASS_ADD_ONS = {
    "dashboard": {
        "productId": "prod_01M43GJ28Z7ED1SAW9MYAME13D",
        "variantId": "variant_01M43GJ28ZTRKDR1ANEY1KMZCA",
    },
    "amg-dashboard": {
        "productId": "prod_01M43GJ290B3KS8X3C92SV2CMZ",
        "variantId": "variant_01M43GJ2908X81YFQ7VCZDN349",
    },
    "front-vents": {
        "productId": "prod_01M43GJ291T7WETX9HJ3W1FZ42",
        "variantId": "variant_01M43GJ2917HQVCPS59DNYW367",
    },
    "front-and-rear-vents": {
        "productId": "prod_01M43GJ2924FAM33VG1SY8JDQN",
        "variantId": "variant_01M43GJ29244258NFEYNSQGNJ0",
    },
    "3d-speakers-front": {
        "productId": "prod_01M43GJ293T2A5MH0FF973DHTB",
        "variantId": "variant_01M43GJ293EN56PSRWEPNCRZVJ",
    },
    "speaker-light-covers": {
        "productId": "prod_01M43GJ2948X0SX0WSST55MJ53",
        "variantId": "variant_01M43GJ294MMHQS10QQPK7PJWP",
    },
}


def build_items(
    base: dict[str, str],
    add_ons: list[dict[str, str]],
    build_id: str = "c-class-build",
) -> list[dict[str, object]]:
    return [
        {**base, "quantity": 1, "buildId": build_id, "lineType": "base"},
        *(
            {**add_on, "quantity": 1, "buildId": build_id, "lineType": "addon"}
            for add_on in add_ons
        ),
    ]


def test_c_class_offers_only_its_six_product_scoped_add_ons() -> None:
    catalog = load_catalog()
    base = catalog[C_CLASS_BASE["productId"]]
    options = add_ons_for_product(load_add_ons(), base.id, base.family)

    prices = {
        option.label: next(
            variant.price
            for variant in catalog[option.productId].variants
            if variant.id == option.variantId
        )
        for option in options
    }
    assert prices == {
        "Dashboard": 17999,
        "AMG Dashboard": 21999,
        "Front vents": 19999,
        "Front and rear vents": 21999,
        "3D speakers (front)": 19999,
        "Speaker light covers (all doors)": 9999,
    }
    assert base.variants[0].price == 39999


def test_allow_listed_ambient_products_keep_the_generic_add_ons() -> None:
    catalog = load_catalog()
    base = catalog[AMBIENT_BASE["productId"]]

    options = add_ons_for_product(load_add_ons(), base.id, base.family)

    assert [option.id for option in options] == [
        "speaker-lights",
        "premium-animation-pack",
    ]


def test_checkout_accepts_c_class_build_with_one_choice_per_exclusive_pair(
    monkeypatch,
    tmp_path: Path,
) -> None:
    captured: dict[str, object] = {}

    def fake_create(**kwargs: object) -> SimpleNamespace:
        captured.update(kwargs)
        return SimpleNamespace(
            id="cs_test_c_class_build",
            url="https://checkout.stripe.com/c/pay/c-class-build",
        )

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fake_create)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=tmp_path / "orders.db",
    )

    response = client.post(
        "/api/checkout/session",
        json={
            "items": build_items(
                C_CLASS_BASE,
                [
                    C_CLASS_ADD_ONS["amg-dashboard"],
                    C_CLASS_ADD_ONS["front-and-rear-vents"],
                    C_CLASS_ADD_ONS["3d-speakers-front"],
                    C_CLASS_ADD_ONS["speaker-light-covers"],
                ],
            )
        },
    )

    assert response.status_code == 200
    line_items = captured["line_items"]  # type: ignore[assignment]
    assert [item["price_data"]["unit_amount"] for item in line_items] == [
        39999,
        21999,
        21999,
        19999,
        9999,
    ]


@pytest.mark.parametrize(
    "items",
    [
        build_items(
            C_CLASS_BASE,
            [C_CLASS_ADD_ONS["dashboard"], C_CLASS_ADD_ONS["amg-dashboard"]],
        ),
        build_items(
            C_CLASS_BASE,
            [C_CLASS_ADD_ONS["front-vents"], C_CLASS_ADD_ONS["front-and-rear-vents"]],
        ),
        build_items(C_CLASS_BASE, [SPEAKER_ADD_ON]),
        build_items(C_CLASS_BASE, [PREMIUM_ADD_ON]),
        build_items(AMBIENT_BASE, [C_CLASS_ADD_ONS["dashboard"]]),
        build_items(AMBIENT_BASE, [C_CLASS_ADD_ONS["speaker-light-covers"]]),
    ],
    ids=[
        "both-dashboards",
        "both-vent-options",
        "generic-speaker-lights-on-c-class",
        "generic-animation-pack-on-c-class",
        "c-class-dashboard-on-other-product",
        "c-class-speaker-covers-on-other-product",
    ],
)
def test_checkout_rejects_inapplicable_or_conflicting_c_class_add_ons(
    items: list[dict[str, object]],
) -> None:
    response = client.post("/api/checkout/session", json={"items": items})

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "BUILD_INVALID"


def test_checkout_rejects_deleted_duplicate_a_class_listing() -> None:
    response = client.post(
        "/api/checkout/session",
        json={
            "items": [
                {
                    "productId": "prod_01KD61YEY0HMGATXME9EGEFCX9",
                    "variantId": "variant_01KR7SZY6F105B69EWSAM62GB8",
                    "quantity": 1,
                }
            ]
        },
    )

    assert response.status_code == 404
    assert "prod_01KD61YEY0HMGATXME9EGEFCX9" not in load_catalog()


# Client audit answers (2026-10-05): per-product add-ons on the BMW, A-Class OEM, Audi
# 2020+ and calipers listings; no generic add-ons on the DIY kits.
SLUG_IDS = {
    product["slug"]: product["id"]
    for product in json.loads(
        (Path(__file__).parents[1] / "app" / "catalog.json").read_text(encoding="utf-8")
    )
}


def catalog_line(slug: str) -> dict[str, str]:
    product = load_catalog()[SLUG_IDS[slug]]
    return {"productId": product.id, "variantId": product.variants[0].id}


BMW_SLUG = "-bmw-f-series-oem-ambient-package"
A_CLASS_OEM_SLUG = "full-oem-ambient-lighting-upgrade-a-class1"
AUDI_UPGRADE_SLUG = "ambient-lighting-upgrade"
BMW_EXTRAS = [
    "bmw-f-series-oem-ambient-tweeter-speakers-add-on",
    "bmw-f-series-oem-ambient-door-speakers-add-on",
    "bmw-f-series-oem-ambient-illuminated-door-handles-add-on",
]
A_CLASS_OEM_EXTRAS = [
    "mercedes-a-class-cla-gla-oem-lighting-vents-add-on",
    "mercedes-a-class-cla-gla-oem-lighting-dashboard-add-on",
    "mercedes-a-class-cla-gla-oem-lighting-speakers-add-on",
]
DIY_KIT_SLUGS = [
    "dual-car-air-vent-ambient-light-kit",
    "mercedes-benz-led-air-vent-kit-vents-for-c-classclagla-2012-2026-front",
    "car-interior-ambient-led-light-kit-audi-q3-2018-current",
    "car-interior-ambient-led-lighting-kit-audi-8y-2012-2020",
    "multi-color-ambient-car-interior-led-kit-audi-8y-2012-2020",
    "car-interior-ambient-light-kit-golf-mk7-mk75-2012-2019",
    "car-ambient-interior-led-light-kit-aclagla-2018-2026",
    "car-led-ambient-light-kit-cla-gla-2018-2026",
]


def offered_prices(slug: str) -> dict[str, int]:
    catalog = load_catalog()
    base = catalog[SLUG_IDS[slug]]
    return {
        option.label: next(
            variant.price
            for variant in catalog[option.productId].variants
            if variant.id == option.variantId
        )
        for option in add_ons_for_product(load_add_ons(), base.id, base.family)
        if option.status == "active"
    }


@pytest.mark.parametrize(
    ("slug", "expected"),
    [
        (
            BMW_SLUG,
            {
                "4x Speaker Lights": 3999,
                "Premium Pack: 25+ Animations & Start-Up Effects": 4999,
                "Tweeter speakers": 14999,
                "Door speakers": 9999,
                "Illuminated door handles": 14999,
            },
        ),
        (A_CLASS_OEM_SLUG, {"Vents": 19999, "Dashboard": 17999, "Speakers": 9999}),
        (
            AUDI_UPGRADE_SLUG,
            {
                "4x Speaker Lights": 3999,
                "Premium Pack: 25+ Animations & Start-Up Effects": 4999,
            },
        ),
        ("calipers", {"Caliper Decals": 3500}),
        ("rims", {}),
        *((slug, {}) for slug in DIY_KIT_SLUGS),
    ],
)
def test_listings_offer_exactly_their_client_approved_add_ons(
    slug: str, expected: dict[str, int]
) -> None:
    assert offered_prices(slug) == expected


def stripe_settings(monkeypatch, tmp_path: Path, captured: dict[str, object]) -> None:
    def fake_create(**kwargs: object) -> SimpleNamespace:
        captured.update(kwargs)
        return SimpleNamespace(
            id="cs_test_audit_build", url="https://checkout.stripe.com/c/pay/audit"
        )

    monkeypatch.setattr("app.main.stripe.checkout.Session.create", fake_create)
    app.dependency_overrides[get_settings] = lambda: Settings(
        stripe_secret_key="sk_test_placeholder",
        stripe_payment_method_configuration_id="pmc_test_checkout",
        stripe_webhook_secret="whsec_test_checkout",
        orders_database_path=tmp_path / "orders.db",
    )


@pytest.mark.parametrize(
    ("base_slug", "add_on_slugs", "expected_amounts"),
    [
        (
            BMW_SLUG,
            [
                "-4x-speaker-lights-optional-add-on",
                "premium-pack-add-on-25-animations-and-start-up-effects",
                *BMW_EXTRAS,
            ],
            [44999, 3999, 4999, 14999, 9999, 14999],
        ),
        (A_CLASS_OEM_SLUG, A_CLASS_OEM_EXTRAS, [89999, 19999, 17999, 9999]),
        (
            AUDI_UPGRADE_SLUG,
            [
                "-4x-speaker-lights-optional-add-on",
                "premium-pack-add-on-25-animations-and-start-up-effects",
            ],
            [79999, 3999, 4999],
        ),
        ("calipers", ["caliper-decals-add-on"], [22499, 3500]),
    ],
    ids=[
        "bmw-all-five",
        "a-class-oem-all-three",
        "audi-upgrade-both",
        "calipers-decals",
    ],
)
def test_checkout_accepts_client_approved_add_on_builds(
    monkeypatch,
    tmp_path: Path,
    base_slug: str,
    add_on_slugs: list[str],
    expected_amounts: list[int],
) -> None:
    captured: dict[str, object] = {}
    stripe_settings(monkeypatch, tmp_path, captured)

    response = client.post(
        "/api/checkout/session",
        json={
            "items": build_items(
                catalog_line(base_slug),
                [catalog_line(slug) for slug in add_on_slugs],
                build_id="audit-build",
            )
        },
    )

    assert response.status_code == 200
    line_items = captured["line_items"]  # type: ignore[assignment]
    assert [
        item["price_data"]["unit_amount"] for item in line_items
    ] == expected_amounts


@pytest.mark.parametrize(
    "items",
    [
        *(
            build_items(catalog_line(slug), [add_on], build_id="diy-build")
            for slug in DIY_KIT_SLUGS
            for add_on in (SPEAKER_ADD_ON, PREMIUM_ADD_ON)
        ),
        build_items(
            catalog_line("ambient-lighting-package-"), [catalog_line(BMW_EXTRAS[0])]
        ),
        build_items(
            catalog_line("car-led-ambient-light-kit-cla-gla-2018-2026"),
            [catalog_line(A_CLASS_OEM_EXTRAS[0])],
        ),
        build_items(catalog_line(A_CLASS_OEM_SLUG), [SPEAKER_ADD_ON]),
        build_items(catalog_line(AUDI_UPGRADE_SLUG), [catalog_line(BMW_EXTRAS[1])]),
        build_items(C_CLASS_BASE, [catalog_line(A_CLASS_OEM_EXTRAS[1])]),
        build_items(catalog_line("rims"), [catalog_line("caliper-decals-add-on")]),
        build_items(catalog_line("caliper-decals-add-on"), [SPEAKER_ADD_ON]),
        [{**catalog_line("caliper-decals-add-on"), "quantity": 1}],
        [{**catalog_line(BMW_EXTRAS[2]), "quantity": 1}],
    ],
)
def test_checkout_rejects_add_ons_the_client_did_not_approve(
    items: list[dict[str, object]],
) -> None:
    response = client.post("/api/checkout/session", json={"items": items})

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "BUILD_INVALID"


def test_checkout_rejects_deleted_duplicate_800_piece_listing() -> None:
    response = client.post(
        "/api/checkout/session",
        json={
            "items": [
                {
                    "productId": "prod_01KCFYNY97DJ0SBEYP5GG6XQ4B",
                    "variantId": "variant_01KCFYNYBVV3KFV4SVMTN1A10Y",
                    "quantity": 1,
                }
            ]
        },
    )

    assert response.status_code == 404
    assert "prod_01KCFYNY97DJ0SBEYP5GG6XQ4B" not in load_catalog()
