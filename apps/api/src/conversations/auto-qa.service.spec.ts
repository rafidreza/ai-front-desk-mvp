import { describe, expect, it } from 'vitest';
import { AgentReply } from '../types/domain';
import { AutoQaService } from './auto-qa.service';

function reply(overrides: Partial<AgentReply> = {}): AgentReply {
  return {
    text: 'BDT 80 inside Dhaka.',
    confidence: 0.9,
    matchedKnowledgeIds: ['delivery-charge'],
    shouldEscalate: false,
    ...overrides,
  };
}

describe('AutoQaService', () => {
  it('passes grounded confident replies', () => {
    const service = new AutoQaService();

    const result = service.score({
      customerText: 'delivery charge?',
      reply: reply(),
    });

    expect(result.grade).toBe('pass');
    expect(result.score).toBe(100);
    expect(result.defects).toEqual([]);
  });

  it('fails no-match low-confidence fallback answers', () => {
    const service = new AutoQaService();

    const result = service.score({
      customerText: 'gift wrap ache?',
      reply: reply({
        text: 'Ami team ke check korte dicchi.',
        confidence: 0.3,
        matchedKnowledgeIds: [],
        shouldEscalate: true,
      }),
      ticket: {
        id: 'ticket-1',
        clientId: 'pilot-client',
        conversationId: 'conversation-1',
        version: 0,
        priority: 'P2',
        status: 'open',
        reason: 'Low knowledge confidence',
        customerMessage: 'gift wrap ache?',
        suggestedReply: 'Ami team ke check korte dicchi.',
        salesRecoveredEstimate: 1200,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    expect(result.grade).toBe('fail');
    expect(result.defects).toEqual(expect.arrayContaining(['low_confidence', 'no_knowledge_match', 'escalation_needed']));
  });

  it('fails escalation misses', () => {
    const service = new AutoQaService();

    const result = service.score({
      customerText: 'I want refund',
      reply: reply({
        shouldEscalate: true,
        escalationReason: 'Matched escalation keyword: refund',
      }),
    });

    expect(result.grade).toBe('fail');
    expect(result.defects).toEqual(expect.arrayContaining(['escalation_needed', 'escalation_miss']));
  });
});
