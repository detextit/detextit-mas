"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { Search, Gamepad2, ShoppingBag, MessageSquare, X, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { usePlayer } from "@/lib/player-context"
import { useProducts } from "@/lib/hooks"
import { Product } from "@/lib/types"
import { HaggleChat } from "@/components/haggle-chat"
import { Leaderboard } from "@/components/leaderboard"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

const categories = ["Electronics", "Fashion", "Food & Drink", "Books", "Home & Kitchen"]

const categoryEmojis: Record<string, string> = {
  "Electronics": "🔌",
  "Fashion": "👗",
  "Food & Drink": "🍽️",
  "Books": "📚",
  "Home & Kitchen": "🏠",
}

const productEmojis: Record<string, string> = {
  // Electronics
  "Sony WH-1000XM5 Headphones": "🎧",
  "Apple AirPods Pro 2": "🎵",
  "Anker Soundcore Liberty 4": "🎶",
  "JBL Charge 5 Speaker": "🔊",
  "Kindle Paperwhite": "📖",
  "Logitech MX Master 3S": "🖱️",
  "Samsung Galaxy Buds FE": "👂",
  "Raspberry Pi 5 (8GB)": "🍇",
  // Fashion
  "Nike Air Max 90": "👟",
  "Adidas Ultraboost Light": "🏃",
  "Ray-Ban Wayfarer Classic": "🕶️",
  "Levi's 501 Original Jeans": "👖",
  "Herschel Classic Backpack XL": "🎒",
  "Casio G-Shock DW5600": "⌚",
  "Patagonia Better Sweater Fleece": "🧥",
  "Fjallraven Kanken Mini": "👜",
  // Food & Drink
  "Blue Bottle Whole Bean Coffee (12oz)": "☕",
  "Compartés Gourmet Chocolate Bar": "🍫",
  "Matcha Konomi Ceremonial Grade (30g)": "🍵",
  "Graza Sizzle Extra Virgin Olive Oil": "🫒",
  "Fly By Jing Sichuan Chili Crisp": "🌶️",
  "Intelligentsia House Blend (12oz)": "☕",
  // Books
  "Thinking, Fast and Slow - Daniel Kahneman": "🧠",
  "The Design of Everyday Things - Don Norman": "✏️",
  "Project Hail Mary - Andy Weir": "🚀",
  "Sapiens: A Brief History of Humankind": "🌍",
  "Atomic Habits - James Clear": "⚛️",
  "Dune - Frank Herbert": "🏜️",
  // Home & Kitchen
  "Stanley Quencher Tumbler (40oz)": "🥤",
  "Le Creuset Stoneware Mug": "☕",
  "Chemex Classic 6-Cup Coffeemaker": "☕",
  "Aesop Reverence Hand Wash (500ml)": "🧴",
  "Yeti Rambler 26oz Bottle": "🧊",
  "Fellow Stagg EKG Kettle": "🫖",
}

function getProductEmoji(product: Product): string {
  return productEmojis[product.name] || categoryEmojis[product.category || ""] || "🛍️"
}

