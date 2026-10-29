export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className="brand-mark"
    >
      <rect x="1" y="1" width="38" height="38" fill="var(--brand-mark-bg)" />
      <path
        d="M13 28V12h7.1a5.2 5.2 0 0 1 0 10.4H13m7.3 0L27 28"
        stroke="var(--brand-mark-line)"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="29" cy="11" r="2" fill="var(--brand-mark-accent)" />
    </svg>
  )
}
