'use client';

import { Plus, Tag as TagIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { TAG_COLORS, Tag, TagColor } from '@/types/domain';

export interface TagPickerProps {
  availableTags: Tag[];
  appliedTagIds?: Set<string>;
  isBusy?: boolean;
  triggerLabel?: string;
  onApply: (tagId: string) => void | Promise<void>;
  onCreate?: (name: string, color: TagColor) => Promise<Tag>;
  onClose?: () => void;
}

export function TagPicker({
  availableTags,
  appliedTagIds,
  isBusy,
  triggerLabel = 'Add tag',
  onApply,
  onCreate,
  onClose,
}: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<TagColor>('blue');
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current !== null && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
        setCreateMode(false);
        setError(null);
        onClose?.();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  async function handleApply(tagId: string) {
    setError(null);
    try {
      await onApply(tagId);
      setOpen(false);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Could not apply tag.');
    }
  }

  async function handleCreateSubmit() {
    if (onCreate === undefined) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('Tag name cannot be empty.');
      return;
    }
    setError(null);
    try {
      const tag = await onCreate(trimmed, color);
      setCreateMode(false);
      setName('');
      setColor('blue');
      await onApply(tag.id);
      setOpen(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create tag.');
    }
  }

  return (
    <div className="tag-picker" ref={wrapperRef}>
      <button
        className="mini-button"
        disabled={isBusy}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <TagIcon size={13} />
        {triggerLabel}
      </button>
      {open && (
        <div className="tag-picker-menu" role="menu">
          {!createMode && (
            <>
              <div className="tag-picker-list">
                {availableTags.length === 0 && (
                  <p className="tag-picker-empty">No tags yet for this client.</p>
                )}
                {availableTags.map((tag) => {
                  const isApplied = appliedTagIds?.has(tag.id) ?? false;
                  return (
                    <button
                      className="tag-picker-row"
                      data-applied={isApplied ? 'true' : undefined}
                      disabled={isBusy || isApplied}
                      key={tag.id}
                      onClick={() => void handleApply(tag.id)}
                      type="button"
                    >
                      <span className="tag-chip" data-color={tag.color} data-size="sm">
                        <span>{tag.name}</span>
                      </span>
                      {isApplied && <span className="tag-picker-row__applied">applied</span>}
                    </button>
                  );
                })}
              </div>
              {onCreate !== undefined && (
                <button
                  className="tag-picker-create-toggle"
                  onClick={() => setCreateMode(true)}
                  type="button"
                >
                  <Plus size={13} />
                  Create new tag
                </button>
              )}
            </>
          )}
          {createMode && onCreate !== undefined && (
            <div className="tag-picker-create">
              <label>
                Tag name
                <input
                  autoFocus
                  maxLength={30}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="VIP, complaint, high-value…"
                  type="text"
                  value={name}
                />
              </label>
              <label>
                Color
                <div className="tag-picker-color-grid">
                  {TAG_COLORS.map((option) => (
                    <button
                      aria-label={`Color ${option}`}
                      className="tag-picker-color-swatch"
                      data-color={option}
                      data-selected={color === option ? 'true' : undefined}
                      key={option}
                      onClick={() => setColor(option)}
                      type="button"
                    />
                  ))}
                </div>
              </label>
              <div className="tag-picker-create-actions">
                <button
                  className="mini-button"
                  onClick={() => {
                    setCreateMode(false);
                    setError(null);
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  disabled={name.trim().length === 0}
                  onClick={() => void handleCreateSubmit()}
                  type="button"
                >
                  Create & apply
                </button>
              </div>
            </div>
          )}
          {error !== null && <p className="tag-picker-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
