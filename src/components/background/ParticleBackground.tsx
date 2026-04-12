import { useEffect, useRef } from "react";
import { initParticles } from "./particle";

export default function ParticleBackground() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        if (canvasRef.current) {
        initParticles(canvasRef.current);
        }
    }, []);

    return (
        <canvas
        ref={canvasRef}
        style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            background: "#000",
        }}
        />
    );
    }