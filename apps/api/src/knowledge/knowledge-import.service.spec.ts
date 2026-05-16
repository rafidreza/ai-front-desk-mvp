import { describe, expect, it, vi } from 'vitest';
import { KnowledgeImportService } from './knowledge-import.service';
import { KnowledgeService } from './knowledge.service';

function toBase64(value: string) {
  return Buffer.from(value, 'utf8').toString('base64');
}

describe('KnowledgeImportService', () => {
  it('creates draft entries from Q&A text files', async () => {
    const createDraft = vi.fn(async (input: { title: string; answer: string; keywords: string[]; clientId: string }) => ({
      id: `entry-${createDraft.mock.calls.length}`,
      clientId: input.clientId,
      title: input.title,
      answer: input.answer,
      keywords: input.keywords,
      status: 'draft' as const,
      version: 1,
    }));
    const service = new KnowledgeImportService({ createDraft } as unknown as KnowledgeService);

    const result = await service.importFiles({
      clientId: 'pilot-client',
      files: [
        {
          fileName: 'faq.txt',
          contentType: 'text/plain',
          base64: toBase64('Q: Delivery charge koto?\nA: Dhakar inside delivery charge 80 taka.\n\nQuestion: Return policy?\nAnswer: Unused items can be returned within 3 days.'),
        },
      ],
    });

    expect(result.imported).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'pilot-client',
        title: 'Delivery charge koto?',
        answer: 'Dhakar inside delivery charge 80 taka.',
        actorId: 'knowledge-import',
      }),
    );
    expect(result.imported[0].entry.status).toBe('draft');
  });

  it('skips unsupported files without failing the full import', async () => {
    const createDraft = vi.fn();
    const service = new KnowledgeImportService({ createDraft } as unknown as KnowledgeService);

    const result = await service.importFiles({
      clientId: 'pilot-client',
      files: [{ fileName: 'archive.zip', contentType: 'application/zip', base64: toBase64('zip') }],
    });

    expect(result.imported).toHaveLength(0);
    expect(result.skipped[0]).toEqual(
      expect.objectContaining({
        fileName: 'archive.zip',
        reason: expect.stringContaining('Unsupported file type'),
      }),
    );
    expect(createDraft).not.toHaveBeenCalled();
  });
});
