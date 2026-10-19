import { useEffect, type RefObject } from "react";

/** Pointer capture supports mouse, pen and touch; each drop is one undo step. */
export function useCanvasDrag(
  root: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  move: (from: string, to: string) => void,
  step: (id: string, direction: number) => void,
  announce: (message: string) => void,
) {
  useEffect(() => {
    const canvas = root.current;
    if (!canvas || !enabled) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    let source: HTMLElement | null = null;
    let handle: HTMLElement | null = null;
    let target: HTMLElement | null = null;
    let ghost: HTMLElement | null = null;
    let id = "",
      pointer = -1,
      active = false,
      x = 0,
      y = 0,
      startX = 0,
      startY = 0;
    const reset = () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      source?.classList.remove("is-dragging");
      target?.classList.remove("is-drop-target");
      ghost?.remove();
      if (handle?.hasPointerCapture(pointer))
        handle.releasePointerCapture(pointer);
      source = target = handle = ghost = null;
      id = "";
      pointer = -1;
      active = false;
      canvas.classList.remove("is-arranging");
    };
    const paint = () => {
      frame = 0;
      if (!active || !ghost) return;
      ghost.style.transform = `translate3d(${x + 14}px, ${y - 18}px, 0)`;
      const kind = id.split(":")[0];
      const hit = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>(`[data-layout^="${kind}:"]`);
      const next = hit && canvas.contains(hit) && hit !== source ? hit : null;
      if (next !== target) {
        target?.classList.remove("is-drop-target");
        target = next;
        target?.classList.add("is-drop-target");
      }
      const bounds = canvas.getBoundingClientRect();
      const delta = y > bounds.bottom - 60 ? 12 : y < bounds.top + 60 ? -12 : 0;
      if (delta) {
        canvas.scrollTop += delta;
        frame = requestAnimationFrame(paint);
      }
    };
    canvas.addEventListener(
      "pointerdown",
      (event) => {
        const item = (event.target as Element).closest<HTMLElement>(
          "[data-drag-handle]",
        );
        if (!item || event.button !== 0) return;
        event.preventDefault();
        reset();
        handle = item;
        id = item.dataset.dragHandle!;
        pointer = event.pointerId;
        source = canvas.querySelector<HTMLElement>(`[data-layout="${id}"]`);
        x = startX = event.clientX;
        y = startY = event.clientY;
        item.setPointerCapture(pointer);
        timer = setTimeout(
          () => {
            if (!source || !handle) return;
            active = true;
            source.classList.add("is-dragging");
            canvas.classList.add("is-arranging");
            ghost = document.createElement("div");
            ghost.className = "canvas-drag-ghost";
            ghost.textContent = `⠿ ${handle.textContent || "移動區塊"}`;
            document.body.append(ghost);
            paint();
          },
          event.pointerType === "touch" ? 320 : 180,
        );
      },
      { signal: abort.signal },
    );
    canvas.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerId !== pointer) return;
        x = event.clientX;
        y = event.clientY;
        if (!active && Math.hypot(x - startX, y - startY) > 12) {
          reset();
          return;
        }
        if (active) {
          event.preventDefault();
          if (!frame) frame = requestAnimationFrame(paint);
        }
      },
      { signal: abort.signal },
    );
    canvas.addEventListener(
      "pointerup",
      (event) => {
        if (event.pointerId !== pointer) return;
        const from = id,
          to = target?.dataset.layout;
        const changed = active && to && from !== to;
        reset();
        if (changed) {
          move(from, to);
          announce("區塊位置已更新，正在自動儲存。");
        }
      },
      { signal: abort.signal },
    );
    canvas.addEventListener("pointercancel", reset, { signal: abort.signal });
    canvas.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") {
          reset();
          return;
        }
        const item = (event.target as Element).closest<HTMLElement>(
          "[data-drag-handle]",
        );
        if (
          !item ||
          !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
            event.key,
          )
        )
          return;
        event.preventDefault();
        step(
          item.dataset.dragHandle!,
          ["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1,
        );
      },
      { signal: abort.signal },
    );
    return () => {
      abort.abort();
      reset();
    };
  }, [root, enabled, move, step, announce]);
}
