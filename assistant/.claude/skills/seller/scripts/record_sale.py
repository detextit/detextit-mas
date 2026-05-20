#!/usr/bin/env python3
"""Record a completed sale. Decrements stock and logs the transaction."""
import json
import sys

from api_client import get_catalog, get_catalog_by_name
from inventory import InventoryManager

inv = InventoryManager()

if len(sys.argv) < 5:
    print("Usage: record_sale.py <product_name> <buyer_name> <final_price> <rounds>")
    sys.exit(1)

product_name = sys.argv[1].lower()
buyer_name = sys.argv[2]
final_price = float(sys.argv[3])
rounds = int(sys.argv[4])

product = get_catalog_by_name().get(product_name)
if not product:
    candidates = [p for p in get_catalog() if product_name in p.name.lower()]
    if len(candidates) == 1:
        product = candidates[0]
    else:
        print(f"Product '{product_name}' not found.")
        sys.exit(1)

tx = inv.record_sale(
    product_id=product.id,
    buyer_name=buyer_name,
    final_price=final_price,
    rounds=rounds,
)
if not tx:
    print(f"Sale failed — {product.name} is out of stock.")
    sys.exit(1)

print(json.dumps({
    "transaction_id": tx.id,
    "product": product.name,
    "market_price": tx.market_price,
    "final_price": tx.final_price,
    "savings_pct": round(tx.savings_pct, 1),
    "buyer": tx.buyer_name,
    "timestamp": tx.timestamp,
}, indent=2))
