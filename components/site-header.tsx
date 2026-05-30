"use client"

import Link from "next/link"
import Image from "next/image"
import { Show, UserButton } from "@clerk/nextjs"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CreditDisplay } from "@/components/credit-display"
import { ThemeToggle } from "@/components/theme-toggle"
import { usePlayer } from "@/lib/player-context"

interface SiteHeaderProps {
  sidebarOpen?: boolean
  onToggleSidebar?: () => void
}

export function SiteHeader({ sidebarOpen = false, onToggleSidebar }: SiteHeaderProps) {
  const { player, logout } = usePlayer()

  return (
    <header className="sticky top-0 z-40 bg-nav text-nav-foreground">
      <nav aria-label="Main navigation" className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            {onToggleSidebar && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 md:hidden"
                onClick={onToggleSidebar}
                aria-label={sidebarOpen ? "Close filters" : "Open filters"}
                aria-expanded={sidebarOpen}
              >
                <Menu className="size-5" />
              </Button>
            )}

            <Link href="/" className="flex items-center gap-2">
              <div className="relative size-8 overflow-hidden rounded-md border border-white/10 bg-black">
                <Image
                  src="/detextit-icon.png"
                  alt=""
                  fill
                  sizes="32px"
                  className="object-cover"
                  priority
                />
              </div>
              <span className="text-xl font-bold tracking-tight">Haggle</span>
            </Link>

            <Link href="/about" className="hidden items-center gap-1 text-sm text-white/70 transition-colors hover:text-white sm:inline-flex">
              About
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {player && <CreditDisplay />}
            <Show when="signed-out">
              {player ? (
                <Button
                  variant="default"
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/80"
                  onClick={() => void logout()}
                  aria-label="Sign out"
                >
                  Sign out
                </Button>
              ) : (
                <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/80">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
              )}
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
        </div>
      </nav>
    </header>
  )
}
