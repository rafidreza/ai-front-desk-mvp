import { X } from 'lucide-react';
import { Tag } from '@/types/domain';

export interface TagChipProps {
  tag: Tag;
  onRemove?: (tag: Tag) => void;
  size?: 'sm' | 'md';
}

export function TagChip({ tag, onRemove, size = 'sm' }: TagChipProps) {
  return (
    <span className="tag-chip" data-color={tag.color} data-size={size}>
      <span>{tag.name}</span>
      {onRemove !== undefined && (
        <button
          aria-label={`Remove tag ${tag.name}`}
          className="tag-chip__remove"
          onClick={() => onRemove(tag)}
          type="button"
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}
