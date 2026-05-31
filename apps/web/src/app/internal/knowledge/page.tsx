'use client';

import {
  Archive,
  Building2,
  CheckCheck,
  DatabaseZap,
  FileUp,
  History,
  Layers3,
  Link2,
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
  importKnowledgeFromUrl,
  markKnowledgeReviewed,
  rollbackKnowledgeEntry,
  setKnowledgeStatus,
  updateKnowledgeEntry,
} from '@/lib/api';
import { ClientProfile, KnowledgeEntry, KnowledgeEntryVersion, KnowledgeImportResult } from '@/types/domain';

const STALE_DAYS = 90;

function isStale(entry: KnowledgeEntry, now: Date = new Date()): boolean {
  if (entry.status !== 'active') return false;
  if (entry.updatedAt === undefined) return false;
  const ageMs = now.getTime() - new Date(entry.updatedAt).getTime();
  return ageMs >= STALE_DAYS * 24 * 60 * 60 * 1000;
}

function staleDays(entry: KnowledgeEntry, now: Date = new Date()): number {
  if (entry.updatedAt === undefined) return 0;
  const ageMs = now.getTime() - new Date(entry.updatedAt).getTime();
  return Math.floor(ageMs / (24 * 60 * 60 * 1000));
}
import { EmptyState } from '../_components/EmptyState';
import { KbDiffModal } from '../_components/KbDiffModal';
import { ListSkeleton } from '../_components/ListSkeleton';
import { InternalShell } from '../_components/InternalShell';
import { UiSelect } from '../_components/UiSelect';
import { getErrorMessage } from '../_lib/helpers';

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
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const [showStaleOnly, setShowStaleOnly] = useState(false);
  const [importResult, setImportResult] = useState<KnowledgeImportResult | null>(null);
  const [status, setStatus] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isUrlImporting, setIsUrlImporting] = useState(false);
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
      setError(getErrorMessage(loadError, 'Knowledge entries could not load. Fix: check the selected client and API server, then refresh.'));
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
        setError(getErrorMessage(loadError, 'Knowledge entries could not load. Fix: check the selected client and API server, then refresh.'));
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
    const now = new Date();
    return entries.filter((entry) => {
      const categoryMatches = categoryFilter === 'all' || (entry.category ?? 'general') === categoryFilter;
      const queryMatches =
        normalizedQuery === '' ||
        [entry.title, entry.answer, entry.category, entry.status, ...entry.keywords]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));
      const staleMatches = !showStaleOnly || isStale(entry, now);
      return categoryMatches && queryMatches && staleMatches;
    });
  }, [categoryFilter, entries, query, showStaleOnly]);

  const staleCount = useMemo(() => {
    const now = new Date();
    return entries.filter((entry) => isStale(entry, now)).length;
  }, [entries]);

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
      setError(getErrorMessage(createError, 'Knowledge draft was not created. Fix: confirm title, answer, and keywords are filled, then retry.'));
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
      setError(getErrorMessage(saveError, 'Knowledge entry was not saved. Fix: refresh this entry, verify required fields, then retry.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const files = form.getAll('files').filter((file): file is File => file instanceof File && file.size > 0);
    if (files.length === 0) {
      setError('No file selected. Fix: choose at least one supported knowledge file, then import drafts.');
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
      setError(getErrorMessage(importError, 'Knowledge import failed. Fix: use a supported file type or check OCR/parser configuration, then retry.'));
    } finally {
      setIsImporting(false);
    }
  }

  async function handleUrlImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const url = String(form.get('url') ?? '').trim();
    if (url.length === 0) {
      setError('No URL entered. Fix: paste a public Page, post, About, or website URL, then import drafts.');
      return;
    }

    setIsUrlImporting(true);
    setError(null);
    setNotice(null);
    setImportResult(null);
    try {
      const result = await importKnowledgeFromUrl(clientId, {
        url,
        actorId: 'internal-console',
      });
      setImportResult(result);
      setNotice(`Imported ${result.imported.length} draft${result.imported.length === 1 ? '' : 's'} from public page text.`);
      event.currentTarget.reset();
      await loadEntries('draft', result.imported[0]?.entry.id);
      setStatus('draft');
    } catch (importError) {
      setError(getErrorMessage(importError, 'Public page import failed. Fix: use a public page that can be opened without login, then retry.'));
    } finally {
      setIsUrlImporting(false);
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
      setError(getErrorMessage(statusError, 'Knowledge status was not updated. Fix: refresh the entry version, then retry.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMarkReviewed(entry: KnowledgeEntry) {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await markKnowledgeReviewed(clientId, entry.id);
      setNotice(`"${entry.title}" marked as reviewed.`);
      await loadEntries(status, entry.id);
    } catch (reviewError) {
      setError(getErrorMessage(reviewError, 'Could not mark this entry as reviewed.'));
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
      setCompareVersionId(null);
      await loadEntries(status, updated.id);
    } catch (rollbackError) {
      setError(getErrorMessage(rollbackError, 'Knowledge version was not restored. Fix: refresh version history, then retry.'));
    } finally {
      setIsSaving(false);
    }
  }

  const compareVersion = useMemo(
    () => versions.find((version) => version.id === compareVersionId) ?? null,
    [versions, compareVersionId],
  );

  return (
    <InternalShell
      activeView="knowledge"
      eyebrow="Knowledge base"
      title="Client knowledge libraries"
      action={
        <div className="page-actions">
          <UiSelect
            className="page-select"
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
          </UiSelect>
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

      {staleCount > 0 && (
        <div className="kb-freshness-banner" role="status">
          <strong>
            {staleCount} {staleCount === 1 ? 'entry has' : 'entries have'} not been touched in {STALE_DAYS}+ days.
          </strong>
          <span>Review the answer is still correct, then mark reviewed to clear the alert.</span>
          <button
            className="mini-button"
            onClick={() => setShowStaleOnly((value) => !value)}
            type="button"
          >
            {showStaleOnly ? 'Show all entries' : 'Show stale only'}
          </button>
        </div>
      )}

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
            {isLoading && filteredEntries.length === 0 && <ListSkeleton rows={5} variant="default" />}
            {filteredEntries.map((entry) => {
              const stale = isStale(entry);
              return (
                <button
                  className="knowledge-row"
                  data-selected={selectedEntry?.id === entry.id}
                  data-stale={stale ? 'true' : undefined}
                  key={entry.id}
                  type="button"
                  onClick={() => void selectEntry(entry)}
                >
                  <strong>
                    {entry.title}
                    {stale && (
                      <span className="kb-stale-badge" title={`Last touched ${staleDays(entry)} days ago`}>
                        Stale {staleDays(entry)}d
                      </span>
                    )}
                  </strong>
                  <small>{categoryLabel(entry.category)} | {entry.status} | v{entry.version}</small>
                  <small>{entry.keywords.join(', ')}</small>
                </button>
              );
            })}
            {!isLoading && filteredEntries.length === 0 && (
              <EmptyState
                icon={<DatabaseZap size={20} />}
                title="No knowledge entries in this view"
                description="Create a draft or import files so the agent has approved answers to use."
                action={<a className="mini-button" href="#knowledge-import">Import drafts</a>}
              />
            )}
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
                {selectedEntry.status === 'active' && (
                  <button
                    className="icon-button"
                    disabled={isSaving}
                    onClick={() => void handleMarkReviewed(selectedEntry)}
                    title={
                      selectedEntry.updatedAt !== undefined
                        ? `Last touched ${staleDays(selectedEntry)} days ago`
                        : 'Mark reviewed'
                    }
                    type="button"
                  >
                    <CheckCheck size={15} />
                    Mark reviewed
                  </button>
                )}
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
                <div className="version-card__actions">
                  <button
                    className="mini-button"
                    disabled={isSaving || selectedEntry === null}
                    onClick={() => setCompareVersionId(version.id)}
                    type="button"
                  >
                    Compare
                  </button>
                  <button
                    className="mini-button"
                    disabled={isSaving}
                    onClick={() => void rollback(version.id)}
                    type="button"
                  >
                    <RotateCcw size={13} />
                    Restore
                  </button>
                </div>
              </article>
            ))}
            {versions.length === 0 && <div className="empty">No history yet</div>}
          </div>
        </section>

        {compareVersion !== null && selectedEntry !== null && (
          <KbDiffModal
            current={selectedEntry}
            isRestoring={isSaving}
            onClose={() => setCompareVersionId(null)}
            onRestore={() => void rollback(compareVersion.id)}
            version={compareVersion}
          />
        )}

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

        <form id="knowledge-import" className="client-panel stack-form knowledge-import" onSubmit={handleImport}>
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

        <form className="client-panel stack-form knowledge-import" onSubmit={handleUrlImport}>
          <div className="section-label">
            <Link2 size={15} />
            Import public page
          </div>
          <label>
            Public URL
            <input
              name="url"
              inputMode="url"
              placeholder="https://www.facebook.com/your-page"
              type="url"
            />
          </label>
          <p className="form-hint">
            Works for public pages that can be opened without signing in. Creates draft entries only.
          </p>
          <button className="icon-button" disabled={isUrlImporting} type="submit">
            <Link2 size={15} />
            {isUrlImporting ? 'Importing...' : 'Import URL'}
          </button>
        </form>
      </section>
    </InternalShell>
  );
}
