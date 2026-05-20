"""
Product catalog seeded from haggle-game's inventory.
In-memory store for POC; will connect to haggle-game DB via REST API later.
"""

from __future__ import annotations

from dataclasses import dataclass
import uuid


@dataclass
class Product:
    id: str
    name: str
    description: str
    market_price: float
    min_acceptable_price: float
    category: str
    stock_quantity: int

    @property
    def negotiation_room(self) -> float:
        return self.market_price - self.min_acceptable_price


@dataclass
class Transaction:
    id: str
    product_id: str
    buyer_name: str
    market_price: float
    final_price: float
    rounds: int
    timestamp: str  # ISO-8601

    @property
    def savings_pct(self) -> float:
        if self.market_price == 0:
            return 0.0
        return (self.market_price - self.final_price) / self.market_price * 100

    @property
    def seller_margin(self) -> float:
        return self.final_price - CATALOG_BY_ID.get(self.product_id, Product("", "", "", self.market_price, self.final_price, "", 0)).min_acceptable_price


# ---------------------------------------------------------------------------
# Catalog — mirrors haggle-game's 002-seed-products.sql
# ---------------------------------------------------------------------------

def _p(name: str, desc: str, price: float, min_price: float, cat: str, stock: int) -> Product:
    return Product(
        id=str(uuid.uuid5(uuid.NAMESPACE_DNS, name)),
        name=name,
        description=desc,
        market_price=price,
        min_acceptable_price=min_price,
        category=cat,
        stock_quantity=stock,
    )


