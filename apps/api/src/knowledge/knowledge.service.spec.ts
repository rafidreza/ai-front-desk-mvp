import { describe, expect, it } from 'vitest';
import { KnowledgeService } from './knowledge.service';

describe('KnowledgeService (in-memory fallback)', () => {
  it('matches a delivery question to the delivery KB entry', async () => {
    const service = new KnowledgeService();
    const match = await service.findRelevant('pilot-client', 'delivery charge koto?');

    expect(match.entries[0]?.id).toBe('delivery-charge');
    expect(match.confidence).toBeGreaterThan(0.55);
  });

  it('returns zero matches for an off-topic message', async () => {
    const service = new KnowledgeService();
    const match = await service.findRelevant('pilot-client', 'where do you ship to mars');

    expect(match.entries).toHaveLength(0);
    expect(match.confidence).toBeLessThan(0.5);
  });

  it('isolates entries per client id', async () => {
    const service = new KnowledgeService();
    const match = await service.findRelevant('different-client', 'delivery charge koto?');

    expect(match.entries).toHaveLength(0);
  });

  it('matches Bangla keywords', async () => {
    const service = new KnowledgeService();
    const match = await service.findRelevant('pilot-client', 'ডেলিভারি চার্জ কত?');

    expect(match.entries[0]?.id).toBe('delivery-charge');
  });
});
