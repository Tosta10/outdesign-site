import { useEffect, useRef, type RefObject } from "react";

export const zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
export const isTextEntry = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),dialog'));

/** Scroll coordinates stay in screen pixels; document mutations remain separate. */
export function useCanvasNavigation(
  root: RefObject<HTMLDivElement | null>, enabled: boolean,
  zoom: number, setZoom: (value: number) => void,
  handTool = false,
) {
  const state = useRef({ zoom, setZoom, handTool });
  state.current = { zoom, setZoom, handTool };
  const suppressClick = useRef(false);
  useEffect(() => {
    const canvas = root.current;
    if (!canvas || !enabled) return;
    const abort = new AbortController();
    let space = false;
    let gesture: { id: number; x: number; y: number; left: number; top: number } | null = null;
    const zoomAt = (value: number, x = canvas.clientWidth / 2, y = canvas.clientHeight / 2) => {
      const next = Math.max(0.25, Math.min(2, Math.round(value * 100) / 100));
      const ratio = next / state.current.zoom;
      const left = (canvas.scrollLeft + x) * ratio - x;
      const top = (canvas.scrollTop + y) * ratio - y;
      state.current.setZoom(next);
      requestAnimationFrame(() => canvas.scrollTo({ left, top, behavior: "instant" }));
    };
    const end = () => {
      if (gesture && canvas.hasPointerCapture(gesture.id)) canvas.releasePointerCapture(gesture.id);
      gesture = null;
      canvas.classList.remove("is-panning");
    };
    window.addEventListener("keydown", (e) => {
      if (isTextEntry(e.target) || e.isComposing) return;
      if (e.key === "Alt") e.preventDefault();
      if (e.code === "Space" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        space = true;
        canvas.classList.add("space-pan");
      }
      if ((e.ctrlKey || e.metaKey) && ["+", "=", "-", "0"].includes(e.key)) {
        e.preventDefault();
        zoomAt(e.key === "0" ? 1 : state.current.zoom + (e.key === "-" ? -0.1 : 0.1));
      }
    }, { capture: true, signal: abort.signal });
    window.addEventListener("keyup", (e) => {
      if (e.key === "Alt" && !isTextEntry(e.target)) e.preventDefault();
      if (e.code === "Space") {
        space = false;
        canvas.classList.remove("space-pan");
      }
    }, { capture: true, signal: abort.signal });
    window.addEventListener("blur", () => {
      space = false;
      canvas.classList.remove("space-pan");
      end();
      suppressClick.current = false;
    }, { signal: abort.signal });
    canvas.addEventListener("wheel", (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || isTextEntry(e.target)) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(state.current.zoom * Math.exp(-e.deltaY * 0.002), e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false, signal: abort.signal });
    canvas.addEventListener("pointerdown", (e) => {
      if (!((space || state.current.handTool) && e.button === 0) && e.button !== 1) return;
      if (isTextEntry(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      suppressClick.current = true;
      gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, left: canvas.scrollLeft, top: canvas.scrollTop };
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add("is-panning");
    }, { capture: true, signal: abort.signal });
    canvas.addEventListener("pointermove", (e) => {
      if (!gesture || gesture.id !== e.pointerId) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      canvas.scrollTo({ left: gesture.left + gesture.x - e.clientX, top: gesture.top + gesture.y - e.clientY, behavior: "instant" });
    }, { capture: true, signal: abort.signal });
    canvas.addEventListener("pointerup", (e) => {
      if (!gesture || gesture.id !== e.pointerId) return;
      e.stopImmediatePropagation();
      end();
      setTimeout(() => { suppressClick.current = false; }, 0);
    }, { capture: true, signal: abort.signal });
    canvas.addEventListener("pointercancel", () => { end(); suppressClick.current = false; }, { signal: abort.signal });
    return () => { end(); canvas.classList.remove("space-pan"); abort.abort(); };
  }, [enabled]);
  return suppressClick;
}
