"""Fail when the public and server catalog snapshots drift or reference missing media.

Default (the Docker builds): sync, metadata, media, add-on rules and the structural fitment
guards. --ci (the Quality gate and ci:fast) adds the text-against-fitment and duplicate-listing
heuristics, which can need a human decision and so never block a deploy build on their own.
"""

from __future__ import annotations

import argparse
import json
import hashlib
import html
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_CATALOG = ROOT / "frontend" / "src" / "data" / "catalog.json"
BACKEND_CATALOG = ROOT / "backend" / "app" / "catalog.json"
FRONTEND_ADD_ONS = ROOT / "frontend" / "src" / "data" / "add-ons.json"
BACKEND_ADD_ONS = ROOT / "backend" / "app" / "add-ons.json"
PUBLIC_DIR = ROOT / "frontend" / "public"
MEDIA_REVIEW = ROOT / "scripts" / "media-review.json"
GENERIC_ADD_ON_APPROVALS = ROOT / "scripts" / "generic-add-on-approvals.json"
EXCLUSIVE_GROUP_PATTERN = re.compile(r"[a-z0-9][a-z0-9-]*")
PRODUCT_KINDS = {"main", "addon", "upgrade"}
BASE_KINDS = {"main", "upgrade"}  # listings that can carry add-ons
PRODUCT_FAMILIES = {
    "ambient-lighting",
    "starlights",
    "screen-upgrades",
    "dashcams",
    "steering-wheels",
    "rims-calipers",
    "general",
}


def load_json_array(path: Path) -> list[dict[str, Any]]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise ValueError(f"{path} must contain a JSON array")
    return value


# --- Fitment guards -------------------------------------------------------------------------
# These keep a product page from offering, or describing, another vehicle's parts. `covers`
# must match productFitmentsAreCompatible in frontend/src/data/catalog.ts; the browser parity
# suite (frontend/e2e/fitment.spec.ts) checks the frontend against its own copy of the rule.

