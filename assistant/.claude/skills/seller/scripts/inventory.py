"""
Inventory manager — tracks demand signals and local transaction history.
Stock levels are read from the live API; demand/transaction state is persisted locally.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

from api_client import Product, Transaction, get_catalog, get_catalog_by_id

SESSION_FILE = Path(os.environ.get("SELLER_SESSION_FILE", "seller_session.json"))


@dataclass
class DemandSignal:
    product_id: str
    negotiations_started: int = 0
    negotiations_completed: int = 0
    total_offers_received: int = 0
    last_negotiation_time: Optional[str] = None


class InventoryManager:

    def __init__(self) -> None:
        catalog = get_catalog()
        self._demand: dict[str, DemandSignal] = {
            p.id: DemandSignal(product_id=p.id) for p in catalog
        }
        self._transactions: list[Transaction] = []
        self._load()

    def _load(self) -> None:
        if not SESSION_FILE.exists():
            return
        try:
            data = json.loads(SESSION_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            return

        self._transactions = [
            Transaction(**tx) for tx in data.get("transactions", [])
        ]

        for pid, sig in data.get("demand", {}).items():
            if pid in self._demand:
                self._demand[pid] = DemandSignal(**sig)

    def _save(self) -> None:
        data = {
            "transactions": [asdict(tx) for tx in self._transactions],
            "demand": {pid: asdict(sig) for pid, sig in self._demand.items()},
        }
        SESSION_FILE.write_text(json.dumps(data, indent=2))

    def get_stock(self, product_id: str) -> int:
        catalog = get_catalog_by_id()
        product = catalog.get(product_id)
        return product.stock_quantity if product else 0

    def is_in_stock(self, product_id: str) -> bool:
        return self.get_stock(product_id) > 0

    def get_demand_signal(self, product_id: str) -> Optional[DemandSignal]:
        return self._demand.get(product_id)

    def get_recent_transactions(self, product_id: Optional[str] = None, limit: int = 10) -> list[Transaction]:
        txs = self._transactions
        if product_id:
            txs = [t for t in txs if t.product_id == product_id]
        return sorted(txs, key=lambda t: t.timestamp, reverse=True)[:limit]

    def get_average_selling_price(self, product_id: str) -> Optional[float]:
        txs = [t for t in self._transactions if t.product_id == product_id]
        if not txs:
            return None
        return sum(t.final_price for t in txs) / len(txs)

    def search_products(self, query: str) -> list[Product]:
        q = query.lower()
        return [
            p for p in get_catalog()
            if q in p.name.lower() or q in p.description.lower() or q in p.category.lower()
        ]

    def get_products_by_category(self, category: str) -> list[Product]:
        cat = category.lower()
        return [p for p in get_catalog() if p.category.lower() == cat]

    def get_inventory_summary(self) -> dict:
        catalog = get_catalog()
        total = len(catalog)
        in_stock = sum(1 for p in catalog if p.stock_quantity > 0)
        total_units = sum(p.stock_quantity for p in catalog)
        return {
            "total_products": total,
            "in_stock": in_stock,
            "out_of_stock": total - in_stock,
            "total_units": total_units,
            "total_transactions": len(self._transactions),
        }

    def record_negotiation_start(self, product_id: str) -> None:
        if product_id in self._demand:
            sig = self._demand[product_id]
            sig.negotiations_started += 1
            sig.last_negotiation_time = datetime.now(timezone.utc).isoformat()
            self._save()

    def record_offer(self, product_id: str) -> None:
        if product_id in self._demand:
            self._demand[product_id].total_offers_received += 1
            self._save()

    def record_sale(self, product_id: str, buyer_name: str, final_price: float, rounds: int) -> Optional[Transaction]:
        catalog = get_catalog_by_id()
        product = catalog.get(product_id)
        if not product or product.stock_quantity <= 0:
            return None

        tx = Transaction(
            id=str(uuid.uuid4()),
            product_id=product_id,
            buyer_name=buyer_name,
            market_price=product.market_price,
            final_price=final_price,
            rounds=rounds,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        self._transactions.append(tx)

        if product_id in self._demand:
            self._demand[product_id].negotiations_completed += 1

        self._save()
        return tx