CATALOG: list[Product] = [
    # Electronics
    _p("Sony WH-1000XM5 Headphones", "Industry-leading noise cancellation with 30-hour battery life and crystal-clear hands-free calling.", 348.00, 278.00, "Electronics", 4),
    _p("Apple AirPods Pro 2", "Active noise cancellation, adaptive transparency, and personalized spatial audio with dynamic head tracking.", 249.00, 199.00, "Electronics", 6),
    _p("Anker Soundcore Liberty 4", "Hi-Res wireless earbuds with dual dynamic drivers and adaptive ANC. Great value pick.", 79.99, 48.00, "Electronics", 8),
    _p("JBL Charge 5 Speaker", "Portable Bluetooth speaker with powerful bass, IP67 waterproof rating, and 20-hour playtime.", 179.95, 125.00, "Electronics", 5),
    _p("Kindle Paperwhite", "6.8\" display with adjustable warm light, 16GB storage, and up to 10 weeks of battery life.", 149.99, 112.00, "Electronics", 7),
    _p("Logitech MX Master 3S", "Advanced wireless mouse with 8K DPI tracking, quiet clicks, and MagSpeed scroll wheel.", 99.99, 70.00, "Electronics", 6),
    _p("Samsung Galaxy Buds FE", "ANC earbuds with rich 1-way speaker sound, comfortable fit, and 6-hour battery.", 59.99, 35.00, "Electronics", 10),
    _p("Raspberry Pi 5 (8GB)", "Single-board computer with quad-core 64-bit Arm Cortex-A76, perfect for tinkerers and makers.", 89.99, 72.00, "Electronics", 3),
    # Fashion
    _p("Nike Air Max 90", "Iconic sneaker with visible Max Air cushioning and waffle outsole. Cloud White colorway.", 130.00, 91.00, "Fashion", 4),
    _p("Adidas Ultraboost Light", "Ultra-responsive Boost midsole with Continental rubber outsole and Primeknit upper.", 190.00, 133.00, "Fashion", 3),
    _p("Ray-Ban Wayfarer Classic", "Timeless acetate sunglasses with polarized G-15 lenses and iconic silhouette.", 163.00, 114.00, "Fashion", 5),
    _p("Levi's 501 Original Jeans", "The original straight-fit jean with signature button fly and heavyweight denim.", 69.50, 45.00, "Fashion", 8),
    _p("Herschel Classic Backpack XL", "30L backpack with padded laptop sleeve, internal media pocket, and contoured straps.", 74.99, 48.00, "Fashion", 6),
    _p("Casio G-Shock DW5600", "Legendary digital watch with 200M water resistance, stopwatch, and EL backlight.", 69.99, 49.00, "Fashion", 7),
    _p("Patagonia Better Sweater Fleece", "Fair-trade certified fleece jacket made from 100% recycled polyester. Forge Grey.", 139.00, 97.00, "Fashion", 4),
    _p("Fjallraven Kanken Mini", "Compact 7L daypack with Vinylon F fabric, reflective logo, and dual top handles.", 80.00, 52.00, "Fashion", 5),
    # Food & Drink
    _p("Blue Bottle Whole Bean Coffee (12oz)", "Single-origin Ethiopian Yirgacheffe with notes of blueberry, dark chocolate, and citrus.", 22.00, 14.00, "Food & Drink", 12),
    _p("Compartés Gourmet Chocolate Bar", "Handcrafted dark chocolate with California strawberries and cream. Gift-box packaging.", 12.95, 8.00, "Food & Drink", 15),
    _p("Matcha Konomi Ceremonial Grade (30g)", "Stone-ground Uji matcha from Kyoto. First-harvest, vibrant green with umami sweetness.", 34.00, 22.00, "Food & Drink", 8),
    _p("Graza Sizzle Extra Virgin Olive Oil", "Spanish Picual EVOO in a squeeze bottle, made for everyday cooking. Bold and peppery.", 19.99, 13.00, "Food & Drink", 10),
    _p("Fly By Jing Sichuan Chili Crisp", "All-natural chili crisp with tribute peppers, mushrooms, and fermented black beans.", 15.00, 10.00, "Food & Drink", 14),
    _p("Intelligentsia House Blend (12oz)", "Balanced medium roast with notes of milk chocolate, cola, and stone fruit. A daily driver.", 18.50, 12.00, "Food & Drink", 10),
    # Books
    _p("Thinking, Fast and Slow - Daniel Kahneman", "Groundbreaking exploration of the two systems that drive the way we think. Hardcover edition.", 17.99, 11.00, "Books", 8),
    _p("The Design of Everyday Things - Don Norman", "The essential design classic on user-centered design, cognitive science, and human error.", 18.99, 12.00, "Books", 6),
    _p("Project Hail Mary - Andy Weir", "A lone astronaut must save Earth in this gripping sci-fi adventure from the author of The Martian.", 16.99, 10.00, "Books", 9),
    _p("Sapiens: A Brief History of Humankind", "Yuval Noah Harari's sweeping narrative of how Homo sapiens came to dominate the planet.", 19.99, 13.00, "Books", 7),
    _p("Atomic Habits - James Clear", "Practical strategies for building good habits and breaking bad ones. Millions of copies sold.", 16.99, 11.50, "Books", 12),
    _p("Dune - Frank Herbert", "The epic science fiction masterpiece. Winner of the Hugo and Nebula Awards. Paperback.", 12.99, 8.00, "Books", 10),
    # Home & Kitchen
    _p("Stanley Quencher Tumbler (40oz)", "Vacuum-insulated stainless steel tumbler with FlowState lid. Keeps drinks cold for 11 hours.", 45.00, 31.00, "Home & Kitchen", 8),
    _p("Le Creuset Stoneware Mug", "Handcrafted stoneware mug with enamel glaze, resistant to chipping and cracking. Flame Orange.", 22.00, 15.00, "Home & Kitchen", 10),
    _p("Chemex Classic 6-Cup Coffeemaker", "Iconic pour-over brewer with non-porous borosilicate glass and polished wood collar.", 49.50, 34.00, "Home & Kitchen", 5),
    _p("Aesop Reverence Hand Wash (500ml)", "Botanical hand wash with vetiver root, petitgrain, and bergamot rind extracts.", 39.00, 27.00, "Home & Kitchen", 6),
    _p("Yeti Rambler 26oz Bottle", "Double-wall vacuum insulated stainless steel bottle with chug cap. Dishwasher safe.", 40.00, 28.00, "Home & Kitchen", 7),
    _p("Fellow Stagg EKG Kettle", "Pour-over kettle with variable temperature control, built-in brew timer, and minimalist design.", 165.00, 132.00, "Home & Kitchen", 3),
]

CATALOG_BY_ID: dict[str, Product] = {p.id: p for p in CATALOG}
CATALOG_BY_NAME: dict[str, Product] = {p.name.lower(): p for p in CATALOG}
CATEGORIES: list[str] = sorted(set(p.category for p in CATALOG))
