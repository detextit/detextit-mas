#!/usr/bin/env python3
"""Check current stock level for a product."""
import json
import sys

from api_client import get_catalog, get_catalog_by_name

name = " ".join(sys.argv[1:]).lower() if len(sys.argv) > 1 else ""
if not name:
    print("Usage: check_stock.py <product name>")
    sys.exit(1)

product = get_catalog_by_name().get(name)
if not product:
    candidates = [p for p in get_catalog() if name in p.name.lower()]
    if len(candidates) == 1:
        product = candidates[0]
    else:
        print(f"Product '{name}' not found.")
        sys.exit(1)

stock = product.stock_quantity
status = "in stock" if stock > 0 else "OUT OF STOCK"
print(f"{product.name}: {stock} units ({status})")
