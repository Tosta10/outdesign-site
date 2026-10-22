/** Keep server markup covered until the viewer and its first scene frame are ready. */
export function initPageLoading(viewerReady: Promise<unknown>) {
  const loader = document.querySelector<HTMLElement>("[data-page-loader]");
  const site = document.getElementById("public-site");
  if (!loader || !site) return () => {};
  const abort = new AbortController();
  let navigating = false;
  const reveal = () => {
    document.body.dataset.pageState = "ready";
    site.inert = false;
    site.setAttribute("aria-busy", "false");
    if (document.activeElement === document.body) site.querySelector<HTMLElement>(".lab-boot:not([hidden]) button,.page-work .lab-stage")?.focus({ preventScroll: true });
  };
  site.inert = true;
  site.setAttribute("aria-busy", "true");
  const images = [...site.querySelectorAll<HTMLImageElement>(".lunar-backdrop,.hero-image")];
  void Promise.allSettled([
    viewerReady,
    document.fonts.ready,
    Promise.race([
      Promise.allSettled(images.map(image => image.decode())),
      new Promise(resolve => setTimeout(resolve, 2500)),
    ]),
  ]).then(() => { if (!abort.signal.aborted && !navigating) reveal(); });
  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
    if (!link || link.hasAttribute("download") || link.target && link.target !== "_self") return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname && url.search === location.search) return;
    event.preventDefault();
    navigating = true;
    document.body.dataset.pageState = "leaving";
    site.inert = true;
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!abort.signal.aborted) location.assign(url.href); }));
  }, { signal: abort.signal });
  window.addEventListener("pageshow", event => { if (event.persisted) { navigating = false; reveal(); } }, { signal: abort.signal });
  return () => { abort.abort(); reveal(); };
}
