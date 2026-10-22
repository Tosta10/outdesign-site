import {
  families,
  normalizePreferences,
  itemAt,
  type LabItem,
  wrap,
  type LabMode,
} from "./state";
import { LabAudio } from "./audio";
import type { SceneState } from "./scene";
const live = new WeakMap<HTMLElement, () => void>();
const key = "outdesign.work-lab.preferences.v1",
  saveKey = "outdesign.work-lab.saved.v1";
export async function initWorkLab(root: HTMLElement): Promise<() => void> {
  live.get(root)?.();
  const abort = new AbortController(),
    audio = new LabAudio();
  const q = <T extends HTMLElement = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const stage = q(".lab-stage"),
    status = q("[data-lab-status]");
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let stored: unknown,
    saved: string[] = [];
  try {
    stored = JSON.parse(localStorage.getItem(key) || "null");
    const values = JSON.parse(localStorage.getItem(saveKey) || "[]");
    if (Array.isArray(values))
      saved = [
        ...new Set(
          values.filter(
            (i) => typeof i === "string" && /^[0-9a-f-]{36}$/i.test(i),
          ),
        ),
      ] as string[];
  } catch {
    /* Storage is optional. */
  }
  const allItems = JSON.parse(root.dataset.labItems || "[]") as LabItem[];
  const state: SceneState = {
    items: allItems,
    lane: 0,
    row: 0,
    mode: "detail",
    exploded: false,
    frosted: false,
    rotation: { x: 0.08, y: 0.12 },
    pan: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    zoom: 1,
    highlight: -1,
    wave: performance.now(),
    preferences: normalizePreferences(stored, media.matches),
  };
  let scene:
    | Awaited<ReturnType<(typeof import("./scene"))["createLabScene"]>>
    | undefined;
  let disposed = false,
    bootFrame = 0,
    coastFrame = 0,
    gamepadFrame = 0,
    gamepadLast = 0;
  const animations = new Set<Animation>();
  const text = (selector: string, value: string) => {
    const el = q(selector);
    if (el.textContent === value) return;
    el.getAnimations().forEach((a) => a.cancel());
    el.textContent = value;
    if (state.preferences.motion) {
      const animation = el.animate(
        [
          { opacity: 0.2, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
      animations.add(animation);
      void animation.finished
        .catch(() => {})
        .finally(() => animations.delete(animation));
    }
  };
  const log = (message: string) => {
    const el = document.createElement("li");
    el.textContent = `${new Date().toLocaleTimeString("zh-TW", { hour12: false })} / ${message}`;
    q("[data-lab-log]").prepend(el);
    while (q("[data-lab-log]").children.length > 12)
      q("[data-lab-log]").lastElementChild?.remove();
  };
  function persist() {
    try {
      localStorage.setItem(key, JSON.stringify(state.preferences));
      localStorage.setItem(saveKey, JSON.stringify(saved));
    } catch {
      status.textContent = "瀏覽器未允許儲存偏好，本次操作仍可繼續。";
    }
  }
  function sync() {
    const item = itemAt(state.items, state.row + state.lane);
    root.dataset.mode = state.mode;
    root.dataset.theme = state.preferences.theme;
    root.dataset.motion = String(state.preferences.motion);
    q(".lab-detail").hidden = state.mode === "browse";
    q(".lab-stage-back").hidden = state.mode === "browse";
    q(".lab-view-controls").hidden = state.mode === "browse";
    text("[data-lab-code]", item.code);
    text("[data-lab-title]", item.title);
    text("[data-lab-english]", item.english);
    text("[data-lab-description]", item.description);
    text("[data-lab-family]", item.empty ? "待新增" : families[item.family]);
    text("[data-lab-year]", item.year);
    const projectLink = q<HTMLAnchorElement>("[data-lab-project-link]");
    projectLink.hidden = !item.url;
    if (item.url) projectLink.href = item.url;
    else projectLink.removeAttribute("href");
    root.dataset.empty = String(item.empty);
    root
      .querySelectorAll<HTMLElement>("[data-lab-work-index]")
      .forEach((el) =>
        el.setAttribute(
          "aria-pressed",
          String(Number(el.dataset.labWorkIndex) === item.id),
        ),
      );
    const poster = q(".lab-poster");
    poster.querySelector("img")?.setAttribute("src", item.image);
    q<HTMLButtonElement>("[data-lab-action=save]").disabled = item.empty;
    q<HTMLButtonElement>("[data-lab-action=export]").disabled = item.empty;
    q("[data-lab-total]").textContent =
      `/ ${String(allItems.filter((i) => !i.empty).length).padStart(2, "0")}`;
    text("[data-lab-number]", String(item.id + 1).padStart(2, "0"));
    q("[data-lab-saved-count]").textContent = String(saved.length).padStart(
      2,
      "0",
    );
    q("[data-lab-action=save]").setAttribute(
      "aria-pressed",
      String(saved.includes(item.key)),
    );
    q("[data-lab-action=save]").textContent = saved.includes(item.key)
      ? "已收藏 ✓"
      : "收藏作品 ＋";
    q("[data-lab-action=explode]").setAttribute(
      "aria-pressed",
      String(state.exploded),
    );
    q("[data-lab-action=explode]").textContent = state.exploded
      ? "重組構件 −"
      : "拆解構件 ＋";
    q("[data-lab-action=glass]").setAttribute(
      "aria-pressed",
      String(state.frosted),
    );
    q("[data-lab-action=glass]").textContent = state.frosted
      ? "切換清晰"
      : "磨砂玻璃";
    root
      .querySelectorAll<HTMLElement>("[data-lab-family-index]")
      .forEach((el) =>
        el.setAttribute(
          "aria-pressed",
          String(
            Number(el.dataset.labFamilyIndex) ===
              Number(root.dataset.category || 0),
          ),
        ),
      );
    root
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "[data-lab-setting]",
      )
      .forEach((el) => {
        const v =
          state.preferences[
            el.dataset.labSetting as keyof typeof state.preferences
          ];
        if (el instanceof HTMLInputElement && el.type === "checkbox")
          el.checked = Boolean(v);
        else el.value = String(v);
      });
    scene?.invalidate();
  }
  function select(lane: number, row: number, open = false) {
    cancelAnimationFrame(coastFrame);
    state.offset = { x: 0, y: 0 };
    state.lane = Math.round(lane);
    state.row = Math.round(row);
    state.wave = performance.now();
    if (open) mode("detail");
    else sync();
    if (state.preferences.sound)
      audio.tick(itemAt(state.items, state.row + state.lane).id);
    status.textContent = `${itemAt(state.items, state.row + state.lane).title} · Enter 探索，方向鍵切換。`;
  }
  function mode(value: LabMode) {
    state.mode = value;
    if (value === "browse") {
      state.exploded = false;
      state.rotation = { x: 0.08, y: 0.12 };
      state.pan = { x: 0, y: 0 };
      state.highlight = -1;
    }
    log(
      value === "browse"
        ? "物件歸位"
        : value === "detail"
          ? "抽取物件，開始揭示"
          : "進入 360° 物件檢視",
    );
    sync();
    if (value === "browse") stage.focus({ preventScroll: true });
  }
  function tab(index: number) {
    root.querySelectorAll<HTMLElement>("[data-lab-tab]").forEach((el) => {
      const active = Number(el.dataset.labTab) === index;
      el.setAttribute("aria-selected", String(active));
      el.tabIndex = active ? 0 : -1;
    });
    root.querySelectorAll<HTMLElement>("[data-lab-tab-panel]").forEach((el) => {
      el.hidden = Number(el.dataset.labTabPanel) !== index;
    });
  }
  function search(onlySaved = false) {
    const dialog = q<HTMLDialogElement>("[data-lab-modal=search]");
    dialog.dataset.saved = String(onlySaved);
    q<HTMLInputElement>("[data-lab-search]").value = "";
    results();
    dialog.showModal();
  }
  function results() {
    const query = q<HTMLInputElement>("[data-lab-search]")
        .value.toLocaleLowerCase()
        .trim(),
      onlySaved = q("[data-lab-modal=search]").dataset.saved === "true";
    const entries = allItems.filter(
      (s) =>
        !s.empty &&
        (!onlySaved || saved.includes(s.key)) &&
        `${s.code} ${s.title} ${s.english} ${families[s.family]}`
          .toLocaleLowerCase()
          .includes(query),
    );
    q("[data-lab-results]").replaceChildren(
      ...entries.map((item) => {
        const button = document.createElement("button");
        button.dataset.labResult = String(item.id);
        const code = document.createElement("small"),
          name = document.createElement("span");
        code.textContent = item.code;
        name.textContent = item.title;
        button.append(code, name);
        return button;
      }),
    );
    q("[data-lab-search-status]").textContent = entries.length
      ? `${entries.length} 件${onlySaved ? "收藏" : "作品"}`
      : onlySaved
        ? "尚未收藏作品。探索後可按「收藏作品」。"
        : "找不到符合的物件。";
  }
  function skipBoot() {
    cancelAnimationFrame(bootFrame);
    q(".lab-boot").hidden = true;
    stage.focus({ preventScroll: true });
  }
  function boot() {
    cancelAnimationFrame(bootFrame);
    const overlay = q(".lab-boot");
    overlay.hidden = false;
    overlay.style.setProperty("--boot", "0");
    q("[data-lab-action=skip]").focus({ preventScroll: true });
    const start = performance.now();
    const frame = (now: number) => {
      if (disposed) return;
      const p = Math.min(
        1,
        (now - start) / (state.preferences.motion ? 3200 : 1),
      );
      overlay.style.setProperty("--boot", String(p));
      const message =
        p < 0.35
          ? "BUILDING GEOMETRY"
          : p < 0.7
            ? "CALIBRATING LIGHT"
            : "OBJECT SPACE / READY";
      q("[data-lab-boot-text]").textContent = message.slice(
        0,
        Math.max(1, Math.round(((p % 0.35) / 0.35) * 25)),
      );
      if (p < 1) bootFrame = requestAnimationFrame(frame);
      else skipBoot();
    };
    bootFrame = requestAnimationFrame(frame);
  }
  const click = (event: Event) => {
    const target = event.target as Element;
    if (target.closest("[data-lab-close]")) {
      target.closest("dialog")?.close();
      return;
    }
    const work = target.closest<HTMLElement>("[data-lab-work-index]");
    if (work) {
      state.items = allItems;
      root.dataset.category = "0";
      select(0, Number(work.dataset.labWorkIndex), true);
      return;
    }
    const family = target.closest<HTMLElement>("[data-lab-family-index]");
    if (family) {
      const selected = Number(family.dataset.labFamilyIndex);
      root.dataset.category = String(selected);
      const filtered = allItems.filter(
        (item) => selected === 0 || item.family === selected,
      );
      if (!filtered.length) {
        status.textContent = "此分類尚無作品。";
        return;
      }
      state.items = filtered;
      select(0, 0);
      return;
    }
    const result = target.closest<HTMLElement>("[data-lab-result]");
    if (result) {
      const id = Number(result.dataset.labResult);
      q<HTMLDialogElement>("[data-lab-modal=search]").close();
      state.items = allItems;
      root.dataset.category = "0";
      select(
        0,
        allItems.findIndex((item) => item.id === id),
        true,
      );
      return;
    }
    const selectedTab = target.closest<HTMLElement>("[data-lab-tab]");
    if (selectedTab) {
      tab(Number(selectedTab.dataset.labTab));
      return;
    }
    const part = target.closest<HTMLElement>("[data-lab-part]");
    if (part) {
      state.highlight = Number(part.dataset.labPart);
      state.exploded = true;
      mode("inspect");
      log(`檢視構件 ${part.textContent?.trim()}`);
      return;
    }
    const action =
      target.closest<HTMLElement>("[data-lab-action]")?.dataset.labAction;
    if (!action) return;
    switch (action) {
      case "open":
        mode("detail");
        break;
      case "inspect":
        mode("inspect");
        break;
      case "back":
        mode("browse");
        break;
      case "previous":
        select(state.lane, state.row - 1);
        break;
      case "next":
        select(state.lane, state.row + 1);
        break;
      case "search":
        search();
        break;
      case "saved":
        search(true);
        break;
      case "settings":
        q<HTMLDialogElement>("[data-lab-modal=settings]").showModal();
        break;
      case "save": {
        const id = itemAt(state.items, state.row + state.lane).key;
        saved = saved.includes(id)
          ? saved.filter((v) => v !== id)
          : [...saved, id];
        persist();
        sync();
        log(saved.includes(id) ? "物件已收藏" : "已移除收藏");
        break;
      }
      case "explode":
        state.exploded = !state.exploded;
        log(state.exploded ? "分層拆解" : "構件重組");
        sync();
        break;
      case "glass":
        state.frosted = !state.frosted;
        log(state.frosted ? "玻璃設為磨砂" : "玻璃設為清晰");
        sync();
        break;
      case "reset":
        state.rotation = { x: 0.08, y: 0.12 };
        state.pan = { x: 0, y: 0 };
        state.zoom = 1;
        state.highlight = -1;
        log("鏡頭已復位");
        sync();
        break;
      case "skip":
        skipBoot();
        break;
      case "replay":
        boot();
        break;
      case "fullscreen":
        if (document.fullscreenElement === root) void document.exitFullscreen();
        else
          void root.requestFullscreen?.().catch(() => {
            status.textContent = "此瀏覽器不支援全螢幕，仍可在頁面中探索。";
          });
        break;
      case "export": {
        const item = itemAt(state.items, state.row + state.lane),
          blob = new Blob(
            [
              `${item.code} / ${item.title}\n${item.english}\n\n${item.description}\n\nOutDesign — 作品資料。\n${q("[data-lab-log]").textContent}`,
            ],
            { type: "text/plain;charset=utf-8" },
          ),
          url = URL.createObjectURL(blob),
          link = document.createElement("a");
        link.href = url;
        link.download = `${item.code}.txt`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        log("已匯出作品資料");
        break;
      }
    }
  };
  root.addEventListener("click", click, { signal: abort.signal });
  root.addEventListener(
    "input",
    (e) => {
      if ((e.target as Element).matches("[data-lab-search]")) results();
    },
    { signal: abort.signal },
  );
  root.addEventListener(
    "change",
    (e) => {
      const input = e.target as HTMLInputElement;
      const setting = input.dataset.labSetting;
      if (!setting) return;
      state.preferences = normalizePreferences(
        {
          ...state.preferences,
          [setting]:
            input.type === "checkbox"
              ? input.checked
              : input.type === "range"
                ? Number(input.value)
                : input.value,
        },
        media.matches,
      );
      if (state.preferences.sound || state.preferences.ambient)
        void audio
          .enable(state.preferences.volume, state.preferences.ambient)
          .catch(() => {
            status.textContent = "音訊暫時不可用，可繼續視覺探索。";
          });
      else audio.pause();
      persist();
      sync();
    },
    { signal: abort.signal },
  );
  const keyboard = (e: KeyboardEvent) => {
    if (
      !root.isConnected ||
      !root.contains(document.activeElement) ||
      e.isComposing ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    )
      return;
    if ((e.target as Element)?.closest("input,textarea,select,dialog")) return;
    const tabButton = (e.target as Element).closest<HTMLElement>(
      "[data-lab-tab]",
    );
    if (
      tabButton &&
      ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
    ) {
      e.preventDefault();
      const index =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? 2
            : wrap(
                Number(tabButton.dataset.labTab) +
                  (e.key === "ArrowLeft" ? -1 : 1),
                3,
              );
      tab(index);
      q(`[data-lab-tab="${index}"]`).focus();
      return;
    }
    if (e.key === "/") {
      e.preventDefault();
      search();
      return;
    }
    if (e.key === "Escape") {
      if (!q(".lab-boot").hidden) skipBoot();
      else mode("browse");
      return;
    }
    if (e.key === "Enter" && e.target === stage) {
      e.preventDefault();
      mode(state.mode === "browse" ? "detail" : "inspect");
      return;
    }
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "+",
        "=",
        "-",
        "r",
        "R",
      ].includes(e.key)
    )
      return;
    e.preventDefault();
    if (state.mode === "browse") {
      select(
        state.lane +
          (e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0),
        state.row + (e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0),
      );
    } else {
      const step = e.shiftKey ? 0.2 : 0.08;
      if (e.key.startsWith("Arrow")) {
        state.pan.x +=
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        state.pan.y +=
          e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0;
      } else if (e.key.toLowerCase() === "r") {
        state.rotation = { x: 0.08, y: 0.12 };
        state.pan = { x: 0, y: 0 };
        state.zoom = 1;
      } else
        state.zoom = Math.max(
          0.65,
          Math.min(1.8, state.zoom + (e.key === "-" ? -0.1 : 0.1)),
        );
      sync();
    }
  };
  root.addEventListener("keydown", keyboard, { signal: abort.signal });
  let drag: {
    id: number;
    x: number;
    y: number;
    moved: boolean;
    rotation: { x: number; y: number };
    pan: { x: number; y: number };
    t: number;
    vx: number;
    vy: number;
    lastX: number;
    lastY: number;
    shift: boolean;
  } | null = null;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0,
    pinchZoom = 1;
  stage.addEventListener(
    "pointerdown",
    (e) => {
      if ((e.target as Element).closest("button") || e.button > 1) return;
      cancelAnimationFrame(coastFrame);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      stage.setPointerCapture(e.pointerId);
      stage.focus({ preventScroll: true });
      if (pointers.size === 2) {
        const p = [...pointers.values()];
        pinch = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        pinchZoom = state.zoom;
        return;
      }
      drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: false,
        rotation: { ...state.rotation },
        pan: { ...state.pan },
        t: performance.now(),
        vx: 0,
        vy: 0,
        shift: e.shiftKey || e.button === 1,
      };
      e.preventDefault();
    },
    { signal: abort.signal },
  );
  stage.addEventListener(
    "pointermove",
    (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const p = [...pointers.values()];
        state.zoom = Math.max(
          0.65,
          Math.min(
            1.8,
            (pinchZoom * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)) /
              Math.max(1, pinch),
          ),
        );
        sync();
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y,
        now = performance.now();
      drag.moved ||= Math.hypot(dx, dy) > 7;
      drag.vx = ((e.clientX - drag.lastX) / Math.max(8, now - drag.t)) * 1000;
      drag.vy = ((e.clientY - drag.lastY) / Math.max(8, now - drag.t)) * 1000;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.t = now;
      if (drag.moved) {
        if (state.mode === "browse")
          state.offset = { x: -dx / 110, y: -dy / 75 };
        else if (drag.shift)
          state.pan = {
            x: Math.max(-2, Math.min(2, drag.pan.x + dx / 180)),
            y: Math.max(-2, Math.min(2, drag.pan.y - dy / 180)),
          };
        else
          state.rotation = {
            x: Math.max(-1.3, Math.min(1.3, drag.rotation.x + dy / 180)),
            y: drag.rotation.y + dx / 160,
          };
        scene?.invalidate();
      }
    },
    { signal: abort.signal },
  );
  const endPointer = (e: PointerEvent, commit = true) => {
    pointers.delete(e.pointerId);
    if (pointers.size) {
      if (drag) drag.moved = true;
      return;
    }
    const d = drag;
    drag = null;
    if (!d) return;
    if (!commit) {
      state.offset = { x: 0, y: 0 };
      sync();
      return;
    }
    if (!d.moved) {
      scene?.pick(e.clientX, e.clientY, false);
      return;
    }
    if (state.mode === "browse") {
      let vx =
          state.preferences.motion && performance.now() - d.t < 80
            ? Math.max(-8, Math.min(8, -d.vx / 110))
            : 0,
        vy =
          state.preferences.motion && performance.now() - d.t < 80
            ? Math.max(-10, Math.min(10, -d.vy / 75))
            : 0,
        last = performance.now(),
        start = last;
      const coast = (now: number) => {
        const dt = Math.min(0.04, (now - last) / 1000);
        last = now;
        state.offset.x += vx * dt;
        state.offset.y += vy * dt;
        vx *= Math.exp(-dt * 7);
        vy *= Math.exp(-dt * 7);
        scene?.invalidate();
        if (now - start < 650 && Math.hypot(vx, vy) > 0.15)
          coastFrame = requestAnimationFrame(coast);
        else
          select(
            state.lane + Math.round(state.offset.x),
            state.row + Math.round(state.offset.y),
          );
      };
      coastFrame = requestAnimationFrame(coast);
    }
  };
  stage.addEventListener("pointerup", (e) => endPointer(e), {
    signal: abort.signal,
  });
  stage.addEventListener("pointercancel", (e) => endPointer(e, false), {
    signal: abort.signal,
  });
  stage.addEventListener(
    "dblclick",
    (e) => {
      if (!(e.target as Element).closest("button")) mode("detail");
    },
    { signal: abort.signal },
  );
  let wheelAt = 0;
  stage.addEventListener(
    "wheel",
    (e) => {
      if ((e.target as Element).closest("button")) return;
      e.preventDefault();
      if (state.mode !== "browse" || e.ctrlKey || e.altKey) {
        state.zoom = Math.max(
          0.65,
          Math.min(1.8, state.zoom * Math.exp(-e.deltaY * 0.001)),
        );
        sync();
      } else if (performance.now() - wheelAt > 180) {
        wheelAt = performance.now();
        select(
          state.lane + (e.shiftKey ? Math.sign(e.deltaY) : 0),
          state.row + (!e.shiftKey ? Math.sign(e.deltaY) : 0),
        );
      }
    },
    { passive: false, signal: abort.signal },
  );
  const clock = () => {
    if (!document.hidden)
      q("[data-lab-clock]").textContent = new Date().toLocaleTimeString(
        "en-GB",
        { hour12: false },
      );
  };
  const timer = setInterval(clock, 1000);
  clock();
  const gamepad = () => {
    if (disposed) return;
    const pad = navigator.getGamepads?.().find((p) => p?.connected);
    if (!pad) return;
    if (
      root.contains(document.activeElement) &&
      !root.querySelector("dialog[open]") &&
      !document.hidden &&
      performance.now() - gamepadLast > 200
    ) {
      const x = pad.axes[0] || 0,
        y = pad.axes[1] || 0;
      if (Math.abs(x) > 0.6 || Math.abs(y) > 0.6) {
        select(
          state.lane + (Math.abs(x) > 0.6 ? Math.sign(x) : 0),
          state.row + (Math.abs(y) > 0.6 ? Math.sign(y) : 0),
        );
        gamepadLast = performance.now();
      } else if (pad.buttons[0]?.pressed) {
        mode("detail");
        gamepadLast = performance.now();
      } else if (pad.buttons[1]?.pressed) {
        mode("browse");
        gamepadLast = performance.now();
      }
    }
    gamepadFrame = requestAnimationFrame(gamepad);
  };
  window.addEventListener(
    "gamepadconnected",
    () => {
      cancelAnimationFrame(gamepadFrame);
      gamepad();
    },
    { signal: abort.signal },
  );
  window.addEventListener(
    "blur",
    () => {
      drag = null;
      pointers.clear();
      state.offset = { x: 0, y: 0 };
      cancelAnimationFrame(coastFrame);
      scene?.invalidate();
    },
    { signal: abort.signal },
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) audio.pause();
      else if (state.preferences.ambient) audio.resume();
    },
    { signal: abort.signal },
  );
  media.addEventListener(
    "change",
    () => {
      if (media.matches) {
        state.preferences.motion = false;
        skipBoot();
        sync();
      }
    },
    { signal: abort.signal },
  );
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    abort.abort();
    clearInterval(timer);
    [bootFrame, coastFrame, gamepadFrame].forEach(cancelAnimationFrame);
    animations.forEach((a) => a.cancel());
    root
      .querySelectorAll<HTMLDialogElement>("dialog[open]")
      .forEach((d) => d.close());
    scene?.dispose();
    audio.dispose();
    live.delete(root);
  };
  live.set(root, dispose);
  sync();
  tab(0);
  try {
    const { createLabScene } = await import("./scene");
    if (disposed || !root.isConnected) {
      dispose();
      return dispose;
    }
    scene = createLabScene(stage, state, select, (value) => {
      root.style.setProperty("--lab-reveal", String(value));
      root.dataset.revealing = String(state.mode !== "browse" && value < 1);
    });
    q("[data-lab-render-status]").textContent = "WEBGL / LIVE";
    root.dataset.engine = "webgl";
    sync();
    if (state.preferences.motion) boot();
  } catch {
    root.dataset.engine = "fallback";
    stage.dataset.ready = "fallback";
    q("[data-lab-render-status]").textContent = "靜態預覽 / 互動索引可用";
    status.textContent =
      "此裝置無法建立 3D 場景。仍可搜尋、閱讀、收藏與匯出作品。";
    root.style.setProperty("--lab-reveal", "1");
  }
  return dispose;
}
