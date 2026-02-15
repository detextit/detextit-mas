"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed w-full z-50 transition-all duration-300 ${
        scrolled ? "bg-black/70 backdrop-blur-md" : "bg-transparent"
      } border-b ${scrolled ? "border-white/10" : "border-transparent"}`}
    >
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <div className="relative p-1">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full blur-md opacity-30"></div>
            <div className="relative flex items-center bg-black/80 rounded-full px-3 py-1 border border-white/10">
              <Sparkles className="w-4 h-4 text-purple-400 mr-2" />
              <span className="font-bold text-2xl bg-gradient-to-r from-purple-400 via-cyan-400 to-purple-400 text-transparent bg-clip-text">
                Detextit
              </span>
            </div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          {["Vision", "Features"].map((item) => (
            <Link
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-white/80 hover:text-white transition-colors relative group"
            >
              {item}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-cyan-400 transition-all duration-300 group-hover:w-full"></span>
            </Link>
          ))}
          <Link
            href="/lobby"
            className="text-white/80 hover:text-white transition-colors relative group font-semibold"
          >
            Play Arena
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-cyan-400 transition-all duration-300 group-hover:w-full"></span>
          </Link>

          <SignedOut>
            <SignUpButton mode="modal">
              <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white">
                Sign In
              </Button>
            </SignUpButton>
          </SignedOut>

          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: "h-10 w-10",
                },
              }}
            />
          </SignedIn>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-white"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden bg-black/90 backdrop-blur-md border-b border-white/10 transition-opacity duration-200">
          <div className="container mx-auto px-4 py-4 flex flex-col space-y-4">
            <Link
              href="#vision"
              className="text-white/80 hover:text-white transition-colors py-2 border-b border-white/10"
              onClick={() => setIsMenuOpen(false)}
            >
              Vision
            </Link>
            <Link
              href="#features"
              className="text-white/80 hover:text-white transition-colors py-2 border-b border-white/10"
              onClick={() => setIsMenuOpen(false)}
            >
              Features
            </Link>

            <SignedOut>
              <SignUpButton mode="modal">
                <Button
                  className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white w-full"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign Up / Sign In
                </Button>
              </SignUpButton>
            </SignedOut>

            <SignedIn>
              <Link
                href="/lobby"
                className="text-white/80 hover:text-white transition-colors py-2 border-b border-white/10 font-semibold"
                onClick={() => setIsMenuOpen(false)}
              >
                Play Arena
              </Link>
              <Link
                href="/dashboard"
                className="text-white/80 hover:text-white transition-colors py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </Link>
              <div className="flex items-center justify-center py-2">
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      userButtonAvatarBox: "h-10 w-10",
                    },
                  }}
                />
              </div>
            </SignedIn>
          </div>
        </div>
      )}
    </header>
  );
}
