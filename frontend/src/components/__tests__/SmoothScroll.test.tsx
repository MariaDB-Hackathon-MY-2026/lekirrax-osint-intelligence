import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SmoothScroll from '../SmoothScroll';
import React from 'react';

vi.mock('lenis/react', () => ({
  ReactLenis: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useLenis: () => undefined
}));

vi.mock('gsap', () => ({
  default: {
    registerPlugin: () => {}
  }
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    refresh: () => {},
    update: () => {}
  }
}));

describe('SmoothScroll Component', () => {
  it('renders children wrapped in Lenis', () => {
    const { getByText } = render(
      <SmoothScroll>
        <div>Scroll Content</div>
      </SmoothScroll>
    );
    expect(getByText('Scroll Content')).toBeInTheDocument();
  });
});
