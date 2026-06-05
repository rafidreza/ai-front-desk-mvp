type DaemionBrandProps = {
  className?: string;
  label?: string;
};

export function DaemionMark({ className = '', label = 'Daemion' }: DaemionBrandProps) {
  const isDecorative = label.trim() === '';

  return (
    <svg
      aria-hidden={isDecorative ? true : undefined}
      aria-label={isDecorative ? undefined : label}
      className={className}
      focusable="false"
      role={isDecorative ? undefined : 'img'}
      viewBox="122 71 160 160"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M245.908 150C245.908 169.882 229.79 186 209.908 186H180.908C178.699 186 176.908 187.791 176.908 190V194C176.908 196.209 178.699 198 180.908 198H209.908C222.081 198 233.196 193.469 241.658 186C251.623 177.205 257.908 164.336 257.908 150C257.908 135.664 251.623 122.795 241.658 114C233.196 106.532 222.081 102 209.908 102H158.908C156.699 102 154.908 103.791 154.908 106V110C154.908 112.209 156.699 114 158.908 114H209.908C229.79 114 245.908 130.118 245.908 150Z"
        fill="currentColor"
      />
      <circle cx="155" cy="192" fill="#54E3F9" r="9" />
    </svg>
  );
}

export function DaemionLockup({ className = '', label = 'Daemion' }: DaemionBrandProps) {
  const hasLabel = label.trim() !== '';

  return (
    <span
      aria-hidden={hasLabel ? undefined : true}
      aria-label={hasLabel ? label : undefined}
      className={`daemion-lockup ${className}`.trim()}
      role={hasLabel ? 'img' : undefined}
    >
      <DaemionMark className="daemion-lockup-mark" label="" />
      <span aria-hidden="true">DAEMION</span>
    </span>
  );
}
