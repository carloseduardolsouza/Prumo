import { describe, expect, it } from 'vitest';
import { jobIdFor } from '../../../src/shared/queue.js';

describe('jobIdFor', () => {
  it('troca ":" (proibido no BullMQ) e é estável para a mesma chave', () => {
    const k = 'invoice.due_soon:abc:2026-11-20';
    expect(jobIdFor(k)).toBe('invoice.due_soon__abc__2026-11-20');
    expect(jobIdFor(k)).toBe(jobIdFor(k));
    expect(jobIdFor(k)).not.toContain(':');
  });
});
