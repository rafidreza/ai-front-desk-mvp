'use client';

import { Archive, DatabaseZap, FileUp, History, Plus, RefreshCw, RotateCcw, Save, Send } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createKnowledgeDraft,
  getKnowledgeEntries,
  getKnowledgeVersions,
  importKnowledgeFiles,
  rollbackKnowledgeEntry,
  setKnowledgeStatus,
  updateKnowledgeEntry,
} from '@/lib/api';
import { KnowledgeEntry, KnowledgeEntryVersion, KnowledgeImportResult } from '@/types/domain';
import { InternalShell } from '../_components/InternalShell';

function parseKeywords(value: FormDataEntryValue | null) {
  return String(value ?? '')
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function parseBoost(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim();
  if (raw === '') return undefined;
  return Number(raw);
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [versions, setVersions] = useState<KnowledgeEntryVersion[]>([]);
  const [importResult, setImportResult] = useState<KnowledgeImportResult | null>(null);
  const [status, setStatus] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return 'pilot-client';
    return new URLSearchParams(window.location.search).get('clientId') ?? 'pilot-client';
  }, []);

  async function loadEntries(nextStatus = status, nextSelectedId = selectedEntry?.id) {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await getKnowledgeEntries(clientId, nextStatus);
      setEntries(loaded);
      const nextSelected = loaded.find((entry) => entry.id === nextSelectedId) ?? loaded[0] ?? null;
      setSelectedEntry(nextSelected);
      if (nextSelected !== null) {
        setVersions(await getKnowledgeVersions(clientId, nextSelected.id));
      } else {
        setVersions([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load knowledge.');
    } finally {
      setIsLoading(false);
    }
  }

  async function selectEntry(entry: KnowledgeEntry) {
    setSelectedEntry(entry);
    setError(null);
    setNotice(null);
    setVersions(await getKnowledgeVersions(clientId, entry.id));
  }

  useEffect(() => {
    void loadEntries();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createKnowledgeDraft(clientId, {
        title: String(form.get('title') ?? ''),
        answer: String(form.get('answer') ?? ''),
        keywords: parseKeywords(form.get('keywords')),
        confidenceBoost: parseBoost(form.get('confidenceBoost')),
      });
      event.currentTarget.reset();
      setNotice('Draft created.');
      await loadEntries(status, created.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create draft.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedEntry === null) return;
    const form = new FormData(event.currentTarget);
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateKnowledgeEntry(clientId, selectedEntry.id, {
        title: String(form.get('title') ?? ''),
        answer: String(form.get('answer') ?? ''),
        keywords: parseKeywords(form.get('keywords')),
        confidenceBoost: parseBoost(form.get('confidenceBoost')),
        actorId: 'internal-console',
      });
      setNotice('Saved as draft.');
      await loadEntries(status, updated.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save entry.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const files = form.getAll('files').filter((file): file is File => file instanceof File && file.size > 0);
    if (files.length === 0) {
      setError('Choose at least one knowledge file to import.');
      return;
    }

    setIsImporting(true);
    setError(null);
    setNotice(null);
    setImportResult(null);
    try {
      const encodedFiles = await Promise.all(
        files.map(async (file) => ({
          fileName: file.name,
          contentType: file.type,
          base64: await fileToBase64(file),
        })),
      );
      const result = await importKnowledgeFiles(clientId, {
        files: encodedFiles,
        actorId: 'internal-console',
      });
      setImportResult(result);
      setNotice(`Imported ${result.imported.length} draft${result.imported.length === 1 ? '' : 's'} for review.`);
      event.currentTarget.reset();
      await loadEntries('draft', result.imported[0]?.entry.id);
      setStatus('draft');
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Unable to import files.');
    } finally {
      setIsImporting(false);
    }
  }

  async function changeStatus(nextStatus: KnowledgeEntry['status']) {
    if (selectedEntry === null) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await setKnowledgeStatus(clientId, selectedEntry.id, nextStatus);
      setNotice(nextStatus === 'active' ? 'Published.' : nextStatus === 'archived' ? 'Archived.' : 'Moved to draft.');
      await loadEntries(status, updated.id);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to update status.');
    } finally {
      setIsSaving(false);
    }
  }

  async function rollback(versionId: string) {
    if (selectedEntry === null) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await rollbackKnowledgeEntry(clientId, selectedEntry.id, versionId);
      setNotice('Version restored as a new draft.');
      await loadEntries(status, updated.id);
    } catch (rollbackError) {
      setError(rollbackError instanceof Error ? rollbackError.message : 'Unable to roll back entry.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <InternalShell
      activeView="knowledge"
      eyebrow="Knowledge base"
      title="Answers, drafts, and history"
      action={
        <button className="icon-button" type="button" onClick={() => void loadEntries()} disabled={isLoading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      }
    >

      {error !== null && <div className="inline-alert">{error}</div>}
      {notice !== null && <div className="inline-success">{notice}</div>}

      <section className="knowledge-layout">
        <section className="client-panel">
          <div className="panel-header">
            <div className="panel-title">
              <DatabaseZap size={16} />
              Entries
            </div>
            <select
              className="owner-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                void loadEntries(event.target.value);
              }}
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="client-list">
            {entries.map((entry) => (
              <button
                className="knowledge-row"
                data-selected={selectedEntry?.id === entry.id}
                key={entry.id}
                type="button"
                onClick={() => void selectEntry(entry)}
              >
                <strong>{entry.title}</strong>
                <small>{entry.status} | v{entry.version} | {entry.keywords.join(', ')}</small>
              </button>
            ))}
            {entries.length === 0 && <div className="empty">No knowledge entries</div>}
          </div>
        </section>

        <section className="client-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Save size={16} />
              Entry detail
            </div>
          </div>
          {selectedEntry === null ? (
            <div className="empty">Select an entry to edit</div>
          ) : (
            <form className="stack-form knowledge-editor" key={selectedEntry.id} onSubmit={handleSave}>
              <label>
                Title
                <input name="title" required defaultValue={selectedEntry.title} />
              </label>
              <label>
                Answer
                <textarea name="answer" required rows={9} defaultValue={selectedEntry.answer} />
              </label>
              <label>
                Keywords
                <input name="keywords" required defaultValue={selectedEntry.keywords.join(', ')} />
              </label>
              <label>
                Confidence boost
                <input
                  name="confidenceBoost"
                  inputMode="decimal"
                  placeholder="0.05"
                  defaultValue={selectedEntry.confidenceBoost ?? ''}
                />
              </label>
              <div className="filter-row">
                <button className="icon-button" disabled={isSaving} type="submit">
                  <Save size={15} />
                  Save draft
                </button>
                <button className="icon-button" disabled={isSaving} type="button" onClick={() => void changeStatus('active')}>
                  <Send size={15} />
                  Publish
                </button>
                <button className="icon-button" disabled={isSaving} type="button" onClick={() => void changeStatus('archived')}>
                  <Archive size={15} />
                  Archive
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="client-panel">
          <div className="panel-header">
            <div className="panel-title">
              <History size={16} />
              Version history
            </div>
          </div>
          <div className="version-list">
            {versions.map((version) => (
              <article className="version-card" key={version.id}>
                <div>
                  <strong>v{version.version} | {version.action}</strong>
                  <small>{new Date(version.createdAt).toLocaleString()} | {version.actorId}</small>
                </div>
                <p>{version.title}</p>
                <small>{version.status} | {version.keywords.join(', ')}</small>
                <button className="mini-button" disabled={isSaving} type="button" onClick={() => void rollback(version.id)}>
                  <RotateCcw size={13} />
                  Restore
                </button>
              </article>
            ))}
            {versions.length === 0 && <div className="empty">No history yet</div>}
          </div>
        </section>

        <form className="client-panel stack-form knowledge-create" onSubmit={handleCreate}>
          <div className="section-label">
            <Plus size={15} />
            New draft
          </div>
          <label>
            Title
            <input name="title" required />
          </label>
          <label>
            Answer
            <textarea name="answer" required rows={5} />
          </label>
          <label>
            Keywords
            <input name="keywords" required placeholder="delivery, charge, courier" />
          </label>
          <label>
            Confidence boost
            <input name="confidenceBoost" inputMode="decimal" placeholder="0.05" />
          </label>
          <button className="icon-button" disabled={isSaving} type="submit">
            Create draft
          </button>
        </form>

        <form className="client-panel stack-form knowledge-import" onSubmit={handleImport}>
          <div className="section-label">
            <FileUp size={15} />
            Import files
          </div>
          <label>
            Source files
            <input
              name="files"
              type="file"
              multiple
              accept=".txt,.csv,.tsv,.md,.markdown,.json,.pdf,.xlsx,.xlsm,.xls,.png,.jpg,.jpeg,.webp,text/*,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*"
            />
          </label>
          <p className="form-hint">
            Creates draft entries only. Text, CSV, Markdown, PDF, and Excel extract locally; images need Google Vision OCR configured.
          </p>
          <button className="icon-button" disabled={isImporting} type="submit">
            <FileUp size={15} />
            {isImporting ? 'Importing...' : 'Import drafts'}
          </button>
          {importResult !== null && (
            <div className="import-summary">
              <strong>{importResult.imported.length} drafts created</strong>
              <small>{importResult.extractedCharacters.toLocaleString()} characters extracted</small>
              {importResult.skipped.map((skipped) => (
                <small key={`${skipped.fileName}-${skipped.reason}`}>{skipped.fileName}: {skipped.reason}</small>
              ))}
            </div>
          )}
        </form>
      </section>
    </InternalShell>
  );
}
