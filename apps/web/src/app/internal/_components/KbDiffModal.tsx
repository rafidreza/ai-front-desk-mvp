'use client';

import { RotateCcw, X } from 'lucide-react';
import { useEffect } from 'react';
import { KnowledgeEntry, KnowledgeEntryVersion } from '@/types/domain';

export interface KbDiffModalProps {
  current: KnowledgeEntry;
  version: KnowledgeEntryVersion;
  isRestoring: boolean;
  onClose: () => void;
  onRestore: () => void;
}

type Field = {
  key: 'title' | 'answer' | 'keywords' | 'category' | 'confidenceBoost';
  label: string;
  read: (
    source:
      | KnowledgeEntry
      | KnowledgeEntryVersion,
  ) => string;
};

const FIELDS: Field[] = [
  { key: 'title', label: 'Title', read: (source) => source.title },
  { key: 'answer', label: 'Answer', read: (source) => source.answer },
  {
    key: 'keywords',
    label: 'Keywords',
    read: (source) => source.keywords.join(', '),
  },
  { key: 'category', label: 'Category', read: (source) => source.category ?? 'general' },
  {
    key: 'confidenceBoost',
    label: 'Confidence boost',
    read: (source) =>
      source.confidenceBoost === undefined || source.confidenceBoost === null
        ? '—'
        : source.confidenceBoost.toString(),
  },
];

export function KbDiffModal({ current, version, isRestoring, onClose, onRestore }: KbDiffModalProps) {
  useEffect(() => {
    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const changedFields = FIELDS.filter((field) => field.read(current) !== field.read(version));

  return (
    <div className="kb-diff-overlay" onClick={onClose} role="presentation">
      <div
        aria-labelledby="kb-diff-title"
        aria-modal="true"
        className="kb-diff-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <div>
            <h3 id="kb-diff-title">
              Compare v{current.version} (current) vs v{version.version}
            </h3>
            <p>
              {changedFields.length === 0
                ? 'No field changes — only metadata differs.'
                : `${changedFields.length} field${changedFields.length === 1 ? '' : 's'} changed.`}
            </p>
          </div>
          <button aria-label="Close diff" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </header>

        <div className="kb-diff-grid">
          <div className="kb-diff-col-head">
            <strong>Current (v{current.version})</strong>
            <small>{current.status}</small>
          </div>
          <div className="kb-diff-col-head">
            <strong>v{version.version} · {version.action}</strong>
            <small>
              {new Date(version.createdAt).toLocaleString()} · {version.actorId}
            </small>
          </div>

          {FIELDS.map((field) => {
            const left = field.read(current);
            const right = field.read(version);
            const changed = left !== right;
            return (
              <div
                className="kb-diff-row"
                data-changed={changed ? 'true' : undefined}
                key={field.key}
              >
                <div className="kb-diff-field">
                  <span>{field.label}</span>
                  <pre>{left}</pre>
                </div>
                <div className="kb-diff-field">
                  <span>{field.label}</span>
                  <pre>{right}</pre>
                </div>
              </div>
            );
          })}
        </div>

        <footer>
          <button className="icon-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="btn-primary"
            data-loading={isRestoring ? 'true' : undefined}
            disabled={isRestoring}
            onClick={onRestore}
            type="button"
          >
            <RotateCcw size={14} />
            {isRestoring ? 'Restoring…' : 'Restore as new draft'}
          </button>
        </footer>
      </div>
    </div>
  );
}
