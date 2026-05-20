import { SignUp } from "@clerk/nextjs"
import { MarketplaceBackLink } from "@/components/marketplace-back-link"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="container mx-auto flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="mb-6 w-full max-w-md">
          <MarketplaceBackLink />
        </div>
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/"
        />
      </main>
      <SiteFooter />
    </div>
  )
}
