"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// Add type declaration for deviceMemory
declare global {
  interface Navigator {
    deviceMemory?: number;
  }
}

export default function ThreeScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLowPerfDevice, setIsLowPerfDevice] = useState(false);

  useEffect(() => {
    // Check if device is likely low performance
    const checkPerformance = () => {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isLowMemory =
        navigator.deviceMemory !== undefined && navigator.deviceMemory < 4;
      return isMobile || isLowMemory || window.innerWidth < 768;
    };

    setIsLowPerfDevice(checkPerformance());

    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 15;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: !isLowPerfDevice,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(
      isLowPerfDevice ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    containerRef.current.appendChild(renderer.domElement);

    // Auto rotation without OrbitControls
    let autoRotationAngle = 0;

    // Lights - use fewer lights for better performance
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Create a group for all agents
    const agentsGroup = new THREE.Group();
    scene.add(agentsGroup);

    // Create agents (nodes)
    const agentCount = isLowPerfDevice ? 12 : 25;
    const agentGeometry = new THREE.SphereGeometry(
      0.15,
      isLowPerfDevice ? 8 : 12,
      isLowPerfDevice ? 8 : 12
    );

    const agentMaterials = [
      new THREE.MeshBasicMaterial({ color: 0x8a2be2 }), // Purple
      new THREE.MeshBasicMaterial({ color: 0x00ffff }), // Cyan
      new THREE.MeshBasicMaterial({ color: 0xff1493 }), // Pink
    ];

    const agents: THREE.Mesh[] = [];
    const agentVelocities: THREE.Vector3[] = [];

    for (let i = 0; i < agentCount; i++) {
      const agent = new THREE.Mesh(
        agentGeometry,
        agentMaterials[Math.floor(Math.random() * agentMaterials.length)]
      );

      // Random position within a sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 5 + Math.random() * 5;

      agent.position.x = radius * Math.sin(phi) * Math.cos(theta);
      agent.position.y = radius * Math.sin(phi) * Math.sin(theta);
      agent.position.z = radius * Math.cos(phi);

      agentVelocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.005,
          (Math.random() - 0.5) * 0.005,
          (Math.random() - 0.5) * 0.005
        )
      );

      agents.push(agent);
      agentsGroup.add(agent);
    }

    // Create connections between agents
    const connectionsMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
    });

    const connections: THREE.Line[] = [];
    const maxConnectionDistance = 3;

    // Only update connections every few frames to improve performance
    let frameCount = 0;
    const connectionUpdateInterval = isLowPerfDevice ? 60 : 20;

    function updateConnections() {
      // Skip connection updates on some frames
      frameCount++;
      if (frameCount % connectionUpdateInterval !== 0) return;

      // Remove old connections
      connections.forEach((connection) => {
        agentsGroup.remove(connection);
        if (connection.geometry) {
          connection.geometry.dispose();
        }
        if (connection.material) {
          (connection.material as THREE.Material).dispose();
        }
      });
      connections.length = 0;

      // Create new connections based on proximity
      for (let i = 0; i < agents.length; i++) {
        // Limit connections per agent for performance
        const maxConnectionsPerAgent = isLowPerfDevice ? 1 : 3;
        let connectionsForThisAgent = 0;

        for (let j = i + 1; j < agents.length; j++) {
          if (connectionsForThisAgent >= maxConnectionsPerAgent) break;

          const distance = agents[i].position.distanceTo(agents[j].position);

          if (distance < maxConnectionDistance) {
            const opacity = 1 - distance / maxConnectionDistance;

            const geometry = new THREE.BufferGeometry().setFromPoints([
              agents[i].position,
              agents[j].position,
            ]);

            const material = new THREE.LineBasicMaterial({
              color: 0xffffff,
              transparent: true,
              opacity: opacity * 0.2,
            });

            const line = new THREE.Line(geometry, material);
            connections.push(line);
            agentsGroup.add(line);
            connectionsForThisAgent++;
          }
        }
      }
    }

    // Particle system for background - skip on low perf devices or use fewer particles
    let particlesMesh: THREE.Points | null = null;
    if (!isLowPerfDevice) {
      const particlesGeometry = new THREE.BufferGeometry();
      const particleCount = 300;

      const posArray = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 50;
      }

      particlesGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(posArray, 3)
      );

      const particlesMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
      });

      particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
      scene.add(particlesMesh);
    }

    // Animation with requestAnimationFrame throttling for low-end devices
    let lastFrameTime = 0;
    const targetFPS = isLowPerfDevice ? 24 : 60;
    const frameInterval = 1000 / targetFPS;

    function animate(currentTime: number) {
      requestAnimationFrame(animate);

      // Throttle frame rate for performance
      if (currentTime - lastFrameTime < frameInterval) return;
      lastFrameTime = currentTime;

      // Update agent positions
      for (let i = 0; i < agents.length; i++) {
        agents[i].position.add(agentVelocities[i]);

        // Boundary check and bounce
        if (agents[i].position.length() > 12) {
          agentVelocities[i].negate();
        }
      }

      // Update connections
      updateConnections();

      // Rotate the entire agent group
      autoRotationAngle += isLowPerfDevice ? 0.0005 : 0.001;
      agentsGroup.rotation.y = autoRotationAngle;

      // Rotate particle system if it exists
      if (particlesMesh) {
        particlesMesh.rotation.x += 0.0001;
        particlesMesh.rotation.y += 0.0001;
      }

      // Render
      renderer.render(scene, camera);
    }

    // Handle window resize efficiently
    function handleResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Debounce resize handler
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 100);
    };

    window.addEventListener("resize", debouncedResize);

    // Start animation
    animate(0);

    // Cleanup
    return () => {
      window.removeEventListener("resize", debouncedResize);
      if (
        containerRef.current &&
        containerRef.current.contains(renderer.domElement)
      ) {
        containerRef.current.removeChild(renderer.domElement);
      }

      // Dispose of geometries and materials
      agentGeometry.dispose();
      agentMaterials.forEach((material) => material.dispose());

      connections.forEach((connection) => {
        if (connection.geometry) connection.geometry.dispose();
        if (connection.material)
          (connection.material as THREE.Material).dispose();
      });

      // Dispose of particle system if it exists
      if (particlesMesh) {
        if (particlesMesh.geometry) particlesMesh.geometry.dispose();
        if (particlesMesh.material)
          (particlesMesh.material as THREE.Material).dispose();
      }

      renderer.dispose();
    };
  }, [isLowPerfDevice]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
