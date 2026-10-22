import { paintBoot } from "./boot-animation";

/** A single boot covers preparation, resource decoding and the first rendered scene. */
export function initPageLoading(viewerReady: Promise<unknown>) {
  const loader = document.querySelector<HTMLElement>("[data-page-loader]");
  const site = document.getElementById("public-site");
  if (!loader || !site) return () => {};
  const abort = new AbortController();
  let navigating = false, prepared = false, frame = 0;
  const reduced = () => document.documentElement.dataset.siteMotion === "reduced";
  let completed = 0, total = 1;
  let showTimer = window.setTimeout(() => { loader.dataset.visible = "true"; }, 140);
  const reveal = () => {
    cancelAnimationFrame(frame);
    clearTimeout(showTimer);
    paintBoot(loader, 1);
    document.body.dataset.pageState = "ready";
    site.inert = false;
    site.setAttribute("aria-busy", "false");
    if (document.activeElement === document.body) site.querySelector<HTMLElement>(".page-work .lab-stage")?.focus({ preventScroll: true });
  };
  const animate = () => {
    if (abort.signal.aborted) return;
    const progress = reduced() ? .92 : .1 + .8 * completed / total;
    paintBoot(loader, progress);
    if (prepared && !navigating) reveal();
    else frame = requestAnimationFrame(animate);
  };
  site.inert = true;
  site.setAttribute("aria-busy", "true");
  frame = requestAnimationFrame(animate);
  const images = [...site.querySelectorAll<HTMLImageElement>("img")].filter(image => {
    const rect = image.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0;
  });
  images.forEach(image => { image.loading = "eager"; });
  const preparation = [
    viewerReady,
    document.fonts.ready,
    ...images.map(image => image.decode()),
  ];
  total = preparation.length;
  void Promise.allSettled(preparation.map(task => Promise.resolve(task).finally(() => { completed++; }))).then(async () => {
    // Allow decoded textures, layout and the resulting draw to reach a frame boundary.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (!abort.signal.aborted) {
      prepared = true;
      loader.dataset.prepared = "true";
    }
  });
  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
    if (!link || link.hasAttribute("download") || link.target && link.target !== "_self") return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname && url.search === location.search) return;
    event.preventDefault();
    navigating = true;
    prepared = false;
    completed = 0;
    delete loader.dataset.visible;
    clearTimeout(showTimer);
    showTimer = window.setTimeout(() => { loader.dataset.visible = "true"; }, 140);
    loader.dataset.prepared = "false";
    paintBoot(loader, 0);
    document.body.dataset.pageState = "leaving";
    site.inert = true;
    site.setAttribute("aria-busy", "true");
    frame = requestAnimationFrame(animate);
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!abort.signal.aborted) location.assign(url.href); }));
  }, { signal: abort.signal });
  window.addEventListener("pageshow", event => { if (event.persisted) { navigating = false; prepared = true; reveal(); } }, { signal: abort.signal });
  return () => { abort.abort(); reveal(); };
}
