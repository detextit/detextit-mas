#!/usr/bin/env python3
"""Get full details for a specific product by name."""
import json
import sys

from api_client import get_catalog, get_catalog_by_name

name = " ".join(sys.argv[1:]).lower() if len(sys.argv) > 1 else ""
if not name:
    print("Usage: lookup_product.py <product name>")
    sys.exit(1)

product = get_catalog_by_name().get(name)
if not product:
    candidates = [p for p in get_catalog() if name in p.name.lower()]
    if len(candidates) == 1:
        product = candidates[0]
    elif len(candidates) > 1:
        print(f"Multiple matches: {', '.join(c.name for c in candidates)}. Be more specific.")
        sys.exit(0)
    else:
        print(f"Product '{name}' not found.")
        sys.exit(1)

print(json.dumps({
    "id": product.id,
    "name": product.name,
    "description": product.description,
    "market_price": product.market_price,
    "category": product.category,
    "stock": product.stock_quantity,
    "in_stock": product.stock_quantity > 0,
    "negotiation_room": product.negotiation_room,
}, indent=2))
