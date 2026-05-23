'use client';

import { CheckCheck, UserCheck, X } from 'lucide-react';
import { InternalUser, Tag, TagColor } from '@/types/domain';
import { TagPicker } from './TagPicker';

export interface BulkActionBarProps {
  selectedCount: number;
  sameClient: boolean;
  isBusy?: boolean;
  assigneeOptions: InternalUser[];
  availableTags: Tag[];
  onClose: () => void | Promise<void>;
  onAssign: (assigneeId: string) => void | Promise<void>;
  onApplyTag: (tagId: string) => void | Promise<void>;
  onCreateTag?: (name: string, color: TagColor) => Promise<Tag>;
  onClearSelection: () => void;
}

export function BulkActionBar({
  selectedCount,
  sameClient,
  isBusy,
  assigneeOptions,
  availableTags,
  onClose,
  onAssign,
  onApplyTag,
  onCreateTag,
  onClearSelection,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;
  return (
    <div className="bulk-action-bar" role="toolbar" aria-label="Bulk ticket actions">
      <div className="bulk-action-bar__count">
        <strong>{selectedCount}</strong> selected
        {!sameClient && <span className="bulk-action-bar__warning">multiple clients · tag disabled</span>}
      </div>
      <div className="bulk-action-bar__actions">
        <button
          className="mini-button"
          disabled={isBusy}
          onClick={() => void onClose()}
          type="button"
        >
          <CheckCheck size={13} />
          Mark resolved
        </button>
        <label className="bulk-action-bar__assign">
          <UserCheck size={13} />
          <select
            aria-label="Bulk assignee"
            disabled={isBusy}
            onChange={(event) => {
              if (event.target.value !== '') {
                void onAssign(event.target.value);
                event.target.value = '';
              }
            }}
          >
            <option value="">Assign to…</option>
            <option value="unassigned">Unassigned</option>
            {assigneeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {sameClient && (
          <TagPicker
            availableTags={availableTags}
            isBusy={isBusy}
            onApply={onApplyTag}
            onCreate={onCreateTag}
            triggerLabel="Apply tag"
          />
        )}
      </div>
      <button
        aria-label="Clear selection"
        className="bulk-action-bar__close"
        onClick={onClearSelection}
        type="button"
      >
        <X size={14} />
      </button>
    </div>
  );
}
