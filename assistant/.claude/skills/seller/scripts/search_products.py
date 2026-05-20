#!/usr/bin/env python3
"""Search the product catalog by keyword or category."""
import json
import sys

from api_client import get_catalog
from inventory import InventoryManager

inv = InventoryManager()

query = sys.argv[1].lower() if len(sys.argv) > 1 else ""
if not query:
    print("Usage: search_products.py <query>")
    sys.exit(1)

results = []
for p in get_catalog():
    if query in p.name.lower() or query in p.description.lower() or query in p.category.lower():
        results.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "market_price": p.market_price,
            "category": p.category,
            "stock": p.stock_quantity,
            "in_stock": p.stock_quantity > 0,
        })

if results:
    print(json.dumps(results, indent=2))
else:
    print(f"No products found matching '{query}'.")