MERCEDES = "mercedes-benz"
MAKE_ALIASES = {
    "mercedes-benz": MERCEDES,
    "mercedes": MERCEDES,
    "merc": MERCEDES,
    "amg": MERCEDES,
    "bmw": "bmw",
    "audi": "audi",
    "volkswagen": "volkswagen",
    "vw": "volkswagen",
    "ford": "ford",
    "vauxhall": "vauxhall",
    "toyota": "toyota",
    "tesla": "tesla",
    "porsche": "porsche",
    "range rover": "land rover",
    "land rover": "land rover",
    "skoda": "skoda",
    "seat": "seat",
    "cupra": "seat",
    "kia": "kia",
    "hyundai": "hyundai",
    "nissan": "nissan",
    "honda": "honda",
    "lexus": "lexus",
}
MAKE_PATTERN = re.compile(
    r"\b(mercedes-benz|mercedes|merc|amg|bmw|audi|volkswagen|vw|ford|vauxhall|toyota|"
    r"tesla|porsche|range rover|land rover|skoda|cupra|kia|hyundai|nissan|honda|lexus)\b",
    re.IGNORECASE,
)
# Model name -> make. Mercedes "X-Class" names are matched by MERCEDES_CLASS_PATTERN and by
# MERCEDES_SLASH_LIST_PATTERN ("A/B/CLA/GLA"); BMW "N Series" by BMW_SERIES_PATTERN.
MODEL_MAKES = {
    **{
        model: MERCEDES
        for model in (
            "cla",
            "gla",
            "glb",
            "glc",
            "gle",
            "gls",
            "cls",
            "slk",
            "slc",
            "sl",
        )
    },
    **{
        model: "audi"
        for model in (
            *(f"a{n}" for n in range(1, 9)),
            *(f"q{n}" for n in range(2, 9)),
            "tt",
            "r8",
        )
    },
    **{
        model: "volkswagen"
        for model in ("golf", "polo", "passat", "tiguan", "t-roc", "scirocco", "arteon")
    },
}
MODEL_PATTERN = re.compile(
    r"(?<![\w-])("
    + "|".join(sorted(map(re.escape, MODEL_MAKES), key=len, reverse=True))
    + r")\b",
    re.IGNORECASE,
)
# Hyphenated "C-Class" always names a Mercedes; "C Class"/"CClass" needs an upper-case class
# letter and Mercedes context ("a class of its own" is not a car).
MERCEDES_CLASS_PATTERN = re.compile(r"\b([abceglmsv])-class(?:es)?\b", re.IGNORECASE)
MERCEDES_CLASS_LOOSE_PATTERN = re.compile(r"\b([ABCEGLMSV]) ?[Cc]lass(?:es)?\b")
MERCEDES_SLASH_LIST_PATTERN = re.compile(
    r"\b[A-Za-z]{1,3}(?:\s?/\s?[A-Za-z]{1,3})+\b", re.IGNORECASE
)
# "3 Series" is a model; "F-Series" is a chassis generation (F30, F32...). A generation names
# every chassis in it, so it passes only when explicit chassis codes follow it ("F series
# F32/F33"); those codes are then checked as usual.
BMW_SERIES_PATTERN = re.compile(r"\b([1-8]|[efg])([\s-])series\b", re.IGNORECASE)
# Chassis and trim codes look like ordinary part numbers (H264, E27, S100, 8x, Mk2), so each
# counts only with its make's context within VEHICLE_CONTEXT_WINDOW characters (see `near`).
MERCEDES_CODE_PATTERN = re.compile(r"\b([wcxvahrs])(\d{3})\b", re.IGNORECASE)
BMW_CHASSIS_PATTERN = re.compile(r"\b([efg]\d{2})\b", re.IGNORECASE)
# Audi platform codes (Typ 8L/8P/8V/8Y A3, 8K/8W A4, 8T/8F A5, 8R/8U Q5/Q3, 8J/8S TT). 8X
# (A1) is left out: "8x" is far more often a count.
AUDI_CHASSIS_PATTERN = re.compile(r"\b(8[lpvykwtfrujs])\b", re.IGNORECASE)
VW_GENERATION_PATTERN = re.compile(r"\b(mk\s?\d(?:\.\d{1,2})?)\b", re.IGNORECASE)
VEHICLE_CONTEXT_WINDOW = 80
MAKE_CONTEXT = {
    MERCEDES: re.compile(
        r"\b(?:mercedes|merc|benz|amg|[abceglmsv]-class|cla|gla|glb|glc|gle|gls|cls|slk|slc)\b",
        re.IGNORECASE,
    ),
    "bmw": re.compile(r"\b(?:bmw|[1-8efg]-series)\b", re.IGNORECASE),
    "audi": re.compile(r"\baudi\b", re.IGNORECASE),
    "volkswagen": re.compile(
        r"\b(?:volkswagen|vw|golf|polo|passat|tiguan|t-roc|scirocco|arteon)\b",
        re.IGNORECASE,
    ),
}
# Model names that are also everyday words or sizes; they need their make's context.
AMBIGUOUS_MODELS = {
    "sl",
    *(f"a{n}" for n in range(1, 9)),
    *(f"q{n}" for n in range(2, 9)),
    "tt",
    "r8",
    "golf",
    "polo",
    "passat",
    "tiguan",
    "t-roc",
    "scirocco",
    "arteon",
}
GENERIC_FITMENT_CLAIM = re.compile(
    r"\b(most (?:car )?models|most (?:cars|vehicles)|any (?:car|vehicle)|all (?:cars|vehicles)"
    r"|fits all|universal(?:ly)?)\b",
    re.IGNORECASE,
)
HTML_TAG = re.compile(r"<[^>]+>")
# "not CLA or GLA", "not C-Class", "not for the A-Class, CLA or GLA": the names right after
# "not" are ones the listing does NOT fit. A name there is excused only when it is also outside
# the fitment (see text_terms_outside_fitment). The list is one name, or names joined by commas
# and closed by "or"/"nor"; it stops at any make word and at clause words ("and", "also",
# "supported", "fits"...), so "not GLA and BMW 3 Series also fits" negates only GLA.
_MAKE_WORDS = (
    r"mercedes(?:-benz)?|merc|benz|amg|bmw|audi|volkswagen|vw|ford|vauxhall|toyota|tesla"
    r"|porsche|range\s+rover|land\s+rover|skoda|seat|cupra|kia|hyundai|nissan|honda|lexus"
)
_CLAUSE_WORDS = r"also|and|but|or|nor|fits?|fitted|supported|with|for|including|plus"
_NEGATED_NAME = (
    rf"(?!(?i:{_MAKE_WORDS}|{_CLAUSE_WORDS})\b)[A-Z0-9][\w-]*"
    rf"(?:/(?!(?i:{_MAKE_WORDS})\b)[A-Z0-9][\w-]*)*"
)
NEGATED_NAMES = re.compile(
    rf"\b[Nn]ot\s+(?:for\s+)?(?:the\s+)?(?P<names>{_NEGATED_NAME}"
    rf"(?:(?:\s*,\s*{_NEGATED_NAME})*\s+(?:or|nor)\s+{_NEGATED_NAME})?)"
)
# "Tweeter Speakers – £149.99", "Dashboard: +£179.99": a price right after an add-on's label.
COPY_PRICE = re.compile(r"\s*[:–—-]?\s*\+?\s*£\s?(\d[\d,]*(?:\.\d{2})?)")

# Text that names a vehicle outside the listing's fitment while the client confirms what the
# product fits. Each entry lists the exact terms it excuses; any other hit still fails, and an
# entry whose terms no longer appear fails so it is removed once the listing is fixed.
KNOWN_TEXT_EXCEPTIONS: dict[str, dict[str, Any]] = {}

