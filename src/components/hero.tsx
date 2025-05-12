"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import ThreeScene from "@/components/three-scene";
import { motion } from "framer-motion";
import { ArrowDown, Sparkles, Mouse } from "lucide-react";
import { SignUpButton } from "@clerk/nextjs";

export default function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!heroRef.current) return;
      const scrollY = window.scrollY;
      const opacity = 1 - Math.min(scrollY / 500, 1);
      const translateY = scrollY * 0.5;

      if (heroRef.current) {
        heroRef.current.style.opacity = opacity.toString();
        heroRef.current.style.transform = `translateY(${translateY}px)`;
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {/* Three.js Background */}
      <ThreeScene />

      {/* Animated Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 z-[5]"></div>

      {/* Content */}
      <div
        ref={heroRef}
        className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-10"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 text-purple-300 mb-6">
            <Sparkles className="w-4 h-4 mr-2" />
            <span>Stateful, Long Living Agentic Systems</span>
          </div>
        </motion.div>

        <motion.h1
          className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <span className="block">Evolving Intelligence:</span>
          <span className="bg-gradient-to-r from-purple-400 via-cyan-400 to-purple-400 text-transparent bg-clip-text">
            AI that learns, adapts, and collaborates.
          </span>
        </motion.h1>

        <motion.p
          className="text-xl md:text-2xl text-white/80 max-w-3xl mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          Explore the future with AI to simulate complex scenarios and unlock
          new possibilities in entertainment, education, and more.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <SignUpButton mode="modal">
            <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white px-8 py-6 text-lg rounded-full">
              Sign up for updates
            </Button>
          </SignUpButton>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.5 }}
      >
        <Link href="#emergent-tools">
          <div className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity">
            <div className="animate-bounce">
              <Mouse className="w-8 h-8 text-white/60" />
            </div>
          </div>
        </Link>
      </motion.div>
    </div>
  );
}
