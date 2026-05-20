#!/usr/bin/env python3
"""List product categories with stock counts. Pass --products to include items."""
import json
import sys

from api_client import get_catalog, get_categories

include_products = "--products" in sys.argv

catalog = get_catalog()
categories = get_categories()

result = {}
for cat in categories:
    products = [p for p in catalog if p.category == cat]
    in_stock = [p for p in products if p.stock_quantity > 0]
    entry: dict = {"total": len(products), "in_stock": len(in_stock)}
    if include_products:
        entry["products"] = [
            {"name": p.name, "price": p.market_price, "stock": p.stock_quantity}
            for p in products
        ]
    result[cat] = entry

print(json.dumps(result, indent=2))
