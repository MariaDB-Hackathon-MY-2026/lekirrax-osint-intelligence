import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SmoothScroll from '../SmoothScroll';
import React from 'react';

// Mock ReactLenis
vi.mock('lenis/react', () => ({
  ReactLenis: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

