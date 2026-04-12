import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';

interface Particle3DTextBackgroundProps {
  text?: string;
}

const Particle3DTextBackground: React.FC<Particle3DTextBackgroundProps> = ({ text = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    updateText: (newText: string) => void;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Configuration ---
    const MAX_PARTICLES = 5000; // Fixed pool size
    // const PARTICLE_SIZE = 0.5; // Unused, controlled by shader
    const PARTICLE_COLOR = 0x00ffff; // Cyan/Teal
    const BG_COLOR = 0x000510; // Deep Navy/Black
    const SPHERE_RADIUS = 35;
    const FONT_SIZE = 45;
    const FONT_FAMILY = 'Orbitron, sans-serif';
    
    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(BG_COLOR, 0.005);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 100;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(BG_COLOR, 1);
    containerRef.current.appendChild(renderer.domElement);

    // --- Particle System ---
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const opacities = new Float32Array(MAX_PARTICLES); // For fading unused particles
    
    // Data storage for morphing
    const spherePositions: Float32Array = new Float32Array(MAX_PARTICLES * 3);
    const textPositions: Float32Array = new Float32Array(MAX_PARTICLES * 3); // Target text positions
    const currentTextPositions: Float32Array = new Float32Array(MAX_PARTICLES * 3); // Interpolated text positions for smooth updates
    
    // Initialize Sphere Positions (Fibonacci Sphere for even distribution)
    for (let i = 0; i < MAX_PARTICLES; i++) {
        const phi = Math.acos(-1 + (2 * i) / MAX_PARTICLES);
        const theta = Math.sqrt(MAX_PARTICLES * Math.PI) * phi;
        
        const x = SPHERE_RADIUS * Math.cos(theta) * Math.sin(phi);
        const y = SPHERE_RADIUS * Math.sin(theta) * Math.sin(phi);
        const z = SPHERE_RADIUS * Math.cos(phi);
        
        spherePositions[i * 3] = x;
        spherePositions[i * 3 + 1] = y;
        spherePositions[i * 3 + 2] = z;
        
        // Initial state: Sphere
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        opacities[i] = 1.0;
        
        // Init text positions to center (to avoid NaN if used before calculation)
        textPositions[i * 3] = 0;
        textPositions[i * 3 + 1] = 0;
        textPositions[i * 3 + 2] = 0;
        
        currentTextPositions[i * 3] = x;
        currentTextPositions[i * 3 + 1] = y;
        currentTextPositions[i * 3 + 2] = z;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    // We can't easily attribute opacity to PointsMaterial per vertex without custom shader.
    // Standard PointsMaterial supports vertexColors but not vertexOpacity directly.
    // For simplicity, we will simulate opacity by "hiding" unused particles (scale 0 or move away).
    // Or we use a custom shader material.
    // Let's use a Custom Shader Material for best results (colors + opacity).
    
    // Shader Material - Optimized to handle rotation and morphing on GPU
    const material = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(PARTICLE_COLOR) },
            uTime: { value: 0 },
            uMorphRatio: { value: 0 },
            uSphereRotationY: { value: 0 },
            uSphereRotationX: { value: 0 },
        },
        vertexShader: `
            attribute float alpha;
            attribute vec3 spherePos;
            attribute vec3 textPos;
            
            uniform float uTime;
            uniform float uMorphRatio;
            uniform float uSphereRotationY;
            uniform float uSphereRotationX;
            
            varying float vAlpha;
            
            void main() {
                vAlpha = alpha;
                
                // 1. Rotate Sphere Position
                float cosY = cos(uSphereRotationY);
                float sinY = sin(uSphereRotationY);
                vec3 rotatedSphere = spherePos;
                rotatedSphere.xz = vec2(
                    spherePos.x * cosY - spherePos.z * sinY,
                    spherePos.x * sinY + spherePos.z * cosY
                );
                
                // 2. Interpolate Position (Morph)
                vec3 mixedPos = mix(rotatedSphere, textPos, uMorphRatio);
                
                vec4 mvPosition = modelViewMatrix * vec4(mixedPos, 1.0);
                gl_PointSize = (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            varying float vAlpha;
            void main() {
                if (vAlpha < 0.01) discard;
                vec2 coord = gl_PointCoord - vec2(0.5);
                if(length(coord) > 0.5) discard;
                float strength = 1.0 - (length(coord) * 2.0);
                strength = pow(strength, 2.0);
                gl_FragColor = vec4(color, vAlpha * strength);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    
    // Add attributes for GPU-based morphing
    geometry.setAttribute('alpha', new THREE.BufferAttribute(opacities, 1));
    geometry.setAttribute('spherePos', new THREE.BufferAttribute(spherePositions, 3));
    geometry.setAttribute('textPos', new THREE.BufferAttribute(textPositions, 3));

    const particles = new THREE.Points(geometry, material);
    particles.position.y = 40;
    scene.add(particles);

    // --- Text Sampling Logic ---
    const coordsCache = new Map<string, { x: number, y: number }[]>();
    const sampleCoordinates = (str: string): { x: number, y: number }[] => {
        if (!str.trim()) return [];
        if (coordsCache.has(str)) return coordsCache.get(str)!;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return [];

        const width = 1000;
        const height = 300;
        canvas.width = width;
        canvas.height = height;

        ctx.font = `bold ${FONT_SIZE}px ${FONT_FAMILY}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(str, width / 2, height / 2);

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const coords: { x: number, y: number }[] = [];

        const step = 2; 

        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
                const index = (y * width + x) * 4;
                if (data[index] > 128) {
                    coords.push({
                        x: (x - width / 2) * 0.5,
                        y: -(y - height / 2) * 0.5
                    });
                }
            }
        }
        coordsCache.set(str, coords);
        return coords;
    };

    // Animation State
    const state = {
        morphRatio: 0, 
        textParticleCount: 0,
    };

    // Update Text Target Positions
    const updateTextTargets = (newText: string) => {
        const coords = sampleCoordinates(newText);
        state.textParticleCount = coords.length;
        
        const shuffledCoords = [...coords];
        for (let i = shuffledCoords.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledCoords[i], shuffledCoords[j]] = [shuffledCoords[j], shuffledCoords[i]];
        }

        const textPosAttr = geometry.getAttribute('textPos') as THREE.BufferAttribute;
        const alphaAttr = geometry.getAttribute('alpha') as THREE.BufferAttribute;

        for (let i = 0; i < MAX_PARTICLES; i++) {
            if (i < shuffledCoords.length) {
                textPosAttr.setXYZ(i, shuffledCoords[i].x, shuffledCoords[i].y, 0);
                alphaAttr.setX(i, 1.0);
            } else {
                textPosAttr.setXYZ(i, spherePositions[i * 3], spherePositions[i * 3 + 1], spherePositions[i * 3 + 2]);
                // Alpha will be handled by morphRatio for unused particles
                alphaAttr.setX(i, 1.0 - state.morphRatio);
            }
        }
        textPosAttr.needsUpdate = true;
        alphaAttr.needsUpdate = true;
    };
    
    // Expose update function via ref
    sceneRef.current = {
        updateText: (newText) => {
            const isEmpty = !newText.trim();
            
            if (!isEmpty) {
                updateTextTargets(newText);
                gsap.to(state, {
                    morphRatio: 1,
                    duration: 1.5,
                    ease: "power3.inOut"
                });
            } else {
                gsap.to(state, {
                    morphRatio: 0,
                    duration: 1.5,
                    ease: "power3.inOut"
                });
            }
        }
    };

    // Initial Load
    sceneRef.current.updateText(text);

    // --- Animation Loop ---
    let frameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
        frameId = requestAnimationFrame(animate);
        const time = clock.getElapsedTime();

        // Pass simple uniforms to GPU - NO HEAVY LOOPS HERE!
        material.uniforms.uTime.value = time;
        material.uniforms.uMorphRatio.value = state.morphRatio;
        material.uniforms.uSphereRotationY.value = time * 0.2;
        material.uniforms.uSphereRotationX.value = time * 0.1;

        // Dynamic alpha for unused particles based on current morphRatio
        const alphaAttr = geometry.getAttribute('alpha') as THREE.BufferAttribute;
        for (let i = state.textParticleCount; i < MAX_PARTICLES; i++) {
            alphaAttr.setX(i, 1.0 - state.morphRatio);
        }
        alphaAttr.needsUpdate = true;

        renderer.render(scene, camera);
    };

    animate();

    // --- Resize Handler ---
    const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    const container = containerRef.current;

    // --- Cleanup ---
    return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(frameId);
        if (container && renderer.domElement) {
            container.removeChild(renderer.domElement);
        }
        geometry.dispose();
        material.dispose();
        renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // React to prop changes by calling the ref method
  useEffect(() => {
    if (sceneRef.current) {
        sceneRef.current.updateText(text);
    }
  }, [text]);

  return (
    <div 
      ref={containerRef} 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        backgroundColor: '#000510'
      }}
    />
  );
};

export default Particle3DTextBackground;
