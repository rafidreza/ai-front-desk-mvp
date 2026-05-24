import { AlertTriangle, RefreshCw } from 'lucide-react';

interface LoadErrorNoticeProps {
  title: string;
  message: string;
  diagnostic: string;
  retryLabel?: string;
  isRetrying: boolean;
  onRetry: () => void;
}

export function LoadErrorNotice({
  title,
  message,
  diagnostic,
  retryLabel = 'Retry',
  isRetrying,
  onRetry,
}: LoadErrorNoticeProps) {
  return (
    <div className="inline-alert inline-alert--recovery" role="alert">
      <AlertTriangle size={18} />
      <div className="inline-alert__body">
        <strong>{title}</strong>
        <span>{message}</span>
        <small>{diagnostic}</small>
      </div>
      <button className="mini-button" type="button" onClick={onRetry} disabled={isRetrying}>
        <RefreshCw size={14} />
        {retryLabel}
      </button>
    </div>
  );
}
