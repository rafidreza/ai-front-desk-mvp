import { Injectable } from '@nestjs/common';

export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 64;

@Injectable()
export class EmbeddingService {
  embedText(text: string): number[] {
    const vector = new Array<number>(KNOWLEDGE_EMBEDDING_DIMENSIONS).fill(0);
    const tokens = text
      .toLowerCase()
      .normalize('NFKC')
      .split(/[^\p{L}\p{N}]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length > 1);

    tokens.forEach((token) => {
      const index = this.hash(token) % KNOWLEDGE_EMBEDDING_DIMENSIONS;
      vector[index] += 1;
    });

    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (magnitude === 0) return vector;
    return vector.map((value) => Number((value / magnitude).toFixed(6)));
  }

  toSqlVector(vector: number[]) {
    return `[${vector.map((value) => Number(value).toFixed(6)).join(',')}]`;
  }

  private hash(input: string) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}
