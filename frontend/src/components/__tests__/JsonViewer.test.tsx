import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import JsonViewer from '../JsonViewer';

afterEach(() => cleanup());

describe('JsonViewer', () => {
  it('renders a collapsible tree view', () => {
    render(<JsonViewer value={{ a: { b: 1 } }} defaultExpandDepth={0} mode="tree" />);

    const rootToggle = screen.getByText('Object(1)').closest('button');
    expect(rootToggle).toBeTruthy();
    fireEvent.click(rootToggle as HTMLElement);

    expect(screen.getByText('"a"')).toBeInTheDocument();
    expect(screen.queryByText('"b"')).not.toBeInTheDocument();

    const toggle = screen.getByText('"a"').closest('button');
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle as HTMLElement);

    expect(screen.getByText('"b"')).toBeInTheDocument();
  });

  it('supports keyboard toggle on nodes', () => {
    render(<JsonViewer value={{ a: { b: true } }} defaultExpandDepth={0} mode="tree" />);

    const rootToggle = screen.getByText('Object(1)').closest('button') as HTMLButtonElement;
    fireEvent.click(rootToggle);

    const toggle = screen.getByText('"a"').closest('button') as HTMLButtonElement;
    toggle.focus();
    fireEvent.keyDown(toggle, { key: 'Enter' });

    expect(screen.getByText('"b"')).toBeInTheDocument();
  });

  it('renders syntax highlighted code mode', () => {
    render(<JsonViewer value={{ a: 1, b: 'x' }} mode="code" />);
    const pre = screen.getByLabelText('Raw JSON output');
    expect(pre.innerHTML).toContain('json-s-key');
    expect(pre.innerHTML).toContain('json-s-number');
    expect(pre.innerHTML).toContain('json-s-string');
  });

  it('shows an error for malformed JSON strings', () => {
    render(<JsonViewer value={'{bad json'} mode="tree" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid JSON');
  });
});
