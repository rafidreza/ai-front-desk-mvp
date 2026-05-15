import { AlertTriangle, RefreshCw } from 'lucide-react';

interface PanelErrorProps {
  message: string;
  isRetrying: boolean;
  onRetry: () => void;
}

export function PanelError({ message, isRetrying, onRetry }: PanelErrorProps) {
  return (
    <div className="panel-error">
      <AlertTriangle size={18} />
      <strong>Could not load this panel</strong>
      <p>{message}</p>
      <button className="mini-button" type="button" onClick={onRetry} disabled={isRetrying}>
        <RefreshCw size={14} />
        Retry
      </button>
    </div>
  );
}
