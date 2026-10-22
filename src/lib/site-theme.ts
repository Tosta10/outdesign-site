export type SiteTheme = "light" | "dark";
const key = "outdesign.site.theme.v1";
export function savedSiteTheme(): SiteTheme | undefined {
  try { const value = localStorage.getItem(key); return value === "light" || value === "dark" ? value : undefined; } catch { return undefined; }
}
export function applySiteTheme(root: Document | HTMLElement, theme: SiteTheme) {
  const sites = [...root.querySelectorAll<HTMLElement>(".site")];
  if (root instanceof HTMLElement) {
    const site = root.closest<HTMLElement>(".site");
    if (site) sites.push(site);
  }
  sites.forEach(site => {
    site.dataset.siteTheme = theme;
    site.querySelectorAll<HTMLImageElement>('img[data-theme-light-src]').forEach(image => {
      const source = theme === 'light' ? image.dataset.themeLightSrc : image.dataset.themeDarkSrc;
      if (source && image.getAttribute('src') !== source) image.src = source;
    });
  });
  root.querySelectorAll<HTMLSelectElement>("[data-site-theme-select]").forEach(select => { select.value = theme; });
  if (root === document || root instanceof HTMLElement && !root.closest(".editor-shell,.scratch-studio")) document.documentElement.dataset.siteTheme = theme;
}
export function setSiteTheme(theme: SiteTheme) {
  if (theme !== "light" && theme !== "dark") return;
  try { localStorage.setItem(key, theme); } catch { /* Optional visitor preference. */ }
  document.dispatchEvent(new CustomEvent("outdesign:site-theme", { detail: theme }));
}
