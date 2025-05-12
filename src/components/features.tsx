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
} from "lucide-react";

export default function Features() {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  const features = [
    {
      icon: <Database className="w-10 h-10" />,
      title: "Collective Memory Systems",
      description:
        "Building shared knowledge repositories that enable multi-agent systems to collaborate with context awareness and maintain consistent understanding over time.",
      gradient: "from-purple-500 to-blue-500",
    },
    {
      icon: <Brain className="w-10 h-10" />,
      title: "Agent-Centric Goals",
      description:
        "Moving beyond purely task-focused agents to create systems with personal objectives, preferences, and identities that drive more realistic and nuanced behaviors.",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: <MessageSquare className="w-10 h-10" />,
      title: "Advanced Communication",
      description:
        "Developing sophisticated protocols that enable agents to exchange complex ideas, negotiate effectively, and coordinate actions with minimal overhead.",
      gradient: "from-cyan-500 to-emerald-500",
    },
    {
      icon: <Shield className="w-10 h-10" />,
      title: "Error Recovery",
      description:
        "Implementing robust mechanisms for detecting failures, understanding system limitations, and gracefully recovering from unexpected scenarios.",
      gradient: "from-emerald-500 to-yellow-500",
    },
    {
      icon: <Users className="w-10 h-10" />,
      title: "Subtle Dynamics",
      description:
        "Capturing the nuanced relationship patterns between agents, including emergent social hierarchies, cooperation strategies, and adaptive behaviors.",
      gradient: "from-yellow-500 to-orange-500",
    },
    {
      icon: <AlertTriangle className="w-10 h-10" />,
      title: "Cost & Scale Optimization",
      description:
        "Addressing the computational and resource challenges of multi-agent systems to make them more efficient, affordable, and scalable for real-world applications.",
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
            Solving Key Challenges
          </h2>
          <p className="text-xl text-white/70 max-w-3xl mx-auto">
            Addressing the most significant obstacles in multi-agent systems to
            unlock their full potential
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
