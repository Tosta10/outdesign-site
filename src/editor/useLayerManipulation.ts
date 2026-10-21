import { useEffect, useRef, type RefObject } from "react";
import type {
  Selection,
  SiteContent,
} from "../../supabase/functions/_shared/schema";
import { patchLayer, selectionKey, type LayerValues } from "../lib/layers";
export type CanvasTool = "select" | "move" | "pan";
/** Pointer movement never updates React. One release = one undo/autosave entry. */
export function useLayerManipulation(
  root: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  content: SiteContent | null,
  selection: Selection,
  page: string,
  tool: CanvasTool,
  snap: boolean,
  select: (value: Selection) => void,
  update: (edit: (next: SiteContent) => void) => void,
) {
  const state = useRef({ content, selection, page, select, update });
  state.current = { content, selection, page, select, update };
  const suppressed = useRef(false);
  useEffect(() => {
    const canvas = root.current;
    if (!canvas || !enabled) return;
    const abort = new AbortController();
    let active: {
      el: HTMLElement;
      key: string;
      px: number;
      py: number;
      dx: number;
      dy: number;
      scale: number;
      width: number;
      height: number;
      old: string;
      values: LayerValues;
      resize: boolean;
      pan: boolean;
    } | null = null;
    let raf = 0;
    const quantize = (n: number) =>
      snap ? Math.round(n / 8) * 8 : Math.round(n);
    const patch = (): Partial<LayerValues> =>
      !active
        ? {}
        : active.resize
          ? {
              width: Math.max(
                16,
                Math.min(3000, quantize(active.width + active.dx)),
              ),
              height: Math.max(
                16,
                Math.min(3000, quantize(active.height + active.dy)),
              ),
            }
          : {
              x: Math.max(
                -3000,
                Math.min(3000, (active.values.x || 0) + quantize(active.dx)),
              ),
              y: Math.max(
                -3000,
                Math.min(3000, (active.values.y || 0) + quantize(active.dy)),
              ),
            };
    const paint = () => {
      raf = 0;
      if (!active || active.pan) return;
      const values = patch();
      if (active.resize) {
        active.el.style.width = `${values.width}px`;
        active.el.style.height = `${values.height}px`;
      } else active.el.style.translate = `${values.x}px ${values.y}px`;
    };
    const finish = (commit: boolean) => {
      if (!active) return;
      cancelAnimationFrame(raf);
      raf = 0;
      const a = active,
        values = patch();
      active = null;
      a.el.setAttribute("style", a.old);
      canvas.classList.remove("is-manipulating");
      if (commit && !a.pan && Math.abs(a.dx) + Math.abs(a.dy) > 3) {
        suppressed.current = true;
        state.current.update((next) => patchLayer(next, a.key, values));
        setTimeout(() => {
          suppressed.current = false;
        }, 0);
      }
    };
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (
          e.button !== 0 ||
          (e.target as Element).closest(
            "[data-drag-handle],[data-free-move],[data-free-resize]",
          )
        )
          return;
        const handle = (e.target as Element).closest<HTMLElement>(
          "[data-layer-resize]",
        );
        const el = handle
          ? canvas.querySelector<HTMLElement>(
              `[data-element-key="${handle.dataset.layerResize}"]`,
            )
          : (e.target as Element).closest<HTMLElement>("[data-element-key]");
        const pan = tool === "pan";
        if (
          !pan &&
          (!el || el.closest('[data-layer-locked="true"],[data-locked="true"]'))
        )
          return;
        if (!pan && tool === "select" && !handle) return;
        const target = el || canvas,
          rect = target.getBoundingClientRect();
        const key = target.dataset.elementKey || "";
        active = {
          el: target,
          key,
          px: e.clientX,
          py: e.clientY,
          dx: 0,
          dy: 0,
          scale: target.offsetWidth ? rect.width / target.offsetWidth : 1,
          width: target.offsetWidth,
          height: target.offsetHeight,
          old: target.getAttribute("style") || "",
          values: state.current.content?.presentation?.elements?.[key] || {},
          resize: Boolean(handle),
          pan,
        };
        if (!pan)
          state.current.select(
            (target.dataset.edit || `element:${key}`) as Selection,
          );
        canvas.setPointerCapture(e.pointerId);
        canvas.classList.add("is-manipulating");
        e.preventDefault();
      },
      { signal: abort.signal },
    );
    canvas.addEventListener(
      "pointermove",
      (e) => {
        if (!active) return;
        const dx = (e.clientX - active.px) / (active.scale || 1),
          dy = (e.clientY - active.py) / (active.scale || 1);
        if (active.pan) {
          canvas.scrollLeft -= dx - active.dx;
          canvas.scrollTop -= dy - active.dy;
        }
        active.dx = dx;
        active.dy = dy;
        if (!raf) raf = requestAnimationFrame(paint);
      },
      { signal: abort.signal },
    );
    canvas.addEventListener("pointerup", () => finish(true), {
      signal: abort.signal,
    });
    canvas.addEventListener("pointercancel", () => finish(false), {
      signal: abort.signal,
    });
    const blur = () => finish(false);
    window.addEventListener("blur", blur, { signal: abort.signal });
    return () => {
      finish(false);
      abort.abort();
    };
  }, [enabled, tool, snap]);
  useEffect(() => {
    const canvas = root.current;
    if (!canvas || !enabled || !content) return;
    const key = selectionKey(selection, page),
      el = canvas.querySelector<HTMLElement>(
        `[data-element-key="${CSS.escape(key)}"]`,
      );
    canvas
      .querySelectorAll(".layer-active")
      .forEach((e) => e.classList.remove("layer-active"));
    if (!el) return;
    el.classList.add("layer-active");
    const handle = document.createElement("button");
    handle.className = "layer-resize-corner";
    handle.dataset.layerResize = key;
    handle.setAttribute("aria-label", "拖曳縮放選取物件");
    if (el.closest('[data-layer-locked="true"],[data-locked="true"]')) return;
    canvas.append(handle);
    let raf = 0;
    const paint = () => {
      raf = 0;
      const r = el.getBoundingClientRect(),
        c = canvas.getBoundingClientRect();
      handle.style.left = `${r.right - 5}px`;
      handle.style.top = `${r.bottom - 5}px`;
      handle.hidden =
        el.offsetWidth === 0 ||
        r.bottom < c.top ||
        r.top > c.bottom ||
        r.right < c.left ||
        r.left > c.right;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    canvas.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    paint();
    return () => {
      observer.disconnect();
      canvas.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(raf);
      handle.remove();
    };
  }, [content, selection, enabled, page]);
  return suppressed;
}
