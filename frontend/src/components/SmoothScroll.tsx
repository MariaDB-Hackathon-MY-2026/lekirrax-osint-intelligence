import React from 'react';
import { ReactLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';

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
      {children as any}
    </ReactLenis>
  );
};

export default SmoothScroll;
