export type SiteMotion = "system" | "full" | "reduced";
const key = "outdesign.site.motion.v1";
export const isSiteMotion = (value: unknown): value is SiteMotion =>
  value === "system" || value === "full" || value === "reduced";

export function savedSiteMotion(): SiteMotion | undefined {
  try {
    const saved = localStorage.getItem(key);
    if (isSiteMotion(saved)) return saved;
    // Preserve the visitor's existing explicit choice on the works page.
    const legacy = JSON.parse(localStorage.getItem("outdesign.work-lab.preferences.v2") || "null");
    return isSiteMotion(legacy?.motionPreset) ? legacy.motionPreset : undefined;
  } catch { return undefined; }
}

export function reducedSiteMotion(root: Document | HTMLElement): boolean {
  const site = root.nodeType === 1 && (root as HTMLElement).matches(".site")
    ? root as HTMLElement
    : root.querySelector<HTMLElement>(".site") || (root.nodeType === 1 ? (root as HTMLElement).closest<HTMLElement>(".site") : null);
  return site?.dataset.motion ? site.dataset.motion === "reduced" : matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function initSiteMotion(root: Document | HTMLElement): () => void {
  const abort = new AbortController();
  const doc = root.nodeType === 9 ? root as Document : root.ownerDocument!;
  const media = (doc.defaultView || window).matchMedia("(prefers-reduced-motion: reduce)");
  let preference = savedSiteMotion() || "system";
  const apply = () => {
    const motion = preference === "reduced" || preference === "system" && media.matches ? "reduced" : "full";
    root.querySelectorAll<HTMLElement>(".site").forEach(site => { site.dataset.motion = motion; });
    root.querySelectorAll<HTMLSelectElement>("[data-site-motion-select]").forEach(select => { select.value = preference; });
    if (root === document || doc !== document) doc.documentElement.dataset.siteMotion = motion;
  };
  document.addEventListener("outdesign:site-motion", ((event: CustomEvent<SiteMotion>) => {
    if (!isSiteMotion(event.detail)) return;
    preference = event.detail;
    apply();
  }) as EventListener, { signal: abort.signal });
  media.addEventListener("change", apply, { signal: abort.signal });
  root.querySelectorAll<HTMLSelectElement>("[data-site-motion-select]").forEach(select => {
    select.addEventListener("change", () => setSiteMotion(select.value as SiteMotion), { signal: abort.signal });
  });
  apply();
  return () => abort.abort();
}

export function setSiteMotion(preference: SiteMotion) {
  if (!isSiteMotion(preference)) return;
  try { localStorage.setItem(key, preference); } catch { /* Optional visitor preference. */ }
  document.dispatchEvent(new CustomEvent("outdesign:site-motion", { detail: preference }));
}
