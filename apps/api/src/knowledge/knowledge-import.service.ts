import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PDFParse } from 'pdf-parse';
import {
  KnowledgeImportFileInput,
  KnowledgeImportResult,
  KnowledgeImportSkippedFile,
} from '../types/domain';
import { KnowledgeService } from './knowledge.service';

type ExtractedFile = {
  fileName: string;
  sourceType: string;
  text: string;
};

type CandidateDraft = {
  title: string;
  answer: string;
  keywords: string[];
};

const MAX_FILES = 5;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_DRAFTS_PER_IMPORT = 30;

@Injectable()
export class KnowledgeImportService {
  constructor(private readonly knowledge: KnowledgeService) {}

  async importFiles(input: {
    clientId: string;
    files: KnowledgeImportFileInput[];
    actorId?: string;
  }): Promise<KnowledgeImportResult> {
    if (input.files.length === 0) {
      throw new BadRequestException('At least one file is required.');
    }
    if (input.files.length > MAX_FILES) {
      throw new BadRequestException(`Upload up to ${MAX_FILES} files per import.`);
    }

    const skipped: KnowledgeImportSkippedFile[] = [];
    const extracted: ExtractedFile[] = [];

    for (const file of input.files) {
      try {
        extracted.push(await this.extractFile(file));
      } catch (error) {
        skipped.push({
          fileName: file.fileName,
          reason: error instanceof Error ? error.message : 'Unable to extract this file.',
        });
      }
    }

    const candidates = extracted.flatMap((file) =>
      this.extractDraftCandidates(file.text).map((candidate) => ({ ...candidate, sourceFileName: file.fileName, sourceType: file.sourceType })),
    );
    const limitedCandidates = candidates.slice(0, MAX_DRAFTS_PER_IMPORT);
    const imported = [];

    for (const candidate of limitedCandidates) {
      const entry = await this.knowledge.createDraft({
        clientId: input.clientId,
        title: candidate.title,
        answer: candidate.answer,
        keywords: candidate.keywords,
        confidenceBoost: 0.03,
        actorId: input.actorId ?? 'knowledge-import',
      });
      imported.push({
        entry,
        sourceFileName: candidate.sourceFileName,
        sourceType: candidate.sourceType,
      });
    }

    if (candidates.length > MAX_DRAFTS_PER_IMPORT) {
      skipped.push({
        fileName: 'import batch',
        reason: `Created first ${MAX_DRAFTS_PER_IMPORT} drafts; split the remaining content into another import.`,
      });
    }

    return {
      imported,
      skipped,
      extractedCharacters: extracted.reduce((total, file) => total + file.text.length, 0),
    };
  }

  private async extractFile(file: KnowledgeImportFileInput): Promise<ExtractedFile> {
    const fileName = file.fileName.trim();
    if (fileName.length < 2) {
      throw new Error('File name is required.');
    }

    const buffer = Buffer.from(file.base64, 'base64');
    if (buffer.length === 0) {
      throw new Error('File is empty.');
    }
    if (buffer.length > MAX_FILE_BYTES) {
      throw new Error('File is larger than the 4 MB alpha limit.');
    }

    const contentType = file.contentType?.toLowerCase() ?? '';
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';

    if (this.isTextLike(contentType, extension)) {
      return { fileName, sourceType: 'text', text: this.cleanText(buffer.toString('utf8')) };
    }
    if (contentType.includes('pdf') || extension === 'pdf') {
      return { fileName, sourceType: 'pdf', text: this.cleanText(await this.extractPdf(buffer)) };
    }
    if (this.isExcelLike(contentType, extension)) {
      return { fileName, sourceType: 'excel', text: this.cleanText(await this.extractWorkbook(buffer)) };
    }
    if (contentType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(extension)) {
      return { fileName, sourceType: 'image', text: this.cleanText(await this.extractImageText(file.base64, contentType)) };
    }

    throw new Error('Unsupported file type. Use TXT, CSV, TSV, Markdown, PDF, Excel, PNG, JPG, or WebP.');
  }

  private isTextLike(contentType: string, extension: string) {
    return (
      contentType.startsWith('text/') ||
      contentType.includes('csv') ||
      contentType.includes('json') ||
      ['txt', 'csv', 'tsv', 'md', 'markdown', 'json'].includes(extension)
    );
  }

  private isExcelLike(contentType: string, extension: string) {
    return (
      contentType.includes('spreadsheet') ||
      contentType.includes('excel') ||
      ['xlsx', 'xlsm', 'xls'].includes(extension)
    );
  }

