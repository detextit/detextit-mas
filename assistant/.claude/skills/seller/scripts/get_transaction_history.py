#!/usr/bin/env python3
"""View recent sales transactions. Pass 'all' or a product name."""
import json
import sys

from api_client import get_catalog, get_catalog_by_id, get_catalog_by_name
from inventory import InventoryManager

inv = InventoryManager()

name = " ".join(sys.argv[1:]).lower() if len(sys.argv) > 1 else "all"

product_id = None
if name != "all":
    product = get_catalog_by_name().get(name)
    if not product:
        candidates = [p for p in get_catalog() if name in p.name.lower()]
        if len(candidates) == 1:
            product = candidates[0]
        else:
            print(f"Product '{name}' not found. Use 'all' for all transactions.")
            sys.exit(1)
    product_id = product.id

txs = inv.get_recent_transactions(product_id=product_id, limit=10)
if not txs:
    print("No transactions yet.")
    sys.exit(0)

catalog = get_catalog_by_id()
items = [
    {
        "product": catalog[t.product_id].name if t.product_id in catalog else "Unknown",
        "buyer": t.buyer_name,
        "market_price": t.market_price,
        "final_price": t.final_price,
        "savings_pct": round(t.savings_pct, 1),
        "rounds": t.rounds,
        "timestamp": t.timestamp,
    }
    for t in txs
]
print(json.dumps(items, indent=2))
