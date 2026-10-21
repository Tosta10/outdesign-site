import type {
  LogicBlock,
  LogicScript,
} from "../../supabase/functions/_shared/schema";
import { selectionKey } from "./layers";
/** Event driven interpreter: bounded work, cancellable waits, no eval, timers or RAF at idle. */
export function initLogic(
  root: Document | HTMLElement,
  scripts: LogicScript[],
): () => void {
  const lifetime = new AbortController(),
    running = new Map<string, AbortController>(),
    variables = new Map<string, number>();
  const styles = new Map<HTMLElement, string | null>(),
    texts = new Map<HTMLElement, Node[]>(),
    observers: IntersectionObserver[] = [],
    animations = new Set<Animation>();
  const visibility = new Map<
    HTMLElement,
    { hidden: HTMLElement["hidden"]; nodeHidden: boolean }
  >();
  const motion = new Map<
    HTMLElement,
    { x: number; y: number; angle: number }
  >();
  const transformable = new Set<HTMLElement>();
  const motionFor = (el: HTMLElement) => {
    let value = motion.get(el);
    if (!value) {
      const style = getComputedStyle(el),
        [x, y] = style.translate.split(" ").map(Number.parseFloat);
      value = {
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
        angle: Number.parseFloat(style.rotate) || 0,
      };
      motion.set(el, value);
    }
    return value;
  };
  const remember = (el: HTMLElement) => {
    if (!styles.has(el)) {
      styles.set(el, el.getAttribute("style"));
      visibility.set(el, {
        hidden: el.hidden,
        nodeHidden: el.classList.contains("node-hidden"),
      });
    }
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const listen = (el: EventTarget, event: string, fn: EventListener) =>
    el.addEventListener(event, fn, { signal: lifetime.signal });
  function targetFor(script: LogicScript) {
    const el = root.querySelector<HTMLElement>(
      `[data-element-key="${CSS.escape(selectionKey(script.target as never, script.page))}"]`,
    );
    return el?.closest('[data-layer-deleted="true"]') ? null : el;
  }
  const pause = (seconds: number, signal: AbortSignal) =>
    new Promise<void>((resolve) => {
      if (signal.aborted) return resolve();
      const done = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(done, Math.min(5, Math.max(0, seconds)) * 1000);
      signal.addEventListener("abort", done, { once: true });
    });
  async function run(script: LogicScript, el: HTMLElement) {
    running.get(script.id)?.abort();
    const controller = new AbortController();
    running.set(script.id, controller);
    const signal = controller.signal,
      deadline = performance.now() + 30_000;
    let budget = 500,
      steps = 0;
    const execute = async (blocks: LogicBlock[], depth = 0): Promise<void> => {
      if (depth > 5) return;
      for (const b of blocks) {
        if (
          signal.aborted ||
          --budget < 0 ||
          performance.now() > deadline ||
          lifetime.signal.aborted
        )
          return;
        // Yield long chains so input/paint/cancellation can run between chunks.
        if (++steps % 32 === 0) {
          await pause(0.001, signal);
          if (signal.aborted) return;
        }
        remember(el);
        if (
          ["move", "rotate", "scale", "animate"].includes(b.op) &&
          !transformable.has(el)
        ) {
          // CSS transforms do not affect non-replaced inline text boxes.
          if (getComputedStyle(el).display === "inline")
            el.style.display = "inline-block";
          transformable.add(el);
        }
        const amount = Number.isFinite(b.amount) ? b.amount : 0;
        if (b.op === "wait") {
          await pause(b.duration, signal);
          continue;
        }
        if (b.op === "repeat") {
          for (
            let n = 0;
            n < Math.min(10, Math.max(1, Math.round(amount)));
            n++
          ) {
            await execute(b.children, depth + 1);
            if (signal.aborted) break;
          }
          continue;
        }
        if (b.op === "if-width" || b.op === "if-variable") {
          const pass =
            b.op === "if-width"
              ? (el.ownerDocument.defaultView?.innerWidth || innerWidth) <
                amount
              : (variables.get(b.value) || 0) >= amount;
          await execute(pass ? b.children : b.otherwise, depth + 1);
          continue;
        }
        if (b.op === "set-variable") variables.set(b.value, amount);
        else if (b.op === "add-variable")
          variables.set(
            b.value,
            Math.max(
              -1e6,
              Math.min(1e6, (variables.get(b.value) || 0) + amount),
            ),
          );
        else if (b.op === "move") {
          const value = motionFor(el);
          value.x = Math.max(-3000, Math.min(3000, value.x + amount));
          el.style.translate = `${value.x}px ${value.y}px`;
        } else if (b.op === "rotate") {
          const value = motionFor(el);
          value.angle = Math.max(-36000, Math.min(36000, value.angle + amount));
          el.style.rotate = `${value.angle}deg`;
        } else if (b.op === "scale")
          el.style.scale = String(Math.max(0.1, Math.min(3, amount / 100)));
        else if (b.op === "opacity")
          el.style.opacity = String(Math.max(0, Math.min(1, amount / 100)));
        else if (b.op === "show") {
          el.hidden = false;
          el.classList.remove("node-hidden");
          el.style.removeProperty("display");
        } else if (b.op === "hide") el.hidden = true;
        else if (b.op === "toggle") {
          const show = el.hidden || getComputedStyle(el).display === "none";
          el.hidden = !show;
          if (show) {
            el.classList.remove("node-hidden");
            el.style.removeProperty("display");
          }
        } else if (b.op === "color" && /^#[0-9a-f]{6}$/i.test(b.value))
          el.style.backgroundColor = b.value;
        else if (b.op === "text") {
          const textEl = el.matches(
            "[data-copy-key],[data-field],.node-text,.node-link",
          )
            ? el
            : el.querySelector<HTMLElement>(
                "[data-copy-key],[data-field],.node-text",
              );
          if (textEl) {
            if (!texts.has(textEl)) texts.set(textEl, [...textEl.childNodes]);
            textEl.textContent = b.value;
          }
        } else if (b.op === "link") {
          try {
            const url = new URL(b.value);
            if (url.protocol === "https:" && !url.username && !url.password)
              window.open(url.href, "_blank", "noopener,noreferrer");
          } catch {}
        } else if (b.op === "animate") {
          const frames: Record<string, Keyframe[]> = {
            fade: [{ opacity: 0 }, { opacity: 1 }],
            lift: [
              { translate: "0 12px", opacity: 0.4 },
              { translate: "0 0", opacity: 1 },
            ],
            pulse: [
              { scale: "1" },
              { scale: "1.06", offset: 0.5 },
              { scale: "1" },
            ],
            sway: [
              { rotate: "-2deg" },
              { rotate: "2deg", offset: 0.5 },
              { rotate: "0deg" },
            ],
          };
          const animation = el.animate(frames[b.value] || frames.fade, {
            duration: reduced ? 0 : Math.max(0.05, b.duration) * 1000,
            easing: "cubic-bezier(.16,1,.3,1)",
          });
          animations.add(animation);
          const cancel = () => animation.cancel();
          signal.addEventListener("abort", cancel, { once: true });
          await animation.finished.catch(() => {});
          animations.delete(animation);
          signal.removeEventListener("abort", cancel);
        }
      }
    };
    await execute(script.blocks);
    if (running.get(script.id) === controller) running.delete(script.id);
  }
  for (const script of scripts.slice(0, 24)) {
    if (!script.enabled) continue;
    const el = targetFor(script);
    if (!el) continue;
    const trigger = () => {
      void run(script, el);
    };
    if (script.event === "load")
      queueMicrotask(() => {
        if (!lifetime.signal.aborted) trigger();
      });
    else if (script.event === "visible") {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            trigger();
            observer.disconnect();
          }
        },
        { threshold: 0.15 },
      );
      observer.observe(el);
      observers.push(observer);
    } else if (script.event === "key")
      listen(el.ownerDocument, "keydown", ((e: KeyboardEvent) => {
        if (
          !(e.target as Element)?.closest(
            'input,textarea,select,[contenteditable="true"]',
          ) &&
          e.key.toLowerCase() === script.key.toLowerCase()
        )
          trigger();
      }) as EventListener);
    else
      listen(
        el,
        script.event === "hover"
          ? "pointerenter"
          : script.event === "leave"
            ? "pointerleave"
            : "click",
        trigger,
      );
  }
  return () => {
    lifetime.abort();
    running.forEach((c) => c.abort());
    animations.forEach((a) => a.cancel());
    observers.forEach((o) => o.disconnect());
    styles.forEach((style, el) => {
      if (style === null) el.removeAttribute("style");
      else el.setAttribute("style", style);
    });
    texts.forEach((nodes, el) => el.replaceChildren(...nodes));
    visibility.forEach((value, el) => {
      el.hidden = value.hidden;
      el.classList.toggle("node-hidden", value.nodeHidden);
    });
  };
}
