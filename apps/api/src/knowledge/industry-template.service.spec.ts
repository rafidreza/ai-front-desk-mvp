import { describe, expect, it, vi } from 'vitest';
import { IndustryTemplateService } from './industry-template.service';
import { KnowledgeEntry } from '../types/domain';

function fakeKnowledgeService(options?: { existingTemplateKeys?: string[] }) {
  const existing = new Set(options?.existingTemplateKeys ?? []);
  const created: Array<{ clientId: string; templateKey?: string; title: string }> = [];

  return {
    created,
    knowledge: {
      findByTemplateKey: vi.fn(async (_clientId: string, templateKey: string): Promise<KnowledgeEntry | null> => {
        if (existing.has(templateKey)) {
          return {
            id: `existing-${templateKey}`,
            clientId: _clientId,
            title: 'Existing',
            answer: 'Existing',
            keywords: [],
            status: 'draft',
            version: 1,
            templateKey,
          };
        }
        return null;
      }),
      createDraft: vi.fn(async (input: {
        clientId: string;
        title: string;
        answer: string;
        keywords: string[];
        templateKey?: string;
        actorId?: string;
      }): Promise<KnowledgeEntry> => {
        created.push({ clientId: input.clientId, templateKey: input.templateKey, title: input.title });
        return {
          id: `kb-${created.length}`,
          clientId: input.clientId,
          title: input.title,
          answer: input.answer,
          keywords: input.keywords,
          status: 'draft',
          version: 1,
          templateKey: input.templateKey,
        };
      }),
    },
  };
}

describe('IndustryTemplateService', () => {
  it('lists at least the clothing template', () => {
    const service = new IndustryTemplateService(fakeKnowledgeService().knowledge as never);
    const list = service.list();

    const clothing = list.find((item) => item.key === 'clothing');
    expect(clothing).toBeDefined();
    expect(clothing?.entryCount).toBeGreaterThan(10);
  });

  it('returns the clothing template detail', () => {
    const service = new IndustryTemplateService(fakeKnowledgeService().knowledge as never);
    const template = service.get('clothing');

    expect(template.key).toBe('clothing');
    expect(template.entries.some((entry) => entry.slug === 'delivery-charge')).toBe(true);
    expect(template.entries.some((entry) => entry.slug === 'return-policy')).toBe(true);
  });

  it('throws when an unknown template key is requested', () => {
    const service = new IndustryTemplateService(fakeKnowledgeService().knowledge as never);

    expect(() => service.get('unknown-vertical')).toThrowError(/not found/i);
  });

  it('applies the template by creating one draft entry per slug, stamping a composite templateKey', async () => {
    const fake = fakeKnowledgeService();
    const service = new IndustryTemplateService(fake.knowledge as never);

    const result = await service.apply({ clientId: 'client-1', templateKey: 'clothing' });

    expect(result.templateKey).toBe('clothing');
    expect(result.skipped).toHaveLength(0);
    expect(result.applied.length).toBeGreaterThan(10);
    expect(result.applied[0]?.templateKey).toMatch(/^clothing:/);
    expect(fake.knowledge.createDraft).toHaveBeenCalled();
    const firstCall = fake.knowledge.createDraft.mock.calls[0]?.[0];
    expect(firstCall?.templateKey).toMatch(/^clothing:/);
    expect(firstCall?.actorId).toMatch(/^industry-template:clothing/);
  });

  it('is idempotent: skips entries whose composite templateKey already exists', async () => {
    const fake = fakeKnowledgeService({ existingTemplateKeys: ['clothing:delivery-charge', 'clothing:return-policy'] });
    const service = new IndustryTemplateService(fake.knowledge as never);

    const result = await service.apply({ clientId: 'client-1', templateKey: 'clothing' });

    expect(result.skipped.map((item) => item.slug).sort()).toEqual(['delivery-charge', 'return-policy']);
    const appliedSlugs = result.applied.map((entry) => entry.templateKey);
    expect(appliedSlugs).not.toContain('clothing:delivery-charge');
    expect(appliedSlugs).not.toContain('clothing:return-policy');
  });
});
