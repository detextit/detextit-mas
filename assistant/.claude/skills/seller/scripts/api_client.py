"""
API client for the haggle-game Next.js frontend.
Fetches live product, inventory, and transaction data.
"""

from __future__ import annotations

import json
import os
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

BASE_URL = os.environ.get("HAGGLE_API_URL", "http://localhost:3000")


def _load_api_key() -> Optional[str]:
    key = os.environ.get("HAGGLE_API_KEY")
    if key:
        return key
    # Fallback: read assistant/.env directly (skills run without dotenv loaded).
    env_path = Path(__file__).resolve().parents[4] / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line.startswith("HAGGLE_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


_API_KEY: Optional[str] = _load_api_key()


def _get(path: str) -> dict | list:
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url)
    if _API_KEY:
        req.add_header("Authorization", f"Bearer {_API_KEY}")
    with urllib.request.urlopen(req, timeout=10) as resp:
        body = json.loads(resp.read().decode())
    if isinstance(body, dict) and not body.get("success", True):
        raise RuntimeError(f"API error: {body.get('error', 'unknown')}")
    return body.get("data", body) if isinstance(body, dict) else body


@dataclass
class Product:
    id: str
    name: str
    description: str
    market_price: float
    min_acceptable_price: float
    category: str
    stock_quantity: int

    @property
    def negotiation_room(self) -> float:
        return self.market_price - self.min_acceptable_price


@dataclass
class Transaction:
    id: str
    product_id: str
    buyer_name: str
    market_price: float
    final_price: float
    rounds: int
    timestamp: str

    @property
    def savings_pct(self) -> float:
        if self.market_price == 0:
            return 0.0
        return (self.market_price - self.final_price) / self.market_price * 100


def fetch_products() -> list[Product]:
    data = _get("/api/products")
    products = []
    for p in data:
        products.append(Product(
            id=str(p["id"]),
            name=p["name"],
            description=p.get("description", ""),
            market_price=float(p["market_price"]),
            min_acceptable_price=float(p["min_acceptable_price"]),
            category=p.get("category", ""),
            stock_quantity=int(p.get("stock_quantity", 0)),
        ))
    return products


def fetch_product_by_name(name: str) -> Optional[Product]:
    products = fetch_products()
    lower = name.lower()
    exact = next((p for p in products if p.name.lower() == lower), None)
    if exact:
        return exact
    matches = [p for p in products if lower in p.name.lower()]
    return matches[0] if len(matches) == 1 else None


def fetch_inventory_summary() -> dict:
    return _get("/api/inventory")


def fetch_transactions(limit: int = 50) -> list[dict]:
    return _get("/api/transactions")


def get_categories() -> list[str]:
    data = _get("/api/inventory")
    return sorted(set(c["name"] for c in data.get("categories", [])))


_product_cache: list[Product] | None = None


def get_catalog() -> list[Product]:
    global _product_cache
    if _product_cache is None:
        _product_cache = fetch_products()
    return _product_cache


def get_catalog_by_id() -> dict[str, Product]:
    return {p.id: p for p in get_catalog()}


def get_catalog_by_name() -> dict[str, Product]:
    return {p.name.lower(): p for p in get_catalog()}
