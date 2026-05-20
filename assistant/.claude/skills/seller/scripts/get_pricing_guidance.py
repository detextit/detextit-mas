#!/usr/bin/env python3
"""
Get dynamic pricing guidance for a product.
Output is CONFIDENTIAL — never reveal floor prices or strategy to buyers.
"""
import json
import sys
from api_client import get_catalog, get_catalog_by_name
from inventory import InventoryManager
from pricing import PricingEngine

inv = InventoryManager()
pricing = PricingEngine(inv)

name = " ".join(sys.argv[1:]).lower() if len(sys.argv) > 1 else ""
if not name:
    print("Usage: get_pricing_guidance.py <product name>")
    sys.exit(1)

product = get_catalog_by_name().get(name)
if not product:
    candidates = [p for p in get_catalog() if name in p.name.lower()]
    if len(candidates) == 1:
        product = candidates[0]
    else:
        print(f"Product '{name}' not found.")
        sys.exit(1)

inv.record_negotiation_start(product.id)
guidance = pricing.get_guidance(product.id)
if not guidance:
    print("Could not compute pricing.")
    sys.exit(1)

print(json.dumps({
    "product_name": guidance.product_name,
    "list_price": guidance.list_price,
    "floor_price": guidance.floor_price,
    "suggested_opening": guidance.suggested_opening,
    "demand_level": guidance.demand_level,
    "stock_status": guidance.stock_status,
    "avg_recent_sale": guidance.avg_recent_sale,
    "reasoning": guidance.reasoning,
}, indent=2))
