import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';

function createMockChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

describe('runPhoneInvestigator (python enrichment)', () => {
  it('does not permanently disable python lookup on timeout', async () => {
    vi.useFakeTimers();
    vi.resetModules();

    const spawnMock = vi.fn(() => createMockChild());
    vi.doMock('node:child_process', () => ({ spawn: spawnMock, default: { spawn: spawnMock } }));

    const { runPhoneInvestigator } = await import('../phoneInvestigator.js');

    const p1 = runPhoneInvestigator('+60177781684', { pyLookupEnabled: true, pyTimeoutMs: 5 });
    await vi.runAllTimersAsync();
    await p1;

    const callsAfterFirst = spawnMock.mock.calls.length;

    const p2 = runPhoneInvestigator('+60177781684', { pyLookupEnabled: true, pyTimeoutMs: 5 });
    await vi.runAllTimersAsync();
    await p2;

    expect(spawnMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);

    vi.useRealTimers();
  });
});
