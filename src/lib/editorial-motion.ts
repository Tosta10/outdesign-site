import { renderSuspended } from "./render-visibility";
import { reducedSiteMotion } from "./site-motion";

/** Editorial reveals and framing follow native scrolling; there is no idle loop. */
export function initEditorialMotion(root: Document | HTMLElement): () => void {
  const sites = [...root.querySelectorAll<HTMLElement>(".editorial-site")];
  if (root.nodeType === 1 && (root as HTMLElement).matches(".editorial-site"))
    sites.unshift(root as HTMLElement);
  if (!sites.length) return () => {};

  const doc = root.nodeType === 9 ? root as Document : root.ownerDocument!;
  const view = doc.defaultView || window;
  const abort = new AbortController();
  const media = view.matchMedia("(prefers-reduced-motion: reduce)");
  const motionAvailable = typeof view.IntersectionObserver === "function";
  let frame = 0;
  const states = sites.map(site => ({
    site,
    previousMode: site.getAttribute("data-folio-motion"),
    reveals: [...site.querySelectorAll<HTMLElement>("[data-folio-reveal]")].map(element => ({
      element,
      previous: element.getAttribute("data-revealed"),
    })),
    parallax: [...site.querySelectorAll<HTMLElement>("[data-folio-parallax]")].map(element => ({
      element,
      offset: 0,
      previous: element.style.getPropertyValue("--folio-parallax-y"),
      priority: element.style.getPropertyPriority("--folio-parallax-y"),
    })),
  }));
  const ready = () => !["loading", "leaving"].includes(doc.body?.dataset.pageState || "");
  const active = (site: HTMLElement) =>
    motionAvailable && !doc.hidden && !renderSuspended(site) && !reducedSiteMotion(site) && ready();
  const reveal = (element: HTMLElement) => {
    element.dataset.revealed = "true";
    observer?.unobserve(element);
  };
  const observer = motionAvailable
    ? new view.IntersectionObserver(entries => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        const site = element.closest<HTMLElement>(".editorial-site");
        if (entry.isIntersecting && site && active(site)) reveal(element);
      }
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0 })
    : undefined;
  const resetParallax = (state: typeof states[number]) => {
    for (const item of state.parallax) {
      item.offset = 0;
      item.element.style.removeProperty("--folio-parallax-y");
    }
  };
  const draw = () => {
    frame = 0;
    if (abort.signal.aborted) return;
    const height = view.innerHeight || doc.documentElement.clientHeight || 1;
    for (const state of states) {
      if (!active(state.site)) continue;
      // Also inspect the viewport directly after resuming or a resize. A very tall
      // section must not depend on reaching an impossible intersection ratio.
      for (const { element } of state.reveals) {
        if (element.dataset.revealed === "true") continue;
        const rect = element.getBoundingClientRect();
        if (rect.height > 0 && rect.bottom > 0 && rect.top < height * .94) reveal(element);
      }
      for (const item of state.parallax) {
        const rect = item.element.getBoundingClientRect();
        if (!rect.width || !rect.height || rect.bottom < -48 || rect.top > height + 48) continue;
        // Subtract our last translation so the measurement does not feed back
        // into itself. Measure the artwork, rather than a potentially long page.
        const center = rect.top + rect.height / 2 - item.offset;
        item.offset = Math.max(-24, Math.min(24, (height / 2 - center) / (height / 2) * 24));
        item.element.style.setProperty("--folio-parallax-y", `${item.offset.toFixed(2)}px`);
      }
    }
  };
  const schedule = () => {
    if (!frame && !abort.signal.aborted && states.some(state => active(state.site)))
      frame = view.requestAnimationFrame(draw);
  };
  const refresh = () => {
    view.cancelAnimationFrame(frame);
    frame = 0;
    observer?.disconnect();
    for (const state of states) {
      const reduced = reducedSiteMotion(state.site) || !observer;
      const paused = doc.hidden || renderSuspended(state.site);
      state.site.dataset.folioMotion = reduced ? "reduced" : paused ? "paused" : "full";
      if (reduced) {
        for (const { element } of state.reveals) reveal(element);
      }
      if (reduced || paused) resetParallax(state);
      if (!active(state.site)) continue;
      for (const { element } of state.reveals)
        if (element.dataset.revealed !== "true") observer?.observe(element);
    }
    schedule();
  };
  const options = { signal: abort.signal, passive: true };
  view.addEventListener("scroll", schedule, options);
  // Capture scrolls inside an interactive author preview as well as the page.
  root.addEventListener("scroll", schedule, { ...options, capture: true });
  view.addEventListener("resize", schedule, options);
  root.addEventListener("focusin", event => {
    const target = event.target as HTMLElement;
    for (const state of states)
      for (const { element } of state.reveals)
        if (element.contains(target)) reveal(element);
  }, { signal: abort.signal });
  doc.addEventListener("visibilitychange", refresh, { signal: abort.signal });
  media.addEventListener("change", refresh, { signal: abort.signal });
  for (const eventDoc of new Set([document, doc])) {
    eventDoc.addEventListener("outdesign:site-motion", refresh, { signal: abort.signal });
    eventDoc.addEventListener("outdesign:render-visibility", refresh, { signal: abort.signal });
  }
  // The existing loader covers real preparation. Start the first reveal when it
  // releases the page, rather than playing the entrance behind that overlay.
  const loadingObserver = doc.body && typeof view.MutationObserver === "function"
    ? new view.MutationObserver(refresh)
    : undefined;
  loadingObserver?.observe(doc.body, { attributes: true, attributeFilter: ["data-page-state"] });
  refresh();

  return () => {
    abort.abort();
    view.cancelAnimationFrame(frame);
    observer?.disconnect();
    loadingObserver?.disconnect();
    for (const state of states) {
      if (state.previousMode === null) delete state.site.dataset.folioMotion;
      else state.site.setAttribute("data-folio-motion", state.previousMode);
      for (const { element, previous } of state.reveals) {
        if (previous === null) delete element.dataset.revealed;
        else element.setAttribute("data-revealed", previous);
      }
      for (const { element, previous, priority } of state.parallax) {
        if (previous) element.style.setProperty("--folio-parallax-y", previous, priority);
        else element.style.removeProperty("--folio-parallax-y");
      }
    }
  };
}
