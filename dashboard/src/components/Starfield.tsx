"use client";

import React, { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkleSpeed: number;
  twinkleDir: number;
  layer: number;
}

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, tX: 0, tY: 0 }); // Target and Current

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const initStars = () => {
      const stars: Star[] = [];
      // Ultra-sharp surgical background stars
      for (let i = 0; i < 250; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: 0.5,
          opacity: 0.05 + Math.random() * 0.15,
          twinkleSpeed: 0,
          twinkleDir: 0,
          layer: 1,
        });
      }
      // Twinkling core stars
      for (let i = 0; i < 40; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: 1.1,
          opacity: 0.4 + Math.random() * 0.6,
          twinkleSpeed: 0.003 + Math.random() * 0.007,
          twinkleDir: 1,
          layer: 2,
        });
      }
      starsRef.current = stars;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.tX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      mouseRef.current.tY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    };

    const draw = () => {
      if (!ctx || !canvas) return;
      
      // Damping for fluid mouse motion
      mouseRef.current.x += (mouseRef.current.tX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.tY - mouseRef.current.y) * 0.05;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const { x: mX, y: mY } = mouseRef.current;

      // 1. PRIMARY REFRACTIVE MESH (Deep Navy-Black base)
      ctx.fillStyle = "#05050D";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. DYNAMIC AURORA BLOB 
      const gradient1 = ctx.createRadialGradient(
        canvas.width * 0.5 + mX * 200, canvas.height * 0.5 + mY * 200, 0,
        canvas.width * 0.5 + mX * 200, canvas.height * 0.5 + mY * 200, canvas.width * 0.8
      );
      gradient1.addColorStop(0, "rgba(0, 118, 255, 0.04)");
      gradient1.addColorStop(0.5, "rgba(124, 58, 237, 0.02)");
      gradient1.addColorStop(1, "transparent");
      ctx.fillStyle = gradient1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 3. CURSOR RIPlLE DISTORTION
      const rippleGradient = ctx.createRadialGradient(
        (mouseRef.current.tX * (window.innerWidth / 2)) + (window.innerWidth / 2),
        (mouseRef.current.tY * (window.innerHeight / 2)) + (window.innerHeight / 2),
        0,
        (mouseRef.current.tX * (window.innerWidth / 2)) + (window.innerWidth / 2),
        (mouseRef.current.tY * (window.innerHeight / 2)) + (window.innerHeight / 2),
        400
      );
      rippleGradient.addColorStop(0, "rgba(255, 255, 255, 0.02)");
      rippleGradient.addColorStop(1, "transparent");
      ctx.fillStyle = rippleGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 4. STAR RENDER (Parallax + Refraction)
      starsRef.current.forEach((star) => {
        if (star.layer === 2) {
          star.opacity += star.twinkleSpeed * star.twinkleDir;
          if (star.opacity > 1 || star.opacity < 0.2) star.twinkleDir *= -1;
        }

        const pFactor = star.layer === 1 ? 10 : 40;
        const sX = star.x + mX * pFactor;
        const sY = star.y + mY * pFactor;

        ctx.fillStyle = `rgba(240, 239, 255, ${star.opacity})`;
        ctx.beginPath();
        ctx.arc(sX, sY, star.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add subtle star glow for bright ones
        if (star.layer === 2 && star.opacity > 0.8) {
           ctx.shadowBlur = 4;
           ctx.shadowColor = "rgba(0, 118, 255, 0.5)";
           ctx.stroke();
           ctx.shadowBlur = 0;
        }
      });

      requestAnimationFrame(draw);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    resize();
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 z-0 pointer-events-none"
    />
  );
}
