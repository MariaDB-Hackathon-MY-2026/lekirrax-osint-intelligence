import React, { useEffect } from 'react';
import { ReactLenis, useLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface SmoothScrollProps {
  children: React.ReactNode;
  options?: {
    duration?: number;
    smoothWheel?: boolean;
    [key: string]: any;
  };
}

const SmoothScroll: React.FC<SmoothScrollProps> = ({ children, options }) => {
  const defaultOptions = { duration: 1.2, smoothWheel: true };
  const mergedOptions = { ...defaultOptions, ...options };

  return (
    <ReactLenis root options={mergedOptions}>
      <ScrollSync />
      {children as any}
    </ReactLenis>
  );
};

function ScrollSync() {
  const lenis = useLenis();

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
  }, []);

  useEffect(() => {
    if (!lenis) return;

    const onScroll = () => {
      ScrollTrigger.update();
    };

    lenis.on('scroll', onScroll);
    ScrollTrigger.refresh();

    return () => {
      lenis.off('scroll', onScroll);
    };
  }, [lenis]);

  return (
    null
  );
}

export default SmoothScroll;
