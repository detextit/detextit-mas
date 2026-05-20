"""
Dynamic pricing engine — adjusts price floors based on demand and stock signals.

Prices tighten (min goes up) when demand is high or stock is low.
Prices relax (min stays or drops toward base) when supply is plentiful.
Recent transaction prices provide market feedback.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from api_client import Product, get_catalog_by_id
from inventory import InventoryManager


@dataclass
class PricingGuidance:
    product_id: str
    product_name: str
    list_price: float
    floor_price: float
    suggested_opening: float
    demand_level: str
    stock_status: str
    avg_recent_sale: Optional[float]
    reasoning: str


class PricingEngine:

    def __init__(self, inventory: InventoryManager) -> None:
        self._inv = inventory

    def get_guidance(self, product_id: str) -> Optional[PricingGuidance]:
        catalog = get_catalog_by_id()
        product = catalog.get(product_id)
        if not product:
            return None

        stock = self._inv.get_stock(product_id)
        demand = self._inv.get_demand_signal(product_id)
        avg_sale = self._inv.get_average_selling_price(product_id)

        demand_level = self._classify_demand(demand.negotiations_started if demand else 0)
        stock_status = self._classify_stock(stock, product.stock_quantity)

        floor_price = self._compute_floor(product, stock, stock_status, demand_level, avg_sale)
        opening_price = self._compute_opening(product, floor_price, demand_level, stock_status)

        reasoning = self._explain(product, floor_price, opening_price, demand_level, stock_status, avg_sale)

        return PricingGuidance(
            product_id=product_id,
            product_name=product.name,
            list_price=product.market_price,
            floor_price=round(floor_price, 2),
            suggested_opening=round(opening_price, 2),
            demand_level=demand_level,
            stock_status=stock_status,
            avg_recent_sale=round(avg_sale, 2) if avg_sale else None,
            reasoning=reasoning,
        )

    def _classify_demand(self, negotiation_count: int) -> str:
        if negotiation_count >= 5:
            return "high"
        elif negotiation_count >= 2:
            return "medium"
        return "low"

    def _classify_stock(self, current: int, original: int) -> str:
        if current <= 0:
            return "out_of_stock"
        if current == 1:
            return "last_one"
        ratio = current / max(original, 1)
        if ratio <= 0.25:
            return "scarce"
        if ratio <= 0.5:
            return "limited"
        return "abundant"

    def _compute_floor(
        self,
        product: Product,
        stock: int,
        stock_status: str,
        demand_level: str,
        avg_sale: Optional[float],
    ) -> float:
        base_min = product.min_acceptable_price
        room = product.negotiation_room

        stock_adj = {
            "abundant": 0.0,
            "limited": 0.15,
            "scarce": 0.35,
            "last_one": 0.55,
            "out_of_stock": 1.0,
        }.get(stock_status, 0.0)

        demand_adj = {
            "low": 0.0,
            "medium": 0.10,
            "high": 0.25,
        }.get(demand_level, 0.0)

        combined = min(stock_adj + demand_adj, 0.8)
        floor = base_min + room * combined

        if avg_sale is not None:
            history_floor = avg_sale * 0.90
            floor = max(floor, history_floor)

        return min(floor, product.market_price)

    def _compute_opening(
        self,
        product: Product,
        floor_price: float,
        demand_level: str,
        stock_status: str,
    ) -> float:
        if stock_status in ("scarce", "last_one") or demand_level == "high":
            return product.market_price
        if demand_level == "medium" or stock_status == "limited":
            return product.market_price * 0.97
        return product.market_price * 0.95

    def _explain(
        self,
        product: Product,
        floor: float,
        opening: float,
        demand: str,
        stock: str,
        avg_sale: Optional[float],
    ) -> str:
        parts = [f"List price ${product.market_price:.2f}, base minimum ${product.min_acceptable_price:.2f}."]

        if stock == "last_one":
            parts.append("This is the LAST unit — hold firm on price.")
        elif stock == "scarce":
            parts.append("Stock is scarce — limited room to negotiate.")
        elif stock == "limited":
            parts.append("Stock is running low.")
        else:
            parts.append("Stock is healthy.")

        if demand == "high":
            parts.append("High demand — multiple buyers interested.")
        elif demand == "medium":
            parts.append("Moderate demand.")
        else:
            parts.append("Low demand — more flexibility to close a deal.")

        if avg_sale is not None:
            parts.append(f"Recent sales averaged ${avg_sale:.2f}.")

        parts.append(f"Dynamic floor: ${floor:.2f}. Suggested opening: ${opening:.2f}.")
        return " ".join(parts)
