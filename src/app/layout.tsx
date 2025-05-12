import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title:
    "Detextit | Adaptive AI Systems for Simulation & Collaborative Intelligence",
  description:
    "Explore Detextit: A platform for developing stateful, long-living AI agents. Build advanced simulations, enable dynamic benchmarking, and foster collaborative intelligence.",
  keywords:
    "detextit, AI agents, agentic systems, multi-agent systems, AI simulation, collaborative AI, evolving intelligence, dynamic benchmarking, AI planning, intelligent systems, AI entertainment, stateful AI, long-living agents",
  openGraph: {
    title: "Detextit | Adaptive AI Agentic Systems & Advanced Simulation",
    description:
      "Discover Detextit - a cutting-edge platform for creating and managing AI agentic systems. Powering the next generation of simulation, collaborative intelligence, and adaptive AI.",
    url: "https://www.detextit.com",
    siteName: "Detextit",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Detextit: Evolving AI Agents for Complex Systems",
    description:
      "Build, simulate, and deploy stateful, long-living AI agents with Detextit. Advancing collaborative intelligence and dynamic learning.",
    site: "@detextit",
    creator: "@detextit",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://www.detextit.com",
    languages: {
      en: "https://www.detextit.com",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
        <head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify([
                {
                  "@context": "https://schema.org",
                  "@type": "Organization",
                  name: "Detextit",
                  url: "https://www.detextit.com",
                  logo: "/logo.png",
                  description:
                    "Detextit is a platform for developing and deploying stateful, long-living AI agentic systems. We specialize in advanced simulation, dynamic benchmarking, collaborative intelligence, and innovative AI applications.",
                },
                {
                  "@context": "https://schema.org",
                  "@type": "SoftwareApplication",
                  name: "Detextit Platform",
                  applicationCategory: "AI Development Platform",
                  operatingSystem: "Web-based",
                  description:
                    "The Detextit platform enables the creation of sophisticated AI agents capable of learning, adapting, and collaborating. Features include advanced simulation environments, tools for dynamic benchmarking, and frameworks for building collective agent intelligence.",
                  offers: {
                    "@type": "Offer",
                    availability: "https://schema.org/InStock",
                  },
                  keywords:
                    "AI agents, simulation software, collaborative AI, machine learning, intelligent systems, agent-based modeling, AI platform",
                },
              ]),
            }}
          />
          <link rel="icon" type="image/svg+xml" href="/favicon.ico" />
        </head>
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
