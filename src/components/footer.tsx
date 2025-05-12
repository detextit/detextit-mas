"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Github, Twitter, Linkedin, Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-black py-16">
      <div className="container mx-auto px-4">
        {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-6">
              <div className="relative flex items-center">
                <Sparkles className="w-5 h-5 text-purple-400 mr-2" />
                <span className="font-bold text-2xl bg-gradient-to-r from-purple-400 via-cyan-400 to-purple-400 text-transparent bg-clip-text">
                  Detextit
                </span>
              </div>
            </Link>
            <p className="text-white/60 max-w-md mb-6">
              Building the future of multi-agent collaborative and self-evolving
              systems for simulation, evaluation, planning, and entertainment.
            </p>
            <div className="flex space-x-4">
              <SocialLink
                href="https://github.com"
                icon={<Github size={18} />}
              />
              <SocialLink
                href="https://twitter.com"
                icon={<Twitter size={18} />}
              />
              <SocialLink
                href="https://linkedin.com"
                icon={<Linkedin size={18} />}
              />
            </div>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-6 relative w-fit">
              Quick Links
              <motion.span
                className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-cyan-500"
                initial={{ width: 0 }}
                whileInView={{ width: "100%" }}
                transition={{ duration: 0.8, delay: 0.2 }}
                viewport={{ once: true }}
              />
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="#vision"
                  className="text-white/60 hover:text-white transition-colors hover:translate-x-1 inline-flex items-center"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-2"></span>
                  Vision
                </Link>
              </li>
              <li>
                <Link
                  href="#emergent-tools"
                  className="text-white/60 hover:text-white transition-colors hover:translate-x-1 inline-flex items-center"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-2"></span>
                  Emergent Tools
                </Link>
              </li>
              <li>
                <Link
                  href="#features"
                  className="text-white/60 hover:text-white transition-colors hover:translate-x-1 inline-flex items-center"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-2"></span>
                  Features
                </Link>
              </li>
            </ul>
          </div>
        </div> */}

        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-white/60 text-sm">
            &copy; {new Date().getFullYear()} Detextit. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({ href, icon }: { href: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
      target="_blank"
      rel="noopener noreferrer"
    >
      {icon}
    </Link>
  );
}
