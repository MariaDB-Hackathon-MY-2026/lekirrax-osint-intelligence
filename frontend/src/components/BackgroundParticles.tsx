import { useEffect, useRef } from "react";

export default function BackgroundParticles() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d")!;

        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const particles: { x: number; y: number; vx: number; vy: number }[] = [];
        const COUNT = 150;

        for (let i = 0; i < COUNT; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
        });
        }

        function draw() {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#00ff9c";

        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0 || p.x > width) p.vx *= -1;
            if (p.y < 0 || p.y > height) p.vy *= -1;

            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        requestAnimationFrame(draw);
        }

        draw();

        const resize = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        };

        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, []);

    return (
        <canvas
        ref={canvasRef}
        style={{
            position: "fixed",
            inset: 0,
            background: "black",
            zIndex: -1,
        }}
        />
    );
    }