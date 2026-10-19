/** Small, event-driven effects. No animation loop runs while the pointer is idle. */
export function initEffects(root: Document | HTMLElement): () => void {
  const site = root.querySelector<HTMLElement>(".site");
  if (!site) return () => {};
  const abort = new AbortController();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const cleanups: (() => void)[] = [];
  const eligible = () =>
    !reduced.matches &&
    fine.matches &&
    !document.hidden &&
    site.dataset.editing !== "true";
  site.querySelectorAll<HTMLElement>("[data-optical-card]").forEach((card) => {
    let frame = 0,
      x = 0,
      y = 0,
      targetX = 0,
      targetY = 0;
    let rect: DOMRect | null = null;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      x = y = targetX = targetY = 0;
      card.style.removeProperty("transform");
      card.style.removeProperty("will-change");
      rect = null;
    };
    const draw = () => {
      if (!eligible()) {
        reset();
        return;
      }
      const damping = Number(site.dataset.damping) || 0.12;
      x += (targetX - x) * damping;
      y += (targetY - y) * damping;
      card.style.transform = `perspective(1000px) rotateX(${x}deg) rotateY(${y}deg)`;
      if (Math.abs(x - targetX) + Math.abs(y - targetY) > 0.015)
        frame = requestAnimationFrame(draw);
      else {
        frame = 0;
        if (!targetX && !targetY) reset();
      }
    };
    const start = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    card.addEventListener(
      "pointerenter",
      () => {
        if (!eligible() || site.dataset.cardEffect !== "tilt") return;
        rect = card.getBoundingClientRect();
        card.style.willChange = "transform";
      },
      { signal: abort.signal },
    );
    card.addEventListener(
      "pointermove",
      (event) => {
        if (!rect || !eligible()) return;
        const strength = Number(site.dataset.tilt) || 3;
        targetX =
          Math.max(
            -1,
            Math.min(1, (0.5 - (event.clientY - rect.top) / rect.height) * 2),
          ) * strength;
        targetY =
          Math.max(
            -1,
            Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2),
          ) * strength;
        start();
      },
      { signal: abort.signal },
    );
    card.addEventListener(
      "pointerleave",
      () => {
        targetX = targetY = 0;
        if (rect) start();
      },
      { signal: abort.signal },
    );
    cleanups.push(reset);
  });
  const timers = new Set<ReturnType<typeof setTimeout>>();
  site.addEventListener(
    "click",
    (event) => {
      if (reduced.matches || site.dataset.ripple !== "true") return;
      const target = (event.target as Element).closest<HTMLElement>(
        "button, .circle-arrow",
      );
      if (
        !target ||
        target.closest("dialog") ||
        target.closest("[data-drag-handle]")
      )
        return;
      target.classList.remove("press-feedback");
      requestAnimationFrame(() => {
        if (!abort.signal.aborted) target.classList.add("press-feedback");
      });
      const timer = setTimeout(() => {
        target.classList.remove("press-feedback");
        timers.delete(timer);
      }, 460);
      timers.add(timer);
    },
    { signal: abort.signal },
  );
  const resetAll = () => cleanups.forEach((fn) => fn());
  document.addEventListener("visibilitychange", resetAll, {
    signal: abort.signal,
  });
  window.addEventListener("scroll", resetAll, {
    signal: abort.signal,
    passive: true,
  });
  window.addEventListener("resize", resetAll, {
    signal: abort.signal,
    passive: true,
  });
  reduced.addEventListener("change", resetAll, { signal: abort.signal });
  fine.addEventListener("change", resetAll, { signal: abort.signal });
  return () => {
    abort.abort();
    resetAll();
    timers.forEach(clearTimeout);
    site
      .querySelectorAll(".press-feedback")
      .forEach((el) => el.classList.remove("press-feedback"));
  };
}
