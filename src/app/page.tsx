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
        <div className="sr-only">
          <h2>About Detextit: Adaptive AI Agentic Systems</h2>
          <p>
            Detextit is at the forefront of evolving intelligence, offering a
            robust platform for developing and deploying stateful, long-living
            AI agents. Our core focus is on creating adaptive AI agentic systems
            that excel in complex simulations, dynamic benchmarking, and
            intelligent planning. We empower developers and researchers to build
            multi-agent systems that learn, adapt, and collaborate, driving
            innovation in fields ranging from advanced research to interactive
            entertainment.
          </p>
          <p>
            Key capabilities include advanced simulation environments for
            modeling intricate scenarios, self-improving evaluation mechanisms
            through dynamic benchmarking, and sophisticated planning tools for
            strategic decision-making. Detextit also fosters collaborative
            intelligence, enabling agents to share knowledge and achieve
            emergent solutions. Explore the future of AI with Detextit, where
            agentic systems unlock new possibilities.
          </p>
          <p>
            Our platform supports the creation of evolving agent architectures,
            leading to truly autonomous growth and learning. Discover how
            Detextit can help you build the next generation of intelligent
            systems, from complex problem-solving AI to engaging interactive
            agent-based entertainment.
          </p>
          <h3>Addressing Current Challenges in Agentic Systems</h3>
          <p>
            The field of AI agentic systems, particularly multi-agent systems,
            faces several significant roadblocks. Current agents are often
            primarily task-oriented and struggle to capture subtle social
            dynamics, build trust, engage in nuanced negotiation, or develop
            consistent &quot;personalities&quot; within long-living environments. These
            are crucial aspects for creating truly autonomous and collaborative
            entities.
          </p>
          <p>
            Furthermore, communication between agents can be costly and presents
            scalability challenges, hindering the development of large-scale
            multi-agent organizations. Error propagation is another concern;
            mistakes or biases in one agent can cascade through the system,
            affecting overall performance and reliability. Perhaps the most
            significant challenge lies in effectively organizing, storing, and
            retrieving memory, whether for individual agents or as a collective
            knowledge base. Detextit is actively working on solutions to these
            complex problems, aiming to advance the capabilities and
            practicality of agentic AI.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
