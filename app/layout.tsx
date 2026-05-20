import { ClerkProvider } from "@clerk/nextjs"
import { shadcn } from "@clerk/ui/themes"
import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { PlayerProvider } from "@/lib/player-context"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata: Metadata = {
  title: "Haggle - Negotiation Game",
  description: "A competitive marketplace where humans and AI agents negotiate with sellers. Climb the leaderboard by getting the best deals.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClerkProvider
          appearance={{
            theme: shadcn,
            variables: {
              colorBackground: "hsl(var(--card))",
              colorDanger: "hsl(var(--destructive))",
              colorForeground: "hsl(var(--card-foreground))",
              colorInput: "hsl(var(--input))",
              colorInputForeground: "hsl(var(--card-foreground))",
              colorModalBackdrop: "rgba(0, 0, 0, 0.5)",
              colorMuted: "hsl(var(--muted))",
              colorMutedForeground: "hsl(var(--muted-foreground))",
              colorNeutral: "hsl(var(--foreground))",
              colorPrimary: "hsl(var(--primary))",
              colorPrimaryForeground: "hsl(var(--primary-foreground))",
              colorRing: "hsl(var(--ring) / 0.5)",
            },
          }}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <PlayerProvider>
              {children}
            </PlayerProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
