import { describe, expect, it } from 'vitest';
import { scoreRubric } from '../src/services/interaction-scoring';

describe('scoreRubric', () => {
  it('scores a good, grounded call high', () => {
    const r = scoreRubric({
      firstAiText: 'Hello, thank you for calling ABC.',
      lastAiText: 'Thank you, have a good day.',
      verdicts: [{ verdict: 'grounded' }, { verdict: 'grounded' }],
    });
    expect(r.score).toBe(100);
    expect(r.flagged).toBe(false);
    expect(r.breakdown).toEqual({ greeting: 20, closing: 20, groundedness: 60 });
  });

  it('penalises ungrounded turns via the groundedness component', () => {
    const r = scoreRubric({
      firstAiText: 'Hello there.',
      lastAiText: 'Thanks, bye.',
      verdicts: [{ verdict: 'grounded' }, { verdict: 'ungrounded' }],
    });
    expect(r.breakdown.groundedness).toBe(30);
    expect(r.score).toBe(70);
  });

  it('flags a poor call (no greeting/closing, ungrounded)', () => {
    const r = scoreRubric({
      firstAiText: 'What do you want.',
      lastAiText: 'Okay.',
      verdicts: [{ verdict: 'ungrounded' }],
    });
    expect(r.breakdown).toEqual({ greeting: 0, closing: 0, groundedness: 0 });
    expect(r.score).toBe(0);
    expect(r.flagged).toBe(true);
  });

  it('defaults groundedness when there are no verdicts', () => {
    const r = scoreRubric({ firstAiText: 'Hello', lastAiText: 'Thank you', verdicts: [] });
    expect(r.breakdown.groundedness).toBe(60);
  });
});
