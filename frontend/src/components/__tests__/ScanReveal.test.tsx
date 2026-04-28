import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ScanReveal from '../ScanReveal';
import gsap from 'gsap';

// Mock GSAP
vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    context: vi.fn((cb) => {
      cb();
      return { revert: vi.fn() };
    }),
    matchMedia: vi.fn(() => ({
      add: vi.fn((query, cb) => {
        // Execute callback only for no-preference to simulate normal behavior
        if (query === "(prefers-reduced-motion: no-preference)") {
            cb();
        }
      }),
      revert: vi.fn(),
    })),
    fromTo: vi.fn(),
    to: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    refresh: vi.fn(),
    update: vi.fn()
  },
}));

describe('ScanReveal Component', () => {
  it('renders children correctly', () => {
    render(
      <ScanReveal>
        <div data-testid="child">Test Content</div>
      </ScanReveal>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders the scan line', () => {
    const { container } = render(
      <ScanReveal>
        <div>Content</div>
      </ScanReveal>
    );
    // The scan line is the div with class "scan-line"
    const scanLine = container.querySelector('.scan-line');
    expect(scanLine).toBeInTheDocument();
  });

  it('calls gsap with correct configuration', () => {
    render(
      <ScanReveal duration={1.5} delay={0.5}>
        <div>Content</div>
      </ScanReveal>
    );
    
    expect(gsap.fromTo).toHaveBeenCalled();
    
    const calls = vi.mocked(gsap.fromTo).mock.calls;
    const revealCall = calls.find((call: any) => call[2].delay === 0.5);
    
    expect(revealCall).toBeDefined();
    if (revealCall) {
        expect(revealCall[2]).toEqual(expect.objectContaining({
            duration: 1.5,
            delay: 0.5,
            scrollTrigger: expect.objectContaining({
                start: "top 90%"
            })
        }));
    }
  });

  it('handles reduced motion correctly', () => {
    render(
      <ScanReveal>
        <div>Content</div>
      </ScanReveal>
    );

    const matchMediaMock = vi.mocked(gsap.matchMedia);

    const context = matchMediaMock.mock.results[matchMediaMock.mock.results.length - 1].value;
    
    // Find the call to add with reduced motion query
    const addMock = context.add as any;
    const reducedMotionCall = addMock.mock.calls.find((call: any) => call[0] === "(prefers-reduced-motion: reduce)");
    
    expect(reducedMotionCall).toBeDefined();
    
    // Execute the callback
    const callback = reducedMotionCall[1];
    callback(); 
    
    expect(gsap.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ opacity: 1, filter: 'blur(0px)' }));
    expect(gsap.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ opacity: 0 }));
  });
});
