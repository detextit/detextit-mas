#!/usr/bin/env python3
"""Get a high-level overview of inventory health."""
import json
import sys

from inventory import InventoryManager

inv = InventoryManager()
print(json.dumps(inv.get_inventory_summary(), indent=2))
