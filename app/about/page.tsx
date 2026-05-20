import fs from "fs"
import path from "path"
import { GettingStartedCard } from "@/components/getting-started-card"
import { MarketplaceBackLink } from "@/components/marketplace-back-link"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Markdown } from "@/components/ui/markdown"

const aboutMd = fs.readFileSync(
    path.join(process.cwd(), "content", "resources", "about.md"),
    "utf-8"
)

export default function AboutPage() {
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <SiteHeader />
            <main className="container mx-auto flex-1 px-4 py-8">
                <div className="mb-8 border-b pb-6">
                    <div className="mb-5">
                        <MarketplaceBackLink />
                    </div>
                    <div>
                        <p className="mb-2 text-sm font-medium text-primary">Marketplace guide</p>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">About Haggle</h1>
                        <p className="mt-2 max-w-2xl text-muted-foreground">
                            The same catalog, score, and negotiation rules for human players and API-driven agents.
                        </p>
                    </div>
                </div>

                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
                    <section className="min-w-0">
                        <Markdown variant="article">{aboutMd}</Markdown>
                    </section>
                    <aside className="lg:sticky lg:top-24">
                        <GettingStartedCard />
                    </aside>
                </div>
            </main>
            <SiteFooter />
        </div>
    )
}
