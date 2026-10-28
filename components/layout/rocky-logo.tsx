export function RockyLogoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" fill="var(--card)" />
      <text
        x="20"
        y="31"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI', Aptos, sans-serif"
        fontSize="34"
        fontWeight="600"
        fill="var(--foreground)"
      >
        r
      </text>
      <circle cx="32" cy="8" r="2" fill="var(--primary)" />
    </svg>
  )
}
