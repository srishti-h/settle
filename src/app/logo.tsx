// One invoice line forking into three projects: the whole product in a mark.
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--lime)" />
      <path d="M6 16h8c3 0 4-7 7-7h3M14 16h10M14 16c3 0 4 7 7 7h3" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="16" r="2.2" fill="var(--ink)" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <Mark />
      <span className="text-lg font-semibold tracking-tight">settle</span>
    </span>
  );
}
