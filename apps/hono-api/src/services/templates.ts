import clothingTemplate from '../../../api/src/knowledge/industry-templates/clothing.json';
import type { KnowledgeEntry } from '@ai-front-desk/shared';
import { NotFoundError } from '../errors';
import type { KnowledgeService } from './knowledge';

interface IndustryTemplateEntry {
  slug: string;
  title: string;
  answer: string;
  keywords: string[];
  confidenceBoost?: number;
}

interface IndustryTemplate {
  key: string;
  label: string;
  description: string;
  language: string;
  entries: IndustryTemplateEntry[];
}

function templateEntryKey(templateKey: string, slug: string) {
  return `${templateKey}:${slug}`;
}

const templates = [clothingTemplate as IndustryTemplate];
const templatesByKey = new Map(templates.map((template) => [template.key, template]));

export class IndustryTemplateService {
  constructor(private readonly knowledge: KnowledgeService) {}

  list() {
    return templates.map((template) => ({
      key: template.key,
      label: template.label,
      description: template.description,
      language: template.language,
      entryCount: template.entries.length,
    }));
  }

  get(key: string) {
    const template = templatesByKey.get(key);
    if (template === undefined) throw new NotFoundError(`Industry template not found: ${key}`);
    return template;
  }

  async apply(input: { clientId: string; templateKey: string; actorId?: string }): Promise<{ templateKey: string; applied: KnowledgeEntry[]; skipped: { slug: string; reason: string }[] }> {
    const template = this.get(input.templateKey);
    const applied = [];
    const skipped = [];
    for (const entry of template.entries) {
      const compositeKey = templateEntryKey(template.key, entry.slug);
      const existing = await this.knowledge.findByTemplateKey(input.clientId, compositeKey);
      if (existing !== null) {
        skipped.push({ slug: entry.slug, reason: 'already-applied' });
        continue;
      }
      applied.push(
        await this.knowledge.createDraft({
          clientId: input.clientId,
          title: entry.title,
          answer: entry.answer,
          keywords: entry.keywords,
          confidenceBoost: entry.confidenceBoost,
          actorId: input.actorId ?? `industry-template:${template.key}`,
          templateKey: compositeKey,
        }),
      );
    }
    return { templateKey: template.key, applied, skipped };
  }
}
