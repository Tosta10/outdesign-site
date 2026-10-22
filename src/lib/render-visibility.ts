/** Includes passive same-origin iframe previews whose owner lives behind a modal. */
export function renderSuspended(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  for (let depth = 0; current && depth < 8; depth++) {
    if (current.closest('[data-render-suspended="true"]')) return true;
    try { current = current.ownerDocument.defaultView?.frameElement as HTMLElement | null; }
    catch { return false; }
  }
  return false;
}

export function notifyRenderVisibility() {
  document.dispatchEvent(new Event("outdesign:render-visibility"));
}

export function suspendRendering(element: HTMLElement, suspended: boolean) {
  if (suspended) element.dataset.renderSuspended = "true";
  else delete element.dataset.renderSuspended;
  notifyRenderVisibility();
}