function ProductCard({
  product,
  onHaggle,
  canHaggle
}: {
  product: Product
  onHaggle: (product: Product) => void
  canHaggle: boolean
}) {
  const stockLow = product.stock_quantity <= 3

  return (
    <Card className="hover:shadow-xl hover:border-primary/20 transition-all duration-300 group border-border flex flex-col justify-between h-full bg-card">
      <CardContent className="p-4 flex flex-col h-full justify-between">
        <div>
          <div className="relative mb-3 overflow-hidden rounded-md bg-secondary/40 dark:bg-secondary/10 border border-border/30">
            <div className="w-full h-40 flex items-center justify-center overflow-hidden">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  onError={(e) => {
                    // Fail-safe client fallback to emoticon
                    e.currentTarget.style.display = "none"
                    const sibling = e.currentTarget.nextElementSibling
                    if (sibling) {
                      sibling.classList.remove("hidden")
                    }
                  }}
                />
              ) : null}
              <span
                className={`text-6xl ${product.image_url ? "hidden" : ""} select-none`}
                role="img"
                aria-label={product.name}
              >
                {getProductEmoji(product)}
              </span>
            </div>
            {stockLow && (
              <Badge className="absolute top-2 right-2 bg-warning text-warning-foreground text-[10px] font-bold tracking-wide shadow-sm py-0.5 px-1.5 uppercase">
                Only {product.stock_quantity} left!
              </Badge>
            )}
          </div>

          <h3 className="font-semibold text-sm mb-2 line-clamp-2 group-hover:text-primary transition-colors duration-200">
            {product.name}
          </h3>

          {product.description && (
            <p className="text-xs text-muted-foreground mb-4 line-clamp-2 h-8 leading-normal">
              {product.description}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="text-xl font-extrabold text-foreground tracking-tight">
              ${Number(product.market_price).toFixed(2)}
            </span>
            <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider py-0.5 px-2 bg-secondary/80 text-secondary-foreground border border-border/20">
              {product.category}
            </Badge>
          </div>

          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm transition-all duration-200"
            onClick={() => onHaggle(product)}
            disabled={!canHaggle || product.stock_quantity <= 0}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            {product.stock_quantity <= 0 ? 'Out of Stock' : 'Start Haggling'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function HaggleMarketplace() {
  const { player } = usePlayer()
  const { isSignedIn } = useAuth()
  const router = useRouter()
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState([0, 500])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [haggleProduct, setHaggleProduct] = useState<Product | null>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const { data: products, isLoading, mutate } = useProducts()

  // Compute actual price bounds from loaded products
  const priceBounds = products?.reduce(
    (acc, p) => {
      const price = Number(p.market_price)
      return { min: Math.min(acc.min, price), max: Math.max(acc.max, price) }
    },
    { min: Infinity, max: 0 }
  ) || { min: 0, max: 500 }

  // Round bounds: floor min to nearest 5, ceil max to nearest 5
  const minBound = Math.floor(priceBounds.min / 5) * 5
  const maxBound = Math.ceil(priceBounds.max / 5) * 5

  // Sync price range state when product data loads
  useEffect(() => {
    if (products && products.length > 0) {
      setPriceRange([minBound, maxBound])
    }
  }, [minBound, maxBound, products])

  const handleCategoryChange = (category: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories([...selectedCategories, category])
    } else {
      setSelectedCategories(selectedCategories.filter((c) => c !== category))
    }
  }

  const filteredProducts = products?.filter(product => {
    // Category filter
    if (selectedCategories.length > 0 && !selectedCategories.includes(product.category || '')) {
      return false
    }
    // Price filter
    const price = Number(product.market_price)
    if (price < priceRange[0] || price > priceRange[1]) {
      return false
    }
    // Search filter (matches name and description)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const nameMatch = product.name.toLowerCase().includes(q)
      const descMatch = product.description?.toLowerCase().includes(q)
      if (!nameMatch && !descMatch) return false
    }
    return true
  }) || []

  const handleStartHaggle = (product: Product) => {
    if (!player) {
      if (!isSignedIn) router.push('/sign-in')
      return
    }

    if (Number(player.credits) <= 0) {
      alert("You've run out of credits! You can only observe now.")
      return
    }

    setHaggleProduct(product)
  }

  const handlePurchaseComplete = (savings: number) => {
    setHaggleProduct(null)
    mutate() // Refresh products to update stock
  }

  const canHaggle = !player || Number(player.credits) > 0

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="container mx-auto flex-1 px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar Filters */}
          <aside
            aria-label="Product filters"
            className={`w-64 space-y-6 ${sidebarOpen ? "block" : "hidden md:block"}`}
          >
            {/* Filters Card */}
            <Card className="sticky top-24">
              <CardHeader className="flex-row items-center justify-between space-y-0 p-5 pb-3">
                  <CardTitle className="font-semibold flex items-center gap-2 text-base text-foreground">
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                  </CardTitle>
                  {(selectedCategories.length > 0 || priceRange[0] > minBound || priceRange[1] < maxBound) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-auto px-2 py-1"
                      onClick={() => {
                        setSelectedCategories([])
                        setPriceRange([minBound, maxBound])
                      }}
                    >
                      Clear all
                    </Button>
                  )}
              </CardHeader>
              <CardContent className="p-5 pt-0">

                {/* Categories */}
                <div className="mb-5">
                  <h4 className="font-medium mb-2.5 text-sm text-foreground">Categories</h4>
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <div key={category} className="flex items-center space-x-2">
                        <Checkbox
                          id={category}
                          checked={selectedCategories.includes(category)}
                          onCheckedChange={(checked) => handleCategoryChange(category, checked as boolean)}
                        />
                        <Label htmlFor={category} className="cursor-pointer text-foreground flex items-center gap-1.5 font-normal">
                          <span>{categoryEmojis[category]}</span>
                          {category}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Price Range */}
                <div>
                  <h4 className="font-medium mb-2.5 text-sm text-foreground">Price Range</h4>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={minBound}
                        max={priceRange[1]}
                        value={priceRange[0]}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          if (!isNaN(val)) setPriceRange([Math.min(val, priceRange[1]), priceRange[1]])
                        }}
                        className="h-8 pl-5 pr-1 text-xs"
                      />
                    </div>
                    <span className="text-muted-foreground text-xs">to</span>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={priceRange[0]}
                        max={maxBound}
                        value={priceRange[1]}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          if (!isNaN(val)) setPriceRange([priceRange[0], Math.max(val, priceRange[0])])
                        }}
                        className="h-8 pl-5 pr-1 text-xs"
                      />
                    </div>
                  </div>
                  <Slider
                    value={priceRange}
                    onValueChange={setPriceRange}
                    min={minBound}
                    max={maxBound}
                    step={5}
                    className="mb-1"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>${minBound}</span>
                    <span>${maxBound}</span>
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Leaderboard Toggle (Mobile) */}
            <Button
              variant="default"
              className="w-full md:hidden"
              onClick={() => setShowLeaderboard(!showLeaderboard)}
            >
              {showLeaderboard ? 'Hide Leaderboard' : 'Show Leaderboard'}
            </Button>
          </aside>

          {/* Main Content */}
          <main id="main-content" className="flex-1">
            <Alert className="mb-6 border-primary/20 bg-secondary">
              <Gamepad2 className="h-5 w-5 text-primary" />
              <AlertTitle>Welcome to Haggle!</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                Negotiate with sellers to get the best deals. Buy items, trade up, and climb the leaderboard!
              </AlertDescription>
            </Alert>

            {/* Search + Results Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold text-foreground">Products</h2>
                <Badge variant="secondary" className="text-xs">
                  {filteredProducts.length} found
                </Badge>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  className="pl-9 pr-8 h-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search products"
                />
                {searchQuery && (
                  <Button
                    variant="default"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground border-transparent hover:border-input"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Active Filters */}
            {(selectedCategories.length > 0 || searchQuery || priceRange[0] > minBound || priceRange[1] < maxBound) && (
              <div className="flex flex-wrap gap-2 mb-4" role="list" aria-label="Active filters">
                {selectedCategories.map((cat) => (
                  <Badge
                    key={cat}
                    variant="secondary"
                    className="cursor-pointer hover:bg-secondary/80 gap-1 pr-1.5"
                    onClick={() => setSelectedCategories(selectedCategories.filter(c => c !== cat))}
                    aria-label={`Remove ${cat} filter`}
                    role="listitem"
                  >
                    {categoryEmojis[cat]} {cat}
                    <X className="w-3 h-3 ml-1" aria-hidden="true" />
                  </Badge>
                ))}
                {(priceRange[0] > minBound || priceRange[1] < maxBound) && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer hover:bg-secondary/80 gap-1 pr-1.5"
                    onClick={() => setPriceRange([minBound, maxBound])}
                    aria-label={`Remove price range filter: $${priceRange[0]} to $${priceRange[1]}`}
                    role="listitem"
                  >
                    ${priceRange[0]} - ${priceRange[1]}
                    <X className="w-3 h-3 ml-1" aria-hidden="true" />
                  </Badge>
                )}
                {searchQuery && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer hover:bg-secondary/80 gap-1 pr-1.5"
                    onClick={() => setSearchQuery("")}
                    aria-label={`Remove search filter: ${searchQuery}`}
                    role="listitem"
                  >
                    &ldquo;{searchQuery}&rdquo;
                    <X className="w-3 h-3 ml-1" aria-hidden="true" />
                  </Badge>
                )}
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" role="status" aria-label="Loading products">
                {[1,2,3,4,5,6].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <Skeleton className="mb-3 h-48 w-full" />
                      <Skeleton className="mb-2 h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Product Grid */}
            {!isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onHaggle={handleStartHaggle}
                    canHaggle={canHaggle}
                  />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No products found</h3>
                <p className="text-muted-foreground">Try adjusting your filters</p>
              </div>
            )}
          </main>

          {/* Leaderboard Sidebar */}
          <aside aria-label="Leaderboard" className={`shrink-0 ${showLeaderboard ? 'block' : 'hidden lg:block'}`}>
            <div className="sticky top-24">
              <Leaderboard />
            </div>
          </aside>
        </div>
      </div>

      {/* Haggle Chat Modal */}
      <Dialog open={!!haggleProduct && !!player} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false} className="p-0 sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogTitle className="sr-only">Haggle Chat</DialogTitle>
          {haggleProduct && player && (
            <HaggleChat
              product={haggleProduct}
              onClose={() => setHaggleProduct(null)}
              onPurchaseComplete={handlePurchaseComplete}
            />
          )}
        </DialogContent>
      </Dialog>
      <SiteFooter />
    </div>
  )
}
