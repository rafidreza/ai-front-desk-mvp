import { describe, expect, it } from 'vitest';
import { EmbeddingService, KNOWLEDGE_EMBEDDING_DIMENSIONS } from './embedding.service';

describe('EmbeddingService', () => {
  it('creates deterministic normalized vectors', () => {
    const service = new EmbeddingService();
    const first = service.embedText('delivery charge inside dhaka');
    const second = service.embedText('delivery charge inside dhaka');

    expect(first).toEqual(second);
    expect(first).toHaveLength(KNOWLEDGE_EMBEDDING_DIMENSIONS);
    expect(first.some((value) => value > 0)).toBe(true);
  });

  it('serializes vectors for pgvector SQL casts', () => {
    const service = new EmbeddingService();
    const sqlVector = service.toSqlVector([0.5, 0, 1]);

    expect(sqlVector).toBe('[0.500000,0.000000,1.000000]');
  });
});