# Same-family listings at the same price that look like one product listed twice. Each pair
# waits on the client deciding whether to merge or differentiate them.
DUPLICATE_ALLOWLIST: dict[frozenset[str], str] = {
    frozenset(
        {
            "car-interior-ambient-led-lighting-kit-audi-8y-2012-2020",
            "multi-color-ambient-car-interior-led-kit-audi-8y-2012-2020",
        }
    ): (
        "Two Audi A3 8V/8Y kits with the same fitment and price: client confirmed distinct "
        "products (2026-10-05)."
    ),
    frozenset(
        {
            "car-led-ambient-light-kit-cla-gla-2018-2026",
            "car-ambient-interior-led-light-kit-aclagla-2018-2026",
        }
    ): (
        "Pending client question on duplicates: the CLA/GLA kit is the A/CLA/GLA kit at the "
        "same price minus the A-Class; merge them or say how they differ."
    ),
    frozenset({"standard-starlights-700-pieces-", "twinkle-starlight-550-pieces"}): (
        "Not a duplicate: a 700-piece standard and a 550-piece twinkle starlight that happen "
        "to cost the same. Confirm-first, no vehicle named."
    ),
}


def _values(values: list[str]) -> set[str]:
    return {value.strip().lower() for value in values}


def covers(base: dict[str, Any], candidate: dict[str, Any]) -> bool:
    """True when `candidate` is known to fit every vehicle `base` is sold for.

    Model years are not compared: the catalogue has no year field yet (it waits for the
    client's data), so listings for the same make/model/chassis count as fitting each other.
    Mirrors productFitmentsAreCompatible in frontend/src/data/catalog.ts."""
    base_fit, cand_fit = base["fitment"], candidate["fitment"]
    if cand_fit["mode"] == "universal":
        return True
    cand_makes = _values(cand_fit["makes"])
    if not cand_makes and cand_fit["mode"] == "confirm":
        return True
    base_makes = _values(base_fit["makes"])
    if not base_makes or not base_makes <= cand_makes:
        return False
    base_models, cand_models = _values(base_fit["models"]), _values(cand_fit["models"])
    if not cand_models:
        return not base_models
    if not base_models or not base_models <= cand_models:
        return False
    cand_chassis = _values(cand_fit["chassisCodes"])
    if not cand_chassis:
        return True
    base_chassis = _values(base_fit["chassisCodes"])
    return bool(base_chassis) and base_chassis <= cand_chassis


def sellable(product: dict[str, Any]) -> bool:
    return product["purchasable"] is True and product["available"] is True


def minimum_price(product: dict[str, Any]) -> int:
    prices = [
        variant["price"] for variant in product["variants"] if variant["price"] > 0
    ]
    return min(prices, default=0)


