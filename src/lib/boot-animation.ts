export function paintBoot(overlay: HTMLElement, progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  overlay.style.setProperty("--boot", String(p));
  const message = p < .35 ? "BUILDING GEOMETRY" : p < .7 ? "CALIBRATING LIGHT" : "OBJECT SPACE / READY";
  const label = overlay.querySelector<HTMLElement>("[data-lab-boot-text]");
  if (label) label.textContent = p === 1 ? message : message.slice(0, Math.max(1, Math.ceil(((p % .35) / .35) * message.length)));
}
