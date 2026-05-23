type ListSkeletonProps = {
  rows?: number;
  variant?: 'ticket' | 'conversation' | 'default' | 'qa';
};

export function ListSkeleton({ rows = 4, variant = 'default' }: ListSkeletonProps) {
  return (
    <div className="list-skeleton" data-variant={variant} aria-label="Loading list">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton-row" key={index}>
          <span className="skeleton-avatar" />
          <span className="skeleton-copy">
            <span />
            <span />
          </span>
          <span className="skeleton-chip" />
        </div>
      ))}
    </div>
  );
}
