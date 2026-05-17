'use client';

import {
  Archive,
  Building2,
  DatabaseZap,
  FileUp,
  History,
  Layers3,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createKnowledgeDraft,
  getClients,
  getKnowledgeEntries,
  getKnowledgeVersions,
  importKnowledgeFiles,
  rollbackKnowledgeEntry,
  setKnowledgeStatus,
  updateKnowledgeEntry,
} from '@/lib/api';
import { ClientProfile, KnowledgeEntry, KnowledgeEntryVersion, KnowledgeImportResult } from '@/types/domain';
import { InternalShell } from '../_components/InternalShell';

const categoryOptions = [
  { value: 'general', label: 'General' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'payment', label: 'Payment' },
  { value: 'returns', label: 'Returns' },
  { value: 'product', label: 'Product' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'live-learning', label: 'Live Learning' },
];

function categoryLabel(category?: string) {
  const normalized = category ?? 'general';
  return categoryOptions.find((option) => option.value === normalized)?.label ?? normalized.replaceAll('-', ' ');
}

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
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('pilot-client');
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [versions, setVersions] = useState<KnowledgeEntryVersion[]>([]);
  const [importResult, setImportResult] = useState<KnowledgeImportResult | null>(null);
  const [status, setStatus] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const activeClient = clients.find((client) => client.id === selectedClientId);
  const clientId = selectedClientId;

  async function loadEntries(nextStatus = status, nextSelectedId = selectedEntry?.id, nextClientId = selectedClientId) {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await getKnowledgeEntries(nextClientId, nextStatus);
      setEntries(loaded);
      const nextSelected = loaded.find((entry) => entry.id === nextSelectedId) ?? loaded[0] ?? null;
      setSelectedEntry(nextSelected);
      if (nextSelected !== null) {
        setVersions(await getKnowledgeVersions(nextClientId, nextSelected.id));
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
    setVersions(await getKnowledgeVersions(selectedClientId, entry.id));
  }

  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      setError(null);
      try {
        const clientData = await getClients();
        const requestedClientId = new URLSearchParams(window.location.search).get('clientId');
        const initialClientId =
          clientData.find((client) => client.id === requestedClientId)?.id ??
          clientData[0]?.id ??
          'pilot-client';
        setClients(clientData);
        setSelectedClientId(initialClientId);
        await loadEntries(status, undefined, initialClientId);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load knowledge.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadInitialData();
  }, []);

  const availableCategories = useMemo(() => {
    const categories = Array.from(new Set(entries.map((entry) => entry.category ?? 'general')));
    return ['all', ...categoryOptions.map((option) => option.value), ...categories.filter((category) =>
      !categoryOptions.some((option) => option.value === category),
    )].filter((category, index, all) => all.indexOf(category) === index);
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const categoryMatches = categoryFilter === 'all' || (entry.category ?? 'general') === categoryFilter;
      const queryMatches =
        normalizedQuery === '' ||
        [entry.title, entry.answer, entry.category, entry.status, ...entry.keywords]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));
      return categoryMatches && queryMatches;
    });
  }, [categoryFilter, entries, query]);

  const categoryCounts = useMemo(() => {
    return entries.reduce<Record<string, number>>((counts, entry) => {
      const category = entry.category ?? 'general';
      counts[category] = (counts[category] ?? 0) + 1;
      return counts;
    }, {});
  }, [entries]);

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
        category: String(form.get('category') ?? 'general'),
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
        category: String(form.get('category') ?? 'general'),
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
      title="Client knowledge libraries"
      action={
        <div className="page-actions">
          <select
            className="header-select"
            value={selectedClientId}
            onChange={(event) => {
              const nextClientId = event.target.value;
              setSelectedClientId(nextClientId);
              setSelectedEntry(null);
              setVersions([]);
              setNotice(null);
              setCategoryFilter('all');
              void loadEntries(status, undefined, nextClientId);
            }}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.businessName}
              </option>
            ))}
          </select>
          <button className="icon-button" type="button" onClick={() => void loadEntries()} disabled={isLoading}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      }
    >

      {error !== null && <div className="inline-alert">{error}</div>}
      {notice !== null && <div className="inline-success">{notice}</div>}

      <section className="knowledge-client-strip">
        <div>
          <span>
            <Building2 size={14} />
            Client
          </span>
          <strong>{activeClient?.businessName ?? selectedClientId}</strong>
          <small>{activeClient?.pageId ?? 'No page ID'} | {activeClient?.businessCategory ?? 'No category'}</small>
        </div>
        <div>
          <span>
            <Layers3 size={14} />
            Categories
          </span>
          <strong>{Object.keys(categoryCounts).length}</strong>
          <small>{entries.length} entries for this client</small>
        </div>
        <div>
          <span>Status</span>
          <strong>{status === 'all' ? 'All entries' : status}</strong>
          <small>{filteredEntries.length} currently visible</small>
        </div>
      </section>

      <section className="knowledge-layout">
        <section className="client-panel">
          <div className="panel-header">
            <div className="panel-title">
              <DatabaseZap size={16} />
              Entries
            </div>
            <span className="count">{filteredEntries.length}</span>
          </div>
          <div className="knowledge-filter-stack">
            <div className="search-control">
              <Search size={14} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search knowledge" />
            </div>
            <div className="filter-row">
              <select
                className="owner-filter"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  void loadEntries(event.target.value);
                }}
              >
                <option value="all">All status</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
              <select className="owner-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All categories' : categoryLabel(category)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="client-list">
            {filteredEntries.map((entry) => (
              <button
                className="knowledge-row"
                data-selected={selectedEntry?.id === entry.id}
                key={entry.id}
                type="button"
                onClick={() => void selectEntry(entry)}
              >
                <strong>{entry.title}</strong>
                <small>{categoryLabel(entry.category)} | {entry.status} | v{entry.version}</small>
                <small>{entry.keywords.join(', ')}</small>
              </button>
            ))}
            {filteredEntries.length === 0 && <div className="empty">No matching knowledge entries</div>}
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
                Category
                <select name="category" required defaultValue={selectedEntry.category ?? 'general'}>
                  {categoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
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
            Category
            <select name="category" defaultValue="general">
              {categoryOptions.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
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
