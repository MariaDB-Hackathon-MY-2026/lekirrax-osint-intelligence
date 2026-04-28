import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import HistoryNavButton from '../HistoryNavButton';

describe('HistoryNavButton', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders as a link with an accessible label', () => {
    render(<HistoryNavButton />);
    const link = screen.getByLabelText('Open scan history');
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('#/history');
  });

  it('calls onNavigate when clicked', () => {
    const onNavigate = () => {};
    const spy = vi.spyOn({ onNavigate }, 'onNavigate');

    render(<HistoryNavButton onNavigate={spy} />);
    fireEvent.click(screen.getByLabelText('Open scan history'));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
