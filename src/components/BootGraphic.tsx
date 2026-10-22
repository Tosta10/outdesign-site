/** Shared by the site loading screen and the work laboratory replay. */
export function BootGraphic() {
  return <>
    <svg viewBox="0 0 160 160" aria-hidden="true">
      <path d="M80 12 148 80 80 148 12 80Z" />
      <path d="M80 40 120 80 80 120 40 80Z" />
      <circle cx="80" cy="80" r="54" />
    </svg>
    <span data-lab-boot-text>INITIALIZING OBJECT SPACE</span>
    <div aria-hidden="true"><i /></div>
  </>;
}
