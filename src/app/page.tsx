"use client";

import Header from "@/components/header";
import Footer from "@/components/footer";
import Hero from "@/components/hero";
import Vision from "@/components/vision";
import Features from "@/components/features";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">
        <Hero />
        <Vision />
        <Features />
      </main>
      <Footer />
    </div>
  );
}
