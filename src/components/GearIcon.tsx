/** Original flat gear with two concentric rings. Uses the surrounding text color. */
export function GearIcon() {
  return <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <circle cx="16" cy="16" r="9.5" />
    <circle cx="16" cy="16" r="4" />
    {Array.from({ length: 12 }, (_, i) => <path key={i} d="M16 3v3" strokeLinecap="square" transform={`rotate(${i * 30} 16 16)`} />)}
  </svg>;
}
