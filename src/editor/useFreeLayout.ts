import { useEffect, type RefObject } from "react";
import type { CanvasNode } from "../../supabase/functions/_shared/schema";
/** Transient pointer motion uses transforms. A completed gesture makes one history entry. */
export function useFreeLayout(
  root: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  nodes: CanvasNode[],
  commit: (id: string, patch: Partial<CanvasNode>) => void,
  select: (id: string) => void,
  snap: boolean,
) {
  useEffect(() => {
    const canvas = root.current;
    if (!canvas || !enabled) return;
    const abort = new AbortController();
    let active: {
      node: CanvasNode;
      el: HTMLElement;
      handle: HTMLElement;
      pointer: number;
      resize: boolean;
      x: number;
      y: number;
      dx: number;
      dy: number;
      scale: number;
      parentWidth: number;
      parentHeight: number;
      renderedWidth: number;
      renderedHeight: number;
    } | null = null;
    let raf = 0;
    const reset = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (active) {
        active.el.style.removeProperty("transform");
        active.el.style.removeProperty("transform-origin");
        active.el.style.removeProperty("will-change");
        if (active.handle.hasPointerCapture(active.pointer))
          active.handle.releasePointerCapture(active.pointer);
      }
      active = null;
    };
    const quantize = (value: number) =>
      snap ? Math.round(value / 8) * 8 : Math.round(value);
    const values = () => {
      if (!active) return {};
      const a = active;
      return a.resize
        ? {
            width: Math.max(
              80,
              Math.min(1600, a.parentWidth, quantize(a.node.width + a.dx)),
            ),
            height: Math.max(
              40,
              Math.min(
                2000,
                Math.max(40, a.parentHeight - a.node.y),
                quantize(a.node.height + a.dy),
              ),
            ),
          }
        : {
            x: Math.max(
              0,
              Math.min(
                100 *
                  (1 - Math.min(a.node.width, a.parentWidth) / a.parentWidth),
                a.node.x + (100 * quantize(a.dx)) / a.parentWidth,
              ),
            ),
            y: Math.max(
              0,
              Math.min(
                Math.max(0, a.parentHeight - a.node.height),
                a.node.y + quantize(a.dy),
              ),
            ),
          };
    };
    const paint = () => {
      raf = 0;
      if (!active) return;
      const v = values();
      if (active.resize) {
        active.el.style.transform = `scale(${(v.width || 80) / active.renderedWidth},${(v.height || 40) / active.renderedHeight})`;
      } else
        active.el.style.transform = `translate3d(${(((v.x || 0) - active.node.x) * active.parentWidth) / 100}px,${(v.y || 0) - active.node.y}px,0)`;
    };
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        const handle = (e.target as Element).closest<HTMLElement>(
          "[data-free-move],[data-free-resize]",
        );
        if (!handle || e.button !== 0) return;
        const id = handle.dataset.freeMove || handle.dataset.freeResize;
        const node = nodes.find((item) => item.id === id);
        const el = handle.closest<HTMLElement>("[data-node-id]");
        const parent = el?.parentElement;
        if (!node || !el || !parent || node.locked) return;
        e.preventDefault();
        reset();
        const bounds = parent.getBoundingClientRect();
        const scale = bounds.width / parent.offsetWidth;
        active = {
          node,
          el,
          handle,
          pointer: e.pointerId,
          resize: Boolean(handle.dataset.freeResize),
          x: e.clientX,
          y: e.clientY,
          dx: 0,
          dy: 0,
          scale,
          parentWidth: parent.clientWidth,
          parentHeight: parent.clientHeight,
          renderedWidth: el.offsetWidth,
          renderedHeight: el.offsetHeight,
        };
        el.style.transformOrigin = "top left";
        el.style.willChange = "transform";
        handle.setPointerCapture(e.pointerId);
        select(node.id);
      },
      { signal: abort.signal },
    );
    canvas.addEventListener(
      "pointermove",
      (e) => {
        if (!active || e.pointerId !== active.pointer) return;
        active.dx = (e.clientX - active.x) / active.scale;
        active.dy = (e.clientY - active.y) / active.scale;
        if (!raf) raf = requestAnimationFrame(paint);
      },
      { signal: abort.signal },
    );
    canvas.addEventListener(
      "pointerup",
      (e) => {
        if (!active || e.pointerId !== active.pointer) return;
        const id = active.node.id;
        const patch = values();
        const moved = Math.abs(active.dx) + Math.abs(active.dy) > 2;
        reset();
        if (moved) commit(id, patch);
      },
      { signal: abort.signal },
    );
    canvas.addEventListener("pointercancel", reset, { signal: abort.signal });
    canvas.addEventListener(
      "keydown",
      (e) => {
        const handle = (e.target as Element).closest<HTMLElement>(
          "[data-free-move]",
        );
        if (!handle) return;
        const node = nodes.find((item) => item.id === handle.dataset.freeMove);
        const parent =
          handle.closest<HTMLElement>("[data-node-id]")?.parentElement;
        if (!node || !parent || node.locked) return;
        const step = e.shiftKey ? 1 : 8;
        if (
          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
        )
          return;
        e.preventDefault();
        const dx =
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy =
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        commit(node.id, {
          x: Math.max(
            0,
            Math.min(
              100 *
                (1 -
                  Math.min(node.width, parent.clientWidth) /
                    parent.clientWidth),
              node.x + (dx / parent.clientWidth) * 100,
            ),
          ),
          y: Math.max(
            0,
            Math.min(parent.clientHeight - node.height, node.y + dy),
          ),
        });
      },
      { signal: abort.signal },
    );
    return () => {
      abort.abort();
      reset();
    };
  }, [enabled, nodes, snap]);
}
