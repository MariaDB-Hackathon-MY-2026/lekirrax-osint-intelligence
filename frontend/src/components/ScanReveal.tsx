import React, { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register ScrollTrigger only once
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface ScanRevealProps {
    children: React.ReactNode;
    direction?: 'left' | 'right' | 'up' | 'down';
    delay?: number;
    className?: string;
    duration?: number;
    scanColor?: string;
    triggerStart?: string;
}

const ScanReveal: React.FC<ScanRevealProps> = ({ 
    children, 
    direction = 'up', 
    delay = 0,
    className = '',
    duration = 0.8,
    scanColor = 'var(--primary-color, #00ff9d)',
    triggerStart = "top 90%"
}) => {
    const el = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!el.current) return;

        const ctx = gsap.context((self) => {
            const mm = gsap.matchMedia();

            mm.add("(prefers-reduced-motion: reduce)", () => {
                // Reduced motion: instant appearance, no scan line
                gsap.set(el.current, { 
                    opacity: 1, 
                    y: 0, 
                    x: 0, 
                    scale: 1, 
                    filter: 'blur(0px)' 
                });
                if (self.selector) {
                     gsap.set(self.selector(".scan-line"), { opacity: 0 });
                }
            });

            mm.add("(prefers-reduced-motion: no-preference)", () => {
                // Main reveal animation
                gsap.fromTo(el.current, 
                    { 
                        opacity: 0, 
                        y: direction === 'up' ? 20 : direction === 'down' ? -20 : 0,
                        x: direction === 'left' ? 20 : direction === 'right' ? -20 : 0,
                        scale: 0.98,
                        filter: 'blur(5px)'
                    },
                    {
                        opacity: 1,
                        y: 0,
                        x: 0,
                        scale: 1,
                        filter: 'blur(0px)',
                        duration: duration,
                        delay: delay,
                        ease: "power2.out",
                        scrollTrigger: {
                            trigger: el.current,
                            start: triggerStart,
                            toggleActions: "play none none reverse"
                        }
                    }
                );

                // Scan line animation - SCOPED to this component
                if (self.selector) {
                    gsap.fromTo(self.selector(".scan-line"),
                        { top: '-20%', opacity: 0 },
                        {
                            top: '120%',
                            opacity: 0.8,
                            duration: 1.5,
                            ease: "power2.inOut",
                            scrollTrigger: {
                                trigger: el.current,
                                start: "top 85%",
                                toggleActions: "restart none none none"
                            }
                        }
                    );
                }
            });
        }, el); // Scope to el

        return () => ctx.revert();
    }, [direction, delay, duration, triggerStart]);

    return (
        <div ref={el} className={`scan-reveal-wrapper ${className}`} style={{ position: 'relative', overflow: 'hidden', willChange: 'transform, opacity' }}>
            {children}
            <div className="scan-line" style={{
                position: 'absolute',
                left: 0,
                width: '100%',
                height: '4px',
                background: `linear-gradient(90deg, transparent 0%, ${scanColor} 50%, transparent 100%)`,
                boxShadow: `0 0 15px ${scanColor}`,
                zIndex: 10,
                pointerEvents: 'none',
                opacity: 0
            }} />
        </div>
    );
};

export default ScanReveal;
