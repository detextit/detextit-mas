"use client";

import type React from "react";

import { useInView } from "react-intersection-observer";
import { motion } from "framer-motion";
import {
  Brain,
  MessageSquare,
  Database,
  Shield,
  Users,
  AlertTriangle,
  BarChart2,
  TrendingUp,
  Cpu,
  Network,
  PlayCircle,
} from "lucide-react";

export default function Features() {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  const features = [
    {
      icon: <Users className="w-10 h-10" />,
      title: "Advanced Simulation Environments",
      description:
        "Create rich, dynamic simulations powered by multi-agent systems to model complex scenarios and predict outcomes with greater accuracy.",
      gradient: "from-purple-500 to-blue-500",
    },
    {
      icon: <TrendingUp className="w-10 h-10" />,
      title: "Self-Improving Evaluation (Dynamic Benchmarking)",
      description:
        "Go beyond static benchmarks. Our systems enable evaluators that grow, adapt, and continuously refine their ability to assess agent performance.",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: <Brain className="w-10 h-10" />,
      title: "Intelligent Planning & Strategy",
      description:
        "Empower agents with sophisticated planning capabilities to tackle complex goals, optimize resource allocation, and devise novel strategies.",
      gradient: "from-cyan-500 to-emerald-500",
    },
    {
      icon: <Cpu className="w-10 h-10" />,
      title: "Evolving Agent Architectures",
      description:
        "Develop agents that not only learn from data but can adapt their own architectures and capabilities over time, leading to truly autonomous growth.",
      gradient: "from-emerald-500 to-yellow-500",
    },
    {
      icon: <Network className="w-10 h-10" />,
      title: "Collaborative Intelligence & Emergence",
      description:
        "Foster true collaboration between agents through shared knowledge and advanced communication, leading to emergent solutions for complex problems.",
      gradient: "from-yellow-500 to-orange-500",
    },
    {
      icon: <PlayCircle className="w-10 h-10" />,
      title: "Interactive Agent Entertainment",
      description:
        "Unlock new forms of entertainment by creating observable and interactive scenarios where autonomous agents play out compelling narratives and behaviors.",
      gradient: "from-orange-500 to-purple-500",
    },
  ];

  return (
    <section
      id="features"
      className="py-20 bg-gradient-to-b from-purple-950 to-black"
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
            Key Capabilities & Applications
          </h2>
          <p className="text-xl text-white/70 max-w-3xl mx-auto">
            Discover how our multi-agent systems are pushing the boundaries of
            AI, from advanced simulations to evolving intelligence.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              delay={0.1 + index * 0.05}
              inView={inView}
              gradient={feature.gradient}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
  inView: boolean;
  gradient: string;
}

function FeatureCard({
  icon,
  title,
  description,
  delay,
  inView,
  gradient,
}: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay }}
      className="bg-black/30 backdrop-blur-lg rounded-xl p-8 border border-white/10 hover:border-white/20 transition-all hover:shadow-lg hover:shadow-purple-500/20 group"
    >
      <div
        className={`w-16 h-16 rounded-full bg-gradient-to-r ${gradient} p-0.5 mb-6 transform transition-transform group-hover:scale-110`}
      >
        <div className="w-full h-full rounded-full bg-black/80 backdrop-blur-sm flex items-center justify-center text-white">
          {icon}
        </div>
      </div>
      <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-cyan-400 transition-all">
        {title}
      </h3>
      <p className="text-white/70 group-hover:text-white/90 transition-colors">
        {description}
      </p>
    </motion.div>
  );
}
