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

  it('creates draft entries from Meta Messenger history exports', async () => {
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
    const metaExport = {
      participants: [{ name: 'Pilot Boutique' }, { name: 'Nadia' }],
      messages: [
        {
          sender_name: 'Nadia',
          timestamp_ms: 1710000000000,
          content: 'Delivery charge koto?',
        },
        {
          sender_name: 'Pilot Boutique',
          timestamp_ms: 1710000060000,
          content: 'Dhakar inside delivery charge 80 taka, outside Dhaka 130 taka.',
        },
        {
          sender_name: 'Nadia',
          timestamp_ms: 1710000120000,
          content: 'Return kora jabe?',
        },
        {
          sender_name: 'Pilot Boutique',
          timestamp_ms: 1710000180000,
          content: 'Unused product 3 diner moddhe return kora jabe.',
        },
      ],
    };

    const result = await service.importFiles({
      clientId: 'pilot-client',
      files: [
        {
          fileName: 'message_1.json',
          contentType: 'application/json',
          base64: toBase64(JSON.stringify(metaExport)),
        },
      ],
    });

    expect(result.imported).toHaveLength(2);
    expect(result.imported[0]).toEqual(
      expect.objectContaining({
        sourceFileName: 'message_1.json',
        sourceType: 'messenger_history',
      }),
    );
    expect(createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delivery charge koto?',
        answer: 'Dhakar inside delivery charge 80 taka, outside Dhaka 130 taka.',
        keywords: expect.arrayContaining(['charge']),
      }),
    );
  });

  it('creates draft entries from public page HTML', async () => {
    const createDraft = vi.fn(async (input: { title: string; answer: string; keywords: string[]; clientId: string }) => ({
      id: `entry-${createDraft.mock.calls.length}`,
      clientId: input.clientId,
      title: input.title,
      answer: input.answer,
      keywords: input.keywords,
      status: 'draft' as const,
      version: 1,
    }));
    const fetchImpl = vi.fn(async () =>
      new Response(
        '<html><head><title>About Pilot Boutique</title><script>ignore()</script></head><body><h1>Delivery information</h1><p>Inside Dhaka delivery takes 1 to 2 working days.</p><p>Outside Dhaka delivery takes 2 to 4 working days.</p></body></html>',
        { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
      ),
    );
    const service = new KnowledgeImportService({ createDraft } as unknown as KnowledgeService);

    const result = await service.importPublicPage({
      clientId: 'pilot-client',
      url: 'https://facebook.com/pilot-boutique/about',
      fetchImpl,
    });

    expect(result.imported).toHaveLength(1);
    expect(result.imported[0]).toEqual(
      expect.objectContaining({
        sourceFileName: 'https://facebook.com/pilot-boutique/about',
        sourceType: 'public_page',
      }),
    );
    expect(createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Delivery information'),
        answer: expect.stringContaining('Inside Dhaka delivery takes 1 to 2 working days.'),
        actorId: 'page-scraper',
      }),
    );
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