def add_on_options(
    base: dict[str, Any],
    add_ons: list[dict[str, Any]],
    products_by_id: dict[str, dict[str, Any]],
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    """Port of getProductAddOnOptions: the (definition, add-on product) pairs on sale. A
    main or upgrade listing gets every add-on of its family scoped to it or family-wide."""
    if base["kind"] == "addon":
        return []
    matching = [
        add_on
        for add_on in add_ons
        if base["family"] in add_on["appliesToFamilies"]
        and (
            add_on.get("appliesToProducts") is None
            or base["id"] in add_on["appliesToProducts"]
        )
    ]
    options = []
    for add_on in matching:
        product = products_by_id.get(add_on["productId"] or "")
        variant = next(
            (
                v
                for v in (product or {}).get("variants", [])
                if v["id"] == add_on["variantId"]
            ),
            None,
        )
        if (
            add_on["status"] == "active"
            and product is not None
            and sellable(product)
            and variant is not None
            and variant["available"]
            and variant["price"] > 0
        ):
            options.append((add_on, product))
    return options


def discovery_candidates(
    base: dict[str, Any], catalog: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """getDiscoveryProducts' filter minus its fitment check: every standalone offer on sale."""
    return [
        candidate
        for candidate in catalog
        if candidate["id"] != base["id"]
        and candidate["kind"] != "addon"
        and sellable(candidate)
    ]


def discovery_products(
    base: dict[str, Any], catalog: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Port of getDiscoveryProducts: the standalone offers shown on a product page."""
    if base["kind"] != "main":
        return []
    admitted = [
        candidate
        for candidate in discovery_candidates(base, catalog)
        if covers(base, candidate)
    ]
    upgrades = [candidate for candidate in admitted if candidate["kind"] == "upgrade"]
    # One slot per family, except starlights: the first-listed DIY kit (currently the cheapest) and one fitted package.
    seen_slots: set[str] = set()
    diverse = []
    for candidate in admitted:
        if candidate["kind"] != "main":
            continue
        slot = (
            "starlights-diy"
            if candidate["family"] == "starlights" and "DIY" in candidate["collections"]
            else candidate["family"]
        )
        if slot not in seen_slots:
            seen_slots.add(slot)
            diverse.append(candidate)
    return [*upgrades, *diverse][:6]


def _vehicles(fitment: dict[str, Any]) -> set[tuple[str, str | None, str | None]]:
    """The (make, model, chassis) combinations a fitment names; None where it names none."""
    return {
        (make, model, chassis)
        for make in _values(fitment["makes"])
        for model in (_values(fitment["models"]) or {None})
        for chassis in (_values(fitment["chassisCodes"]) or {None})
    }


def fits_every_vehicle(base: dict[str, Any], candidate: dict[str, Any]) -> bool:
    """Independent statement of the rule `covers` implements, vehicle by vehicle, so guard 2
    still fails if `covers` (or its TypeScript twin) is loosened. Model years are not compared:
    the catalogue has no year field yet."""
    fit = candidate["fitment"]
    if fit["mode"] == "universal" or (fit["mode"] == "confirm" and not fit["makes"]):
        return True
    vehicles = _vehicles(base["fitment"])
    makes, models = _values(fit["makes"]), _values(fit["models"])
    chassis = _values(fit["chassisCodes"])
    return bool(vehicles) and all(
        make in makes
        and (model in models if models else model is None)
        and (not chassis or vehicle_chassis in chassis)
        for make, model, vehicle_chassis in vehicles
    )


def listing_text(product: dict[str, Any]) -> str:
    """The listing's customer-facing text."""
    parts = [
        product.get("title"),
        product.get("subtitle"),
        product.get("ribbonText"),
        product["fitment"]["label"],
        html.unescape(HTML_TAG.sub(" ", product.get("descriptionHtml") or "")),
    ]
    return " ".join(part for part in parts if part)


def near(text: str, start: int, end: int, make: str) -> bool:
    """True when `make`'s context appears within VEHICLE_CONTEXT_WINDOW characters of the match
    at text[start:end], not counting the match itself (so "golf" alone is not its own context).
    Audi models and Audi platform codes vouch for each other ("A3 8V"), as do VW models and Mk
    generations ("Golf Mk7")."""
    lo = max(0, start - VEHICLE_CONTEXT_WINDOW)
    window = text[lo : end + VEHICLE_CONTEXT_WINDOW]
    patterns = [MAKE_CONTEXT[make]]
    if make == "audi":
        patterns += [AUDI_CHASSIS_PATTERN, MODEL_PATTERN]
    elif make == "volkswagen":
        patterns.append(VW_GENERATION_PATTERN)
    for pattern in patterns:
        for match in pattern.finditer(window):
            if lo + match.start() < end and lo + match.end() > start:
                continue  # the match itself
            if pattern is MODEL_PATTERN and MODEL_MAKES[match.group(1).lower()] != make:
                continue
            return True
    return False


def vehicle_term_spans(text: str) -> list[tuple[str, int, int]]:
    """Every make, model and chassis code the text names, as ('make:x' | 'model:make/x' |
    'chassis:x' | 'generation:bmw/f', start, end), one entry per occurrence. A BMW generation
    ("F-Series") is named only when no chassis code of that generation follows it.

    Ambiguous tokens (part-number-shaped codes, model names that are also words) count only
    near their make's context; see MAKE_CONTEXT and VEHICLE_CONTEXT_WINDOW. In Mercedes
    context, a class letter plus a number ending in 0 (C200, C300, E220, A180) is a trim of
    that class and is read as the class; any other letter-and-three-digit code (W205, C205,
    X156) is a chassis code.
    """
    terms: list[tuple[str, int, int]] = [
        (f"make:{MAKE_ALIASES[m.group(1).lower()]}", m.start(), m.end())
        for m in MAKE_PATTERN.finditer(text)
    ]

    def add(term: str, match: re.Match[str]) -> None:
        terms.append((term, match.start(), match.end()))

    for match in MODEL_PATTERN.finditer(text):
        model = match.group(1).lower()
        make = MODEL_MAKES[model]
        if model in AMBIGUOUS_MODELS and not near(
            text, match.start(), match.end(), make
        ):
            continue
        add(f"model:{make}/{model}", match)
    for match in MERCEDES_CLASS_PATTERN.finditer(text):
        add(f"model:{MERCEDES}/{match.group(1).lower()}-class", match)
    for match in MERCEDES_CLASS_LOOSE_PATTERN.finditer(text):
        if near(text, match.start(), match.end(), MERCEDES):
            add(f"model:{MERCEDES}/{match.group(1).lower()}-class", match)
    for match in MERCEDES_SLASH_LIST_PATTERN.finditer(text):
        tokens = [token.strip().lower() for token in match.group(0).split("/")]
        if any(MODEL_MAKES.get(token) == MERCEDES for token in tokens):
            for token in tokens:
                if token in set("abceglmsv"):
                    add(f"model:{MERCEDES}/{token}-class", match)
    for match in BMW_SERIES_PATTERN.finditer(text):
        if match.group(2) == "-" or near(text, match.start(), match.end(), "bmw"):
            series = match.group(1).lower()
            if series not in "efg":
                add(f"model:bmw/{series}-series", match)
            elif not re.match(
                rf"\s*[/,(:]?\s*{series}\d{{2}}\b", text[match.end() :], re.IGNORECASE
            ):
                add(f"generation:bmw/{series}", match)
    for match in MERCEDES_CODE_PATTERN.finditer(text):
        if not near(text, match.start(), match.end(), MERCEDES):
            continue
        letter, number = match.group(1).lower(), match.group(2)
        if letter in "abcegs" and number.endswith("0"):
            add(f"model:{MERCEDES}/{letter}-class", match)
        else:
            add(f"chassis:{letter}{number}", match)
    for pattern, make in (
        (BMW_CHASSIS_PATTERN, "bmw"),
        (AUDI_CHASSIS_PATTERN, "audi"),
        (VW_GENERATION_PATTERN, "volkswagen"),
    ):
        for match in pattern.finditer(text):
            if near(text, match.start(), match.end(), make):
                add("chassis:" + match.group(1).lower().replace(" ", ""), match)
    return terms


def vehicle_terms(text: str) -> set[str]:
    """The distinct terms of vehicle_term_spans."""
    return {term for term, _, _ in vehicle_term_spans(text)}


def split_negated_terms(text: str) -> tuple[set[str], set[str]]:
    """(terms named outside any "not ..." list, terms named inside one)."""
    negated_spans = [m.span("names") for m in NEGATED_NAMES.finditer(text)]
    positive, negated = set(), set()
    for term, start, end in vehicle_term_spans(text):
        inside = any(lo <= start and end <= hi for lo, hi in negated_spans)
        (negated if inside else positive).add(term)
    return positive, negated


def terms_outside_fitment(product: dict[str, Any], terms: set[str]) -> set[str]:
    fitment = product["fitment"]
    makes, models = _values(fitment["makes"]), _values(fitment["models"])
    chassis = _values(fitment["chassisCodes"])
    outside = set()
    for term in terms:
        kind, _, value = term.partition(":")
        if kind == "make" and value not in makes:
            outside.add(term)
        elif kind == "model":
            make, _, model = value.partition("/")
            if make not in makes or model not in models:
                outside.add(term)
        elif kind == "chassis" and value not in chassis:
            outside.add(term)
        elif kind == "generation":
            # A bare generation ("all BMW F-Series") claims every chassis in it, which no
            # fitment lists; name the chassis codes instead.
            outside.add(term)
    return outside


def text_terms_outside_fitment(product: dict[str, Any]) -> set[str]:
    """Vehicle terms in the listing's text that its fitment does not back. A name in a
    "not ..." list is skipped only when it is also outside the fitment; one inside the fitment
    contradicts it and is reported as 'not <term>'."""
    positive, negated = split_negated_terms(listing_text(product))
    if not product["fitment"]["makes"]:
        return positive
    negated_outside = terms_outside_fitment(product, negated)
    return terms_outside_fitment(product, positive) | {
        f"not {term}" for term in negated - negated_outside
    }


def _copy_text(value: str) -> str:
    text = html.unescape(HTML_TAG.sub(" ", value)).replace("&", "and")
    return re.sub(r"\s+", " ", text)


def copy_price_mismatches(
    base: dict[str, Any],
    add_ons: list[dict[str, Any]],
    products_by_id: dict[str, dict[str, Any]],
) -> list[str]:
    """Prices the base listing's copy quotes for its add-ons ("Tweeter Speakers – £149.99")
    that differ from the add-on's catalogue price. Longer labels are matched first, so
    "AMG Dashboard" is not read as "Dashboard"."""
    text = _copy_text(base.get("descriptionHtml") or "")
    taken: list[tuple[int, int]] = []
    problems = []
    options = sorted(
        add_on_options(base, add_ons, products_by_id),
        key=lambda option: len(option[0]["label"]),
        reverse=True,
    )
    for add_on, product in options:
        label = _copy_text(add_on["label"]).strip()
        price = next(
            v["price"] for v in product["variants"] if v["id"] == add_on["variantId"]
        )
        pattern = re.compile(rf"(?<!\w){re.escape(label)}(?!\w)", re.IGNORECASE)
        for match in pattern.finditer(text):
            if any(lo < match.end() and match.start() < hi for lo, hi in taken):
                continue
            taken.append(match.span())
            quoted = COPY_PRICE.match(text, match.end())
            if not quoted:
                continue
            pence = round(float(quoted.group(1).replace(",", "")) * 100)
            if pence != price:
                problems.append(
                    f"{base['slug']} copy prices {add_on['label']} at £{quoted.group(1)}, "
                    f"but the add-on costs £{price / 100:.2f}."
                )
    return problems


def check_fitment_guards(
    catalog: list[dict[str, Any]],
    add_ons: list[dict[str, Any]],
    heuristics: bool = True,
) -> None:
    """Guards 1 and 2 are structural and always run (the Docker builds run them). Guards 3 and
    4 are text and duplicate heuristics that only the Quality gate runs (`--ci`)."""
    errors: list[str] = []
    warnings: list[str] = []
    products_by_id = {product["id"]: product for product in catalog}
    bases = [product for product in catalog if product["kind"] != "addon"]

    # 1. Add-ons: a vehicle-specific add-on must fit every vehicle of its base; a generic
    #    (confirm-first, no make) add-on on a vehicle-specific base needs an explicit approval.
    approvals = load_json_array(GENERIC_ADD_ON_APPROVALS)
    approved = {(entry.get("addOnId"), entry.get("baseSlug")) for entry in approvals}
    if len(approved) != len(approvals) or any(
        not str(entry.get("note", "")).strip() for entry in approvals
    ):
        errors.append(
            f"{GENERIC_ADD_ON_APPROVALS.name}: duplicate or unexplained entries."
        )
    used_approvals = set()
    for base in bases:
        for add_on, product in add_on_options(base, add_ons, products_by_id):
            pair = (add_on["id"], base["slug"])
            if product["fitment"]["makes"] and not covers(base, product):
                errors.append(
                    f"add-on {add_on['id']} does not fit every vehicle of {base['slug']}."
                )
            elif (
                not product["fitment"]["makes"]
                and product["fitment"]["mode"] == "confirm"
                and base["fitment"]["makes"]
            ):
                if pair in approved:
                    used_approvals.add(pair)
                else:
                    errors.append(
                        f"generic add-on {add_on['id']} on vehicle-specific {base['slug']} has "
                        f"no entry in {GENERIC_ADD_ON_APPROVALS.name}."
                    )
    errors.extend(
        f"{GENERIC_ADD_ON_APPROVALS.name}: stale approval {add_on_id} on {slug}."
        for add_on_id, slug in sorted(approved - used_approvals, key=str)
    )

    # 2. Discovery (main listings only): every offer the product page shows (the port, which filters the candidates
    #    with `covers`) must fit every vehicle of the page by the independent rule.
    for base in (product for product in bases if product["kind"] == "main"):
        offered = discovery_products(base, catalog)
        candidate_ids = {c["id"] for c in discovery_candidates(base, catalog)}
        errors.extend(
            f"discovery offers {candidate['slug']} on {base['slug']}, which it does not fit."
            for candidate in offered
            if candidate["id"] not in candidate_ids
            or not fits_every_vehicle(base, candidate)
        )

    if not heuristics:
        _report(errors, warnings)
        return

    # 3. Text against fitment.
    used_exceptions: dict[str, set[str]] = {}
    for product in catalog:
        slug = product["slug"]
        text = listing_text(product)
        bad = text_terms_outside_fitment(product)
        if not product["fitment"]["makes"]:
            problem = "is not vehicle-specific but its text names"
        else:
            problem = "text names vehicles outside its fitment:"
            claim = GENERIC_FITMENT_CLAIM.search(text)
            if claim:
                errors.append(
                    f"{slug} is vehicle-specific but its text says '{claim.group(0)}'."
                )
        excused = KNOWN_TEXT_EXCEPTIONS.get(slug, {}).get("terms", set())
        used_exceptions[slug] = bad & excused
        if bad - excused:
            errors.append(f"{slug} {problem} {', '.join(sorted(bad - excused))}.")
    for slug, exception in KNOWN_TEXT_EXCEPTIONS.items():
        stale = exception["terms"] - used_exceptions.get(slug, set())
        if stale:
            errors.append(
                f"KNOWN_TEXT_EXCEPTIONS[{slug!r}] is stale ({', '.join(sorted(stale))}); remove it."
            )

    # 4. Prices quoted in a listing's copy for its add-ons match the add-ons' prices.
    for base in bases:
        errors.extend(copy_price_mismatches(base, add_ons, products_by_id))

    # 5. Duplicates among sellable listings.
    listings = [p for p in catalog if p["kind"] != "addon" and sellable(p)]
    used_allowlist = set()
    for index, first in enumerate(listings):
        for second in listings[index + 1 :]:
            if first["family"] != second["family"]:
                continue
            if minimum_price(first) != minimum_price(second):
                continue
            pair = frozenset({first["slug"], second["slug"]})
            same = _fitment_key(first) == _fitment_key(second)
            subset = not same and (
                (first["fitment"]["makes"] and covers(first, second))
                or (second["fitment"]["makes"] and covers(second, first))
            )
            if pair in DUPLICATE_ALLOWLIST:
                used_allowlist.add(pair)
            elif same:
                errors.append(
                    f"possible duplicate listing: {' and '.join(sorted(pair))} share family, "
                    "fitment and price."
                )
            elif subset:
                warnings.append(
                    f"possible duplicate listing: {' and '.join(sorted(pair))} share family and "
                    "price, and one fitment contains the other."
                )
    errors.extend(
        f"DUPLICATE_ALLOWLIST entry {' and '.join(sorted(pair))} is stale; remove it."
        for pair in DUPLICATE_ALLOWLIST
        if pair not in used_allowlist
    )

    _report(errors, warnings)


def _report(errors: list[str], warnings: list[str]) -> None:
    for warning in warnings:
        print(f"Catalog check warning: {warning}")
    if errors:
        raise SystemExit(
            "Catalog check failed:\n" + "\n".join(f"- {e}" for e in errors)
        )


def _fitment_key(product: dict[str, Any]) -> tuple[Any, ...]:
    fitment = product["fitment"]
    return (
        fitment["mode"],
        *(
            frozenset(_values(fitment[key]))
            for key in ("makes", "models", "chassisCodes")
        ),
    )


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--ci",
        action="store_true",
        help="also run the text-against-fitment and duplicate-listing heuristics",
    )
    args = parser.parse_args(argv)
    frontend = load_json_array(FRONTEND_CATALOG)
    backend = load_json_array(BACKEND_CATALOG)
    if frontend != backend:
        raise SystemExit("Catalog check failed: frontend and backend snapshots differ.")

    frontend_add_ons = load_json_array(FRONTEND_ADD_ONS)
    backend_add_ons = load_json_array(BACKEND_ADD_ONS)
    if frontend_add_ons != backend_add_ons:
        raise SystemExit(
            "Catalog check failed: frontend and backend add-on configs differ."
        )

    product_ids: set[str] = set()
    products_by_id: dict[str, dict[str, Any]] = {}
    slugs: set[str] = set()
    variant_ids: set[str] = set()
    variants_by_product_id: dict[str, set[str]] = {}
    missing_images: list[str] = []
    media_keys: set[str] = set()

    for product in frontend:
        product_id = product.get("id")
        slug = product.get("slug")
        if not isinstance(product_id, str) or not product_id:
            raise SystemExit("Catalog check failed: a product has no valid ID.")
        if not isinstance(slug, str) or not slug:
            raise SystemExit(
                f"Catalog check failed: product {product_id} has no valid slug."
            )
        if product_id in product_ids or slug in slugs:
            raise SystemExit(
                f"Catalog check failed: duplicate product ID or slug at {slug}."
            )
        product_ids.add(product_id)
        products_by_id[product_id] = product
        slugs.add(slug)

        kind = product.get("kind")
        family = product.get("family")
        fitment = product.get("fitment")
        media_key = product.get("mediaKey")
        comparison_group = product.get("comparisonGroup")
        spec_tier = product.get("specTier")
        if kind not in PRODUCT_KINDS or family not in PRODUCT_FAMILIES:
            raise SystemExit(f"Catalog check failed: invalid classification in {slug}.")
        if (
            not isinstance(fitment, dict)
            or fitment.get("mode") not in {"universal", "specific", "confirm"}
            or not isinstance(fitment.get("label"), str)
            or not fitment["label"].strip()
            or any(
                not isinstance(fitment.get(key), list)
                for key in ("makes", "models", "chassisCodes")
            )
        ):
            raise SystemExit(
                f"Catalog check failed: invalid fitment metadata in {slug}."
            )
        if not isinstance(media_key, str) or not media_key:
            raise SystemExit(f"Catalog check failed: missing media key in {slug}.")
        if media_key in media_keys:
            raise SystemExit(f"Catalog check failed: duplicate media key {media_key}.")
        media_keys.add(media_key)
        if fitment["mode"] == "specific" and (
            not fitment["makes"] or not fitment["models"]
        ):
            raise SystemExit(
                f"Catalog check failed: specific fitment lacks make/model in {slug}."
            )
        if (comparison_group is None) != (spec_tier is None):
            raise SystemExit(
                f"Catalog check failed: incomplete comparison metadata in {slug}."
            )
        if comparison_group is not None and (
            not isinstance(comparison_group, str)
            or not comparison_group
            or not isinstance(spec_tier, int)
            or spec_tier < 0
        ):
            raise SystemExit(
                f"Catalog check failed: invalid comparison metadata in {slug}."
            )

        variants = product.get("variants")
        if not isinstance(variants, list) or not variants:
            raise SystemExit(f"Catalog check failed: product {slug} has no variants.")
        product_variant_ids: set[str] = set()
        for variant in variants:
            variant_id = variant.get("id")
            price = variant.get("price")
            if not isinstance(variant_id, str) or variant_id in variant_ids:
                raise SystemExit(
                    f"Catalog check failed: invalid or duplicate variant in {slug}."
                )
            if not isinstance(price, int) or price < 0:
                raise SystemExit(f"Catalog check failed: invalid price in {slug}.")
            variant_ids.add(variant_id)
            product_variant_ids.add(variant_id)
        variants_by_product_id[product_id] = product_variant_ids

        images = product.get("images")
        if not isinstance(images, list) or not images:
            raise SystemExit(f"Catalog check failed: product {slug} has no images.")
        for image in images:
            if not isinstance(image, str) or not image.startswith("/"):
                raise SystemExit(f"Catalog check failed: invalid image path in {slug}.")
            if not (PUBLIC_DIR / image.lstrip("/")).is_file():
                missing_images.append(image)
            if not Path(image).stem.startswith(f"{media_key}-"):
                raise SystemExit(
                    f"Catalog check failed: image {image} does not match media key {media_key}."
                )

    if missing_images:
        raise SystemExit(
            "Catalog check failed: missing images:\n"
            + "\n".join(sorted(set(missing_images)))
        )

    media_review = load_json_array(MEDIA_REVIEW)
    reviews_by_product_id = {entry.get("productId"): entry for entry in media_review}
    if (
        len(reviews_by_product_id) != len(media_review)
        or set(reviews_by_product_id) != product_ids
    ):
        raise SystemExit(
            "Catalog check failed: media review manifest must contain every product exactly once."
        )
    for product_id, product in products_by_id.items():
        review = reviews_by_product_id[product_id]
        if (
            review.get("mediaKey") != product["mediaKey"]
            or review.get("fitment") != product["fitment"]
            or not isinstance(review.get("reviewBasis"), str)
            or not review["reviewBasis"].strip()
        ):
            raise SystemExit(
                f"Catalog check failed: stale media review metadata for {product_id}."
            )
        reviewed_images = review.get("images")
        if (
            not isinstance(reviewed_images, list)
            or [entry.get("path") for entry in reviewed_images] != product["images"]
        ):
            raise SystemExit(
                f"Catalog check failed: media review image list drifted for {product_id}."
            )
        for reviewed_image in reviewed_images:
            image_path = PUBLIC_DIR / reviewed_image["path"].lstrip("/")
            digest = hashlib.sha256(image_path.read_bytes()).hexdigest()
            if reviewed_image.get("sha256") != digest:
                raise SystemExit(
                    f"Catalog check failed: reviewed media bytes changed at {reviewed_image['path']}."
                )

    add_on_ids: set[str] = set()
    active_add_on_variants: set[tuple[str, str]] = set()
    exclusive_group_sizes: dict[str, int] = {}
    for add_on in frontend_add_ons:
        add_on_id = add_on.get("id")
        status = add_on.get("status")
        label = add_on.get("label")
        description = add_on.get("description")
        product_id = add_on.get("productId")
        variant_id = add_on.get("variantId")

        if not isinstance(add_on_id, str) or not add_on_id or add_on_id in add_on_ids:
            raise SystemExit("Catalog check failed: invalid or duplicate add-on ID.")
        add_on_ids.add(add_on_id)
        if status not in {"active", "disabled"}:
            raise SystemExit(
                f"Catalog check failed: invalid status for add-on {add_on_id}."
            )
        if not isinstance(label, str) or not label.strip():
            raise SystemExit(f"Catalog check failed: add-on {add_on_id} has no label.")
        if not isinstance(description, str) or not description.strip():
            raise SystemExit(
                f"Catalog check failed: add-on {add_on_id} has no description."
            )
        applicable_families = add_on.get("appliesToFamilies")
        if "appliesToProducts" in add_on:
            applicable_products = add_on["appliesToProducts"]
            if (
                not isinstance(applicable_products, list)
                or not applicable_products
                or len(set(map(str, applicable_products))) != len(applicable_products)
                or not isinstance(applicable_families, list)
                or any(
                    not isinstance(base_id, str)
                    or products_by_id.get(base_id, {}).get("kind") not in BASE_KINDS
                    or products_by_id[base_id].get("family") not in applicable_families
                    for base_id in applicable_products
                )
            ):
                raise SystemExit(
                    f"Catalog check failed: add-on {add_on_id} targets invalid base products."
                )
        if "exclusiveGroup" in add_on:
            exclusive_group = add_on["exclusiveGroup"]
            if not isinstance(
                exclusive_group, str
            ) or not EXCLUSIVE_GROUP_PATTERN.fullmatch(exclusive_group):
                raise SystemExit(
                    f"Catalog check failed: add-on {add_on_id} has an invalid exclusive group."
                )
            exclusive_group_sizes[exclusive_group] = (
                exclusive_group_sizes.get(exclusive_group, 0) + 1
            )
        if status == "active" and "appliesToProducts" not in add_on:
            # Family-wide add-ons would reach every listing of the family (the C-Class
            # included), so each active add-on names the listings it is offered on.
            raise SystemExit(
                f"Catalog check failed: active add-on {add_on_id} has no appliesToProducts."
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
            add_on_product.get("kind") != "addon"
            or not isinstance(applicable_families, list)
            or not applicable_families
            or not set(applicable_families).issubset(PRODUCT_FAMILIES)
            or add_on_product.get("purchasable") is not True
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

    if any(size < 2 for size in exclusive_group_sizes.values()):
        raise SystemExit(
            "Catalog check failed: every add-on exclusive group needs at least two members."
        )

    check_fitment_guards(frontend, frontend_add_ons, heuristics=args.ci)

    guards = (
        "fitment guards"
        if args.ci
        else "structural fitment guards (no --ci heuristics)"
    )
    print(
        f"Catalog check passed: {len(frontend)} products, "
        f"{len(variant_ids)} variants, {len(frontend_add_ons)} add-ons, "
        f"all referenced media present, {guards} clean."
    )


if __name__ == "__main__":
    main()
