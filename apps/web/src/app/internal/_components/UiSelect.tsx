import { ChevronDown } from 'lucide-react';
import type { SelectHTMLAttributes } from 'react';

type UiSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  compact?: boolean;
};

export function UiSelect({ children, className, compact = false, ...props }: UiSelectProps) {
  return (
    <span className={className === undefined ? 'ui-select' : `ui-select ${className}`} data-compact={compact}>
      <select {...props}>{children}</select>
      <ChevronDown aria-hidden="true" size={14} />
    </span>
  );
}
