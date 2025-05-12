"use client";
import { useInView } from "react-intersection-observer";
import { motion } from "framer-motion";
import { Brain, Database, Shield, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignUpButton } from "@clerk/nextjs";

export default function Vision() {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  return (
    <section
      id="vision"
      className="py-20 bg-gradient-to-b from-black to-purple-950"
    >
      <div className="container mx-auto px-4">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 50 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            <span className="bg-gradient-to-r from-purple-400 to-cyan-400 text-transparent bg-clip-text">
              Our Vision
            </span>
          </h2>
          <p className="text-xl text-white/70 max-w-3xl mx-auto">
            We are building the future of intelligent systems. Our roadmap
            starts with pioneering agent solutions for advanced{" "}
            <strong>simulation</strong>, dynamic <strong>benchmarking</strong>,
            and robust <strong>planning</strong>. Our ultimate aim is to create
            sophisticated <strong>organizations of collaborative agents</strong>
            , driving innovation across industries and even creating new forms
            of <strong>entertainment</strong>.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <VisionCard
            icon={<Database className="w-8 h-8" />}
            title="Collective Memory"
            description="Building shared knowledge systems that enable agents to store, access, and build upon information collaboratively, creating a foundation for true collective intelligence."
            delay={0.2}
            inView={inView}
            gradient="from-purple-500 to-blue-500"
          />

          <VisionCard
            icon={<Brain className="w-8 h-8" />}
            title="Agent-Centric Systems"
            description="Developing frameworks where agents possess individual goals, unique capabilities, and social awareness, enabling emergent behaviors that mimic complex human organizations."
            delay={0.3}
            inView={inView}
            gradient="from-blue-500 to-cyan-500"
          />

          <VisionCard
            icon={<Shield className="w-8 h-8" />}
            title="Robust Architecture"
            description="Creating resilient systems that understand their limitations, communicate effectively, scale efficiently, and recover from errors without human intervention."
            delay={0.4}
            inView={inView}
            gradient="from-cyan-500 to-purple-500"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center"
        >
          <div className="max-w-3xl mx-auto p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
            <p className="text-lg text-white/80 mb-6">
              The biggest unlock in multi-agent systems will be understanding
              and building collective memory systems that enable meaningful
              long-term collaboration.
            </p>
            <SignUpButton mode="modal">
              <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white px-6 py-5">
                <span className="flex items-center">
                  Join Our Waitlist <ArrowRight className="ml-2 h-5 w-5" />
                </span>
              </Button>
            </SignUpButton>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

interface VisionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
  inView: boolean;
  gradient: string;
}

function VisionCard({
  icon,
  title,
  description,
  delay,
  inView,
  gradient,
}: VisionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay }}
      className="bg-black/30 backdrop-blur-lg rounded-xl p-8 border border-white/10 hover:border-white/20 transition-all hover:shadow-lg hover:shadow-purple-500/20 group"
    >
      <div
        className={`w-16 h-16 rounded-full bg-gradient-to-r ${gradient} p-0.5 mb-6 mx-auto transform transition-transform group-hover:scale-110`}
      >
        <div className="w-full h-full rounded-full bg-black/80 backdrop-blur-sm flex items-center justify-center text-white">
          {icon}
        </div>
      </div>
      <h3 className="text-2xl font-bold text-white mb-4 text-center group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-cyan-400 transition-all">
        {title}
      </h3>
      <p className="text-white/70 text-center group-hover:text-white/90 transition-colors">
        {description}
      </p>
    </motion.div>
  );
}
