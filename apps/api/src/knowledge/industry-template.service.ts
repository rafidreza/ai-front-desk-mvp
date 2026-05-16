import { Injectable, NotFoundException } from '@nestjs/common';
import { KnowledgeEntry } from '../types/domain';
import { KnowledgeService } from './knowledge.service';
import clothingTemplate from './industry-templates/clothing.json';

export interface IndustryTemplateEntry {
  slug: string;
  title: string;
  answer: string;
  keywords: string[];
  confidenceBoost?: number;
}

export interface IndustryTemplate {
  key: string;
  label: string;
  description: string;
  language: string;
  entries: IndustryTemplateEntry[];
}

export interface IndustryTemplateSummary {
  key: string;
  label: string;
  description: string;
  language: string;
  entryCount: number;
}

export interface ApplyTemplateResult {
  templateKey: string;
  applied: KnowledgeEntry[];
  skipped: { slug: string; reason: string }[];
}

function loadTemplates(): IndustryTemplate[] {
  return [clothingTemplate as IndustryTemplate];
}

const templatesByKey = new Map<string, IndustryTemplate>(loadTemplates().map((template) => [template.key, template]));

function templateEntryKey(templateKey: string, slug: string): string {
  return `${templateKey}:${slug}`;
}

@Injectable()
export class IndustryTemplateService {
  constructor(private readonly knowledge: KnowledgeService) {}

  list(): IndustryTemplateSummary[] {
    return Array.from(templatesByKey.values()).map((template) => ({
      key: template.key,
      label: template.label,
      description: template.description,
      language: template.language,
      entryCount: template.entries.length,
    }));
  }

  get(key: string): IndustryTemplate {
    const template = templatesByKey.get(key);
    if (template === undefined) {
      throw new NotFoundException(`Industry template not found: ${key}`);
    }
    return template;
  }

  async apply(input: { clientId: string; templateKey: string; actorId?: string }): Promise<ApplyTemplateResult> {
    const template = this.get(input.templateKey);
    const applied: KnowledgeEntry[] = [];
    const skipped: { slug: string; reason: string }[] = [];

    for (const entry of template.entries) {
      const compositeKey = templateEntryKey(template.key, entry.slug);
      const existing = await this.knowledge.findByTemplateKey(input.clientId, compositeKey);
      if (existing !== null) {
        skipped.push({ slug: entry.slug, reason: 'already-applied' });
        continue;
      }

      const created = await this.knowledge.createDraft({
        clientId: input.clientId,
        title: entry.title,
        answer: entry.answer,
        keywords: entry.keywords,
        confidenceBoost: entry.confidenceBoost,
        actorId: input.actorId ?? `industry-template:${template.key}`,
        templateKey: compositeKey,
      });
      applied.push(created);
    }

    return {
      templateKey: template.key,
      applied,
      skipped,
    };
  }
}