  private async extractPdf(buffer: Buffer) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  private async extractWorkbook(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const lines: string[] = [];

    workbook.eachSheet((sheet) => {
      lines.push(`Sheet: ${sheet.name}`);
      sheet.eachRow((row) => {
        const values = row.values;
        const cells = Array.isArray(values) ? values.slice(1) : [];
        const line = cells
          .map((cell) => this.stringifyCell(cell))
          .map((cell) => cell.trim())
          .filter(Boolean)
          .join(' | ');
        if (line.length > 0) lines.push(line);
      });
    });

    return lines.join('\n');
  }

  private stringifyCell(cell: unknown): string {
    if (cell === null || cell === undefined) return '';
    if (typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
    if (cell instanceof Date) return cell.toISOString().slice(0, 10);
    if (typeof cell === 'object') {
      const rich = cell as { text?: string; result?: unknown; formula?: string; hyperlink?: string };
      return String(rich.text ?? rich.result ?? rich.formula ?? rich.hyperlink ?? '');
    }
    return String(cell);
  }

  private async extractImageText(base64: string, contentType: string) {
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (apiKey === undefined || apiKey.trim() === '') {
      throw new Error('Image OCR requires GOOGLE_CLOUD_VISION_API_KEY. Upload text, PDF, or Excel until OCR is configured.');
    }

    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
            imageContext: contentType === 'image/webp' ? undefined : { languageHints: ['bn', 'en'] },
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Image OCR failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      responses?: { fullTextAnnotation?: { text?: string }; error?: { message?: string } }[];
    };
    const first = data.responses?.[0];
    if (first?.error?.message !== undefined) {
      throw new Error(first.error.message);
    }
    return first?.fullTextAnnotation?.text ?? '';
  }

  private extractDraftCandidates(text: string): CandidateDraft[] {
    const qaCandidates = this.extractQuestionAnswerBlocks(text);
    if (qaCandidates.length > 0) return qaCandidates;

    return this.extractParagraphBlocks(text);
  }

  private extractQuestionAnswerBlocks(text: string): CandidateDraft[] {
    const candidates: CandidateDraft[] = [];
    const blocks = text.split(/\n\s*\n/g);

    for (const block of blocks) {
      const question = block.match(/(?:^|\n)\s*(?:q|question|প্রশ্ন)\s*[:-]\s*(.+?)(?=\n\s*(?:a|answer|উত্তর)\s*[:-]|\n|$)/is)?.[1];
      const answer = block.match(/(?:^|\n)\s*(?:a|answer|উত্তর)\s*[:-]\s*([\s\S]+)/i)?.[1];
      if (question === undefined || answer === undefined) continue;

      candidates.push(this.toCandidate(question, answer));
    }

    return candidates;
  }

  private extractParagraphBlocks(text: string): CandidateDraft[] {
    const blocks = text
      .split(/\n\s*\n/g)
      .map((block) => block.replace(/\s+/g, ' ').trim())
      .filter((block) => block.length >= 45);

    return blocks.slice(0, MAX_DRAFTS_PER_IMPORT).map((block) => {
      const title = block.split(/[.?!।]/)[0]?.trim() || block.slice(0, 80);
      return this.toCandidate(title, block);
    });
  }

  private toCandidate(rawTitle: string, rawAnswer: string): CandidateDraft {
    const title = this.truncate(this.cleanInline(rawTitle), 90);
    const answer = this.truncate(this.cleanInline(rawAnswer), 1200);
    return {
      title,
      answer,
      keywords: this.extractKeywords(`${title} ${answer}`),
    };
  }

  private extractKeywords(text: string) {
    const stopWords = new Set([
      'about',
      'after',
      'answer',
      'customer',
      'from',
      'have',
      'into',
      'that',
      'their',
      'there',
      'this',
      'with',
      'your',
      'আপনার',
      'আমরা',
      'এবং',
      'করা',
      'জন্য',
      'থেকে',
      'হবে',
    ]);
    const tokens = text
      .toLowerCase()
      .match(/[\p{L}\p{N}][\p{L}\p{N}'-]{2,}/gu) ?? [];
    const unique = Array.from(new Set(tokens.filter((token) => !stopWords.has(token))));
    return unique.slice(0, 8).length > 0 ? unique.slice(0, 8) : ['imported'];
  }

  private cleanText(text: string) {
    return text.replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  private cleanInline(text: string) {
    return text.replace(/\s+/g, ' ').trim();
  }

  private truncate(text: string, maxLength: number) {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 3).trim()}...`;
  }
}
