import { positionToVolume, volumeToPosition } from "./volume";
import { paintBoot } from "../boot-animation";
import { applySiteTheme, savedSiteTheme, setSiteTheme, type SiteTheme } from "../site-theme";
import { savedSiteMotion, setSiteMotion, isSiteMotion, type SiteMotion } from "../site-motion";
import { resolveWorkLabConfig, labActions } from "../../../supabase/functions/_shared/work-lab-config.ts";
import { patchLabConfig, takeLabCommands, type LabCommand } from "./bridge";
import {
  families,
  normalizePreferences,
  motionAllowed,
  type MotionKey,
  itemAtCell,
  archiveColumns,
  locateItem,
  type LabItem,
  wrap,
  type LabMode,
} from "./state";
import { ArchiveDrag, ArchivePlaneMomentum } from "./archive-drag";
import { SurfaceTransition } from "./ui-transitions";
import {
  createRollingNumber,
  createRollingText,
  type RollingTextController,
  type RollingNumberController,
} from "@kitlangton/rolling-number";
import "@kitlangton/rolling-number/styles.css";
import { LabAudio } from "./audio";
import type { SceneState } from "./scene";
const live = new WeakMap<HTMLElement, () => void>();
const key = "outdesign.work-lab.preferences.v2",
  saveKey = "outdesign.work-lab.saved.v1";
export async function initWorkLab(root: HTMLElement, { authoring = false } = {}): Promise<() => void> {
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
  const baseConfig = resolveWorkLabConfig(JSON.parse(root.dataset.labConfig || "null"));
  const configuredPreferences = (config: typeof baseConfig, visitor?: unknown) => {
    const local = !authoring && visitor && typeof visitor === "object" ? visitor as Record<string, unknown> : {};
    return normalizePreferences({ ...config.options, motion: true,
      sound: config.options.sound === "on", ambient: config.options.ambient === "on", volume: config.parameters.volume,
      ...local, ...(!authoring ? { motionPreset: savedSiteMotion() || local.motionPreset || config.options.motionPreset, theme: savedSiteTheme() || (local.theme === "dark" || local.theme === "light" ? local.theme : root.closest<HTMLElement>(".site")?.dataset.siteTheme || config.options.theme) } : {}), effects: { ...config.effects, ...(local.effects && typeof local.effects === "object" ? local.effects : {}) },
    }, media.matches);
  };
  const allItems = JSON.parse(root.dataset.labItems || "[]") as LabItem[];
  const state: SceneState = {
    pointerActive: false,
    navigationUntil: 0,
    navigationTime: 0,
    navigationVelocity: { lane: 0, row: 0 },
    config: baseConfig,
    authoring,
    items: allItems,
    track: null,
    pointer: { x: 0, y: 0 },
    lane: 0,
    row: 0,
    mode: "browse",
    exploded: false,
    frosted: baseConfig.options.glass === "frosted",
    rotation: { x: 0.08, y: 0.12 },
    pan: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    zoom: 1,
    highlight: -1,
    wave: performance.now(),
    waveDirection: { lane: 0, row: 1 },
    preferences: configuredPreferences(baseConfig, stored),
  };
  const initialPreferences = structuredClone(state.preferences);
  let scene:
    | Awaited<ReturnType<(typeof import("./scene"))["createLabScene"]>>
    | undefined;
  let disposed = false,
    bootFrame = 0,
    coastFrame = 0,
    gamepadFrame = 0,
    gamepadLast = 0;
  const animations = new Set<Animation>();
  const rollingText = new Map<string, RollingTextController>();
  const rollingNumbers = new Map<string, RollingNumberController>();
  for (const selector of [
    "[data-lab-browse-code]",
    "[data-lab-browse-title]",
    "[data-lab-browse-category]",
    "[data-lab-column-label]",
    "[data-lab-column-number]",
  ]) {
    const element = q(selector);
    rollingText.set(
      selector,
      createRollingText(element, {
        text: element.textContent || "",
        duration: baseConfig.parameters.transitionDuration * 1000,
        motionBlur: true,
        transition: "direct",
        stagger: "none",
        animated: motionAllowed(state.preferences, "rollingText"),
      }),
    );
  }
  rollingNumbers.set(
    "[data-lab-number]",
    createRollingNumber(q("[data-lab-number]"), {
      value: 1,
      locales: "en-US",
      format: { minimumIntegerDigits: 2, useGrouping: false },
      duration: baseConfig.parameters.transitionDuration * 1000,
      motionBlur: true,
      animated: motionAllowed(state.preferences, "rollingText"),
    }),
  );
  let rollingDirection: "up" | "down" = "up";
  const text = (selector: string, value: string) => {
    const reel = rollingText.get(selector);
    if (reel) {
      reel.update({
        text: value,
        duration: state.config.parameters.transitionDuration * 1000,
        animated: motionAllowed(state.preferences, "rollingText"),
        direction: rollingDirection,
      });
      return;
    }
    const number = rollingNumbers.get(selector);
    if (number) {
      number.update({
        value: Number(value),
        duration: state.config.parameters.transitionDuration * 1000,
        animated: motionAllowed(state.preferences, "rollingNumbers"),
        direction: rollingDirection,
      });
      return;
    }
    const element = q(selector);
    if (element.textContent !== value) element.textContent = value;
  };
  const surfaces = new Map<HTMLElement, SurfaceTransition>();
  for (const element of root.querySelectorAll<HTMLElement>(
    ".lab-browse-info,.lab-detail",
  ))
    surfaces.set(element, new SurfaceTransition(element, element, 700, 240));
  const modalSurfaces = new Map<HTMLDialogElement, SurfaceTransition>();
  for (const dialog of root.querySelectorAll<HTMLDialogElement>(".lab-modal"))
    modalSurfaces.set(dialog, new SurfaceTransition(dialog, dialog, 300, 200));
  function showModal(dialog: HTMLDialogElement) {
    if (!dialog.open) dialog.showModal();
    modalSurfaces
      .get(dialog)
      ?.show(!motionAllowed(state.preferences, "surfaceTransitions"));
  }
  function closeModal(dialog: HTMLDialogElement) {
    modalSurfaces
      .get(dialog)
      ?.hide(!motionAllowed(state.preferences, "surfaceTransitions"), () =>
        dialog.close(),
      );
  }
  let displayedMode: LabMode | undefined;
  let ticksSignature = "";
  const columnMemory = new Map<string, number>();
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
  function syncAudio() {
    if (authoring) return;
    if (state.preferences.sound || state.preferences.ambient)
      void audio.enable(state.preferences.volume, state.preferences.ambient).catch(() => {});
    else audio.pause();
  }
  root.addEventListener("pointerdown", syncAudio, { signal: abort.signal });
  root.addEventListener("keydown", syncAudio, { signal: abort.signal });
  const originalLabels = new Map<string, string>();
  function buttonLabel(selector: string, active: boolean, alternate: string) {
    if (authoring) return;
    const button = q(selector), label = button.querySelector<HTMLElement>("[data-copy-key]") || button;
    if (!originalLabels.has(selector)) originalLabels.set(selector, label.textContent || "");
    label.textContent = active ? alternate : originalLabels.get(selector)!;
  }
  function sync() {
    root.style.setProperty("--lab-cover-scale", String(state.config.parameters.coverScale));
    root.style.setProperty("--lab-cassette-color", state.preferences.theme === "dark" ? state.config.palette.darkShell : state.config.palette.shell);
    root.dataset.labRuntimeConfig = JSON.stringify(state.config);
    const item = itemAtCell(state.items, state.lane, state.row);
    root.dataset.mode = state.mode;
    root.dataset.lane = String(state.lane);
    root.dataset.row = String(state.row);
    const columns = archiveColumns(state.items);
    const column = columns[wrap(state.lane, columns.length)];
    text("[data-lab-browse-code]", item.code);
    text("[data-lab-browse-title]", item.title);
    text("[data-lab-browse-category]", column.label);
    text("[data-lab-column-label]", column.label);
    text(
      "[data-lab-column-number]",
      `COLUMN ${String(wrap(state.lane, columns.length) + 1).padStart(2, "0")} / ${String(columns.length).padStart(2, "0")}`,
    );
    root.dataset.theme = state.preferences.theme;
    if (!authoring) applySiteTheme(root, state.preferences.theme);
    root.dataset.motion = String(state.preferences.motion);
    if (displayedMode !== state.mode) {
      const detailPanel = q(".lab-detail"),
        browsePanel = q(".lab-browse-info");
      if (state.mode === "browse") {
        surfaces
          .get(detailPanel)
          ?.hide(!motionAllowed(state.preferences, "surfaceTransitions"));
        surfaces
          .get(browsePanel)
          ?.show(!motionAllowed(state.preferences, "surfaceTransitions"));
      } else {
        surfaces
          .get(browsePanel)
          ?.hide(!motionAllowed(state.preferences, "surfaceTransitions"));
        surfaces
          .get(detailPanel)
          ?.show(!motionAllowed(state.preferences, "surfaceTransitions"));
      }
      displayedMode = state.mode;
    }
    const signature = column.items.map((item) => item.key).join(":");
    if (ticksSignature !== signature) {
      ticksSignature = signature;
      q("[data-lab-ticks]").replaceChildren(
        ...column.items.map((entry, index) => {
          const button = document.createElement("button");
          button.dataset.labTick = String(index);
          button.setAttribute(
            "aria-label",
            `選擇作品 ${entry.code} ${entry.title}`,
          );
          button.title = `${entry.code} · ${entry.title}`;
          return button;
        }),
      );
    }
    root
      .querySelectorAll<HTMLElement>("[data-lab-tick]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(
            Number(button.dataset.labTick) ===
              wrap(state.row, column.items.length),
          ),
        ),
      );
    q(".lab-stage-back").hidden = state.mode !== "detail";
    q("[data-lab-inspection]").hidden = state.mode !== "inspect";
    q("[data-lab-viewer-code]").textContent = item.code;
    q('[data-lab-action="clear"]').setAttribute(
      "aria-pressed",
      String(!state.frosted),
    );
    q('[data-lab-action="frosted"]').setAttribute(
      "aria-pressed",
      String(state.frosted),
    );
    if (state.mode === "inspect" && !authoring) {
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
    } else {
      root.removeAttribute("role");
      root.removeAttribute("aria-modal");
    }
    q(".lab-view-controls").hidden = state.mode === "browse";
    text("[data-lab-code]", item.code);
    text("[data-lab-object-code]", item.code);
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
    let posterImage = poster.querySelector("img");
    if (item.image) {
      if (!posterImage) {
        posterImage = document.createElement("img");
        posterImage.alt = "";
        poster.querySelector(".lab-illustrated-case")!.append(posterImage);
      }
      if (posterImage.getAttribute("src") !== item.image)
        posterImage.src = item.image;
      const placeholder = poster.querySelector<HTMLElement>(
        ".lab-poster-placeholder",
      );
      if (placeholder) placeholder.hidden = true;
    } else {
      posterImage?.remove();
      const placeholder = poster.querySelector<HTMLElement>(
        ".lab-poster-placeholder",
      );
      if (placeholder) placeholder.hidden = false;
    }
    q<HTMLButtonElement>("[data-lab-action=save]").disabled = item.empty;
    q<HTMLButtonElement>("[data-lab-action=export]").disabled = item.empty;
    q("[data-lab-total]").textContent = String(
      column.items.filter((i) => !i.empty).length,
    ).padStart(2, "0");
    text(
      "[data-lab-number]",
      String(wrap(state.row, column.items.length) + 1).padStart(2, "0"),
    );
    q("[data-lab-saved-count]").textContent = String(saved.length).padStart(
      2,
      "0",
    );
    q("[data-lab-action=save]").setAttribute(
      "aria-pressed",
      String(saved.includes(item.key)),
    );
    buttonLabel("[data-lab-action=save]", saved.includes(item.key), "已收藏 ✓");
    q("[data-lab-action=explode]").setAttribute(
      "aria-pressed",
      String(state.exploded),
    );
    buttonLabel("[data-lab-action=explode]", state.exploded, "重組構件 −");
    q("[data-lab-action=glass]").setAttribute(
      "aria-pressed",
      String(state.frosted),
    );
    buttonLabel("[data-lab-action=glass]", state.frosted, "切換清晰");
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
        else el.value = el.dataset.labSetting === "volume" ? String(volumeToPosition(Number(v))) : String(v);
      });
    const volumeLabel = `${Math.round(state.preferences.volume / .3 * 10) / 10}×`;
    q('[data-lab-volume-value]').textContent = volumeLabel;
    q('[data-lab-setting="volume"]').setAttribute('aria-valuetext', volumeLabel);
    root.querySelectorAll<HTMLElement>('[data-lab-volume-preset]').forEach(button => button.setAttribute('aria-pressed', String(Math.abs(Number(button.dataset.labVolumePreset) - state.preferences.volume) < .01)));
    root
      .querySelectorAll<HTMLInputElement>("[data-lab-effect]")
      .forEach(
        (input) =>
          (input.checked =
            state.preferences.effects[input.dataset.labEffect as MotionKey]),
      );
    scene?.invalidate();
  }
  let lastNavigation = -Infinity;
  function select(lane: number, row: number, open = false, repeat = false) {
    const now = performance.now();
    const interval = (now - lastNavigation) / 1000;
    const direction = { lane: lane - state.lane, row: row - state.row };
    if (!open && (repeat || interval > .008 && interval < .14)) {
      const period = Math.max(.016, Math.min(.2, repeat && interval > .3 ? 1 / 30 : interval));
      const gain = now < state.navigationUntil ? .65 : 1;
      for (const axis of ["lane", "row"] as const) {
        const velocity = Math.max(-60, Math.min(60, direction[axis] / period));
        state.navigationVelocity[axis] += (velocity - state.navigationVelocity[axis]) * gain;
      }
      state.navigationUntil = now + Math.max(150, period * 2500);
    } else {
      state.navigationVelocity = { lane: 0, row: 0 };
      state.navigationUntil = 0;
    }
    state.navigationTime = now;
    lastNavigation = now;
    cancelAnimationFrame(coastFrame);
    rollingDirection = (row !== state.row ? row > state.row : lane > state.lane)
      ? "up"
      : "down";
    state.track = null;
    state.waveDirection = { lane: lane - state.lane, row: row - state.row };
    state.offset = { x: 0, y: 0 };
    state.lane = Math.round(lane);
    state.row = Math.round(row);
    state.wave = performance.now();
    if (open) mode("detail");
    else sync();
    if (state.preferences.sound)
      audio.tick(itemAtCell(state.items, state.lane, state.row).id);
    status.textContent = `${itemAtCell(state.items, state.lane, state.row).title} · Enter 探索，方向鍵切換。`;
  }
  function stepColumn(direction: number, repeat = false) {
    const columns = archiveColumns(state.items),
      previous = columns[wrap(state.lane, columns.length)];
    columnMemory.set(previous.label, state.row);
    const lane = state.lane + direction,
      next = columns[wrap(lane, columns.length)];
    const remembered = columnMemory.get(next.label) ?? 0;
    const row =
      remembered +
      Math.round((state.row - remembered) / next.items.length) *
        next.items.length;
    select(lane, row, false, repeat);
  }
  function navigatePlane(coordinate: { lane: number; row: number }) {
    const previous = state.track ?? { lane: state.lane, row: state.row };
    state.waveDirection = { lane: coordinate.lane - previous.lane, row: coordinate.row - previous.row };
    state.track = coordinate;
    state.wave = performance.now();
    const lane = Math.round(coordinate.lane),
      row = Math.round(coordinate.row);
    if (lane !== state.lane || row !== state.row) {
      rollingDirection = (
        row !== state.row ? row > state.row : lane > state.lane
      )
        ? "up"
        : "down";
      state.lane = lane;
      state.row = row;
      state.wave = performance.now();
      sync();
    } else scene?.invalidate();
  }
  function mode(value: LabMode) {
    state.navigationUntil = 0;
    state.navigationVelocity = { lane: 0, row: 0 };
    if (state.mode === "inspect" && value !== "inspect") {
      state.exploded = false;
      state.frosted = false;
      state.highlight = -1;
    }
    cancelAnimationFrame(coastFrame);
    state.track = null;
    state.mode = value;
    root.dataset.navigation = "idle";
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
    if (!authoring && (value === "browse" || value === "inspect"))
      stage.focus({ preventScroll: true });
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
    dialog.dataset.family = "0";
    q("#od-lab-search-title").textContent = onlySaved
      ? "SAVED ARCHIVES / 收藏作品"
      : "ARCHIVE INDEX / 作品索引";
    dialog
      .querySelectorAll<HTMLElement>("[data-lab-family-index]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.labFamilyIndex === "0"),
        ),
      );
    q<HTMLInputElement>("[data-lab-search]").value = "";
    results();
    showModal(dialog);
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
        (Number(q("[data-lab-modal=search]").dataset.family || 0) === 0 ||
          s.family === Number(q("[data-lab-modal=search]").dataset.family)) &&
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
        const category = document.createElement("span"),
          access = document.createElement("span");
        category.textContent = item.category;
        access.textContent = "OPEN ↗";
        button.append(code, name, category, access);
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
    if (!authoring) stage.focus({ preventScroll: true });
  }
  function boot() {
    cancelAnimationFrame(bootFrame);
    const overlay = q(".lab-boot");
    overlay.hidden = false;
    overlay.style.setProperty("--boot", "0");
    overlay.tabIndex = -1;
    overlay.focus({ preventScroll: true });
    const start = performance.now();
    const frame = (now: number) => {
      if (disposed) return;
      const p = Math.min(
        1,
        (now - start) / (motionAllowed(state.preferences, "boot") ? state.config.parameters.bootDuration * 1000 : 1),
      );
      paintBoot(overlay, p);
      if (p < 1) bootFrame = requestAnimationFrame(frame);
      else skipBoot();
    };
    bootFrame = requestAnimationFrame(frame);
  }
  const click = (event: Event) => {
    if (authoring) return;
    const target = event.target as Element;
    const volumePreset = target.closest<HTMLElement>('[data-lab-volume-preset]');
    if (volumePreset) {
      state.preferences.volume = Number(volumePreset.dataset.labVolumePreset);
      syncAudio(); persist(); sync();
      return;
    }
    if (target.closest("[data-lab-close]")) {
      const dialog = target.closest<HTMLDialogElement>("dialog");
      if (dialog) closeModal(dialog);
      return;
    }
    const tick = target.closest<HTMLElement>("[data-lab-tick]");
    if (tick) {
      const count = archiveColumns(state.items)[
        wrap(state.lane, archiveColumns(state.items).length)
      ].items.length;
      const row =
        Number(tick.dataset.labTick) +
        Math.round((state.row - Number(tick.dataset.labTick)) / count) * count;
      select(state.lane, row);
      return;
    }
    const work = target.closest<HTMLElement>("[data-lab-work-index]");
    if (work) {
      state.items = allItems;
      root.dataset.category = "0";
      const cell = locateItem(
        allItems,
        allItems[Number(work.dataset.labWorkIndex)].key,
      );
      select(cell.lane, cell.row, true);
      return;
    }
    const family = target.closest<HTMLElement>("[data-lab-family-index]");
    if (family) {
      const selected = Number(family.dataset.labFamilyIndex);
      const dialog = family.closest<HTMLDialogElement>("dialog");
      if (dialog) {
        dialog.dataset.family = String(selected);
        dialog
          .querySelectorAll<HTMLElement>("[data-lab-family-index]")
          .forEach((button) =>
            button.setAttribute(
              "aria-pressed",
              String(Number(button.dataset.labFamilyIndex) === selected),
            ),
          );
        results();
        return;
      }
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
      const cell = locateItem(
        allItems,
        allItems.find((item) => item.id === id)!.key,
      );
      select(cell.lane, cell.row, true);
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
      case "close-inspect":
        mode("detail");
        q('[data-lab-action="inspect"]').focus({ preventScroll: true });
        break;
      case "clear":
        state.frosted = false;
        sync();
        break;
      case "frosted":
        state.frosted = true;
        sync();
        break;
      case "assemble":
        state.exploded = false;
        sync();
        break;
      case "inspect":
        mode("inspect");
        break;
      case "back":
        mode("browse");
        break;
      case "previous-column":
        stepColumn(-1);
        break;
      case "next-column":
        stepColumn(1);
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
        showModal(q<HTMLDialogElement>("[data-lab-modal=settings]"));
        break;
      case "save": {
        const id = itemAtCell(state.items, state.lane, state.row).key;
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
        if (state.mode === "inspect") scene?.resetViewer();
        state.rotation = { x: 0.08, y: 0.12 };
        state.pan = { x: 0, y: 0 };
        state.zoom = 1;
        state.highlight = -1;
        log("鏡頭已復位");
        sync();
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
        const item = itemAtCell(state.items, state.lane, state.row),
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
      if (input.dataset.labEffect) {
        state.preferences.effects[input.dataset.labEffect as MotionKey] =
          input.checked;
        persist();
        sync();
        return;
      }
      const setting = input.dataset.labSetting;
      if (!setting) return;
      state.preferences = normalizePreferences(
        {
          ...state.preferences,
          ...(setting === "motion"
            ? { motionPreset: input.checked ? "full" : "reduced" }
            : {}),
          [setting]:
            input.type === "checkbox"
              ? input.checked
              : input.type === "range"
                ? setting === "volume" ? positionToVolume(Number(input.value)) : Number(input.value)
                : input.value,
        },
        media.matches,
      );
      if (setting === "theme") setSiteTheme(state.preferences.theme);
      if (!authoring && (setting === "motionPreset" || setting === "motion")) setSiteMotion(state.preferences.motionPreset);
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
    if (authoring) return;
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
      else mode(state.mode === "inspect" ? "detail" : "browse");
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
      if (e.key === "ArrowLeft" || e.key === "ArrowRight")
        stepColumn(e.key === "ArrowLeft" ? -1 : 1, e.repeat);
      else
        select(
          state.lane,
          state.row +
            (e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0),
          false,
          e.repeat,
        );
    } else {
      if (state.mode === "inspect") {
        scene?.viewerKey(e.key);
        return;
      }
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
  root.addEventListener("keyup", event => {
    if (event.key.startsWith("Arrow")) {
      state.navigationUntil = 0;
      state.navigationVelocity = { lane: 0, row: 0 };
      scene?.invalidate();
    }
  }, { signal: abort.signal });
  const archiveDrag = new ArchiveDrag();
  let drag: {
    id: number;
    x: number;
    y: number;
    moved: boolean;
    rotation: { x: number; y: number };
    pan: { x: number; y: number };
    shift: boolean;
    start: { lane: number; row: number };
  } | null = null;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0,
    pinchZoom = 1;
  stage.addEventListener(
    "pointerdown",
    (event) => {
      if (authoring) return;
      if (state.mode === "inspect" && event.target instanceof HTMLCanvasElement)
        return;
      if ((event.target as Element).closest("button") || event.button > 1)
        return;
      state.pointerActive = true;
      cancelAnimationFrame(coastFrame);
      scene?.clearHover();
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      stage.setPointerCapture(event.pointerId);
      stage.focus({ preventScroll: true });
      if (pointers.size === 2) {
        const points = [...pointers.values()];
        pinch = Math.hypot(
          points[0].x - points[1].x,
          points[0].y - points[1].y,
        );
        pinchZoom = state.zoom;
        if (drag) drag.moved = true;
        state.track = null;
        return;
      }
      const start = scene?.position() ?? { lane: state.lane, row: state.row };
      archiveDrag.start(
        event.clientX,
        event.clientY,
        scene?.projection() ?? {
          lane: { x: -110, y: 0 },
          row: { x: 0, y: -75 },
        },
        event.timeStamp,
      );
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: false,
        rotation: { ...state.rotation },
        pan: { ...state.pan },
        shift: event.shiftKey || event.button === 1,
        start,
      };
      event.preventDefault();
    },
    { signal: abort.signal },
  );
  stage.addEventListener(
    "pointermove",
    (event) => {
      if (authoring) return;
      if (!pointers.has(event.pointerId)) {
        if (event.pointerType === "mouse" && !drag) {
          const hovered = scene?.hover(event.clientX, event.clientY);
          const label = q("[data-lab-hover]");
          label.hidden = !hovered;
          if (hovered) label.textContent = `${hovered.code} / ${hovered.title}`;
        }
        return;
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        if (state.mode === "browse") return;
        const points = [...pointers.values()];
        state.zoom = Math.max(
          0.65,
          Math.min(
            1.8,
            (pinchZoom *
              Math.hypot(
                points[0].x - points[1].x,
                points[0].y - points[1].y,
              )) /
              Math.max(1, pinch),
          ),
        );
        sync();
        return;
      }
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x,
        dy = event.clientY - drag.y;
      drag.moved ||= Math.hypot(dx, dy) > 7;
      if (state.mode === "browse") {
        for (const sample of event.getCoalescedEvents?.() ?? [])
          archiveDrag.move(sample.clientX, sample.clientY, sample.timeStamp);
        archiveDrag.move(event.clientX, event.clientY, event.timeStamp);
        if (archiveDrag.active)
          navigatePlane({
            lane: drag.start.lane + archiveDrag.value.lane,
            row: drag.start.row + archiveDrag.value.row,
          });
      } else if (drag.moved) {
        if (drag.shift)
          state.pan = {
            x: Math.max(-2, Math.min(2, drag.pan.x + dx / 180)),
            y: Math.max(-2, Math.min(2, drag.pan.y - dy / 180)),
          };
        else
          state.rotation = {
            x: Math.max(-1.3, Math.min(1.3, drag.rotation.x + dy / 180)),
            y: Math.max(-0.8, Math.min(0.8, drag.rotation.y + dx / 250)),
          };
        scene?.invalidate();
      }
    },
    { signal: abort.signal },
  );
  const endPointer = (event: PointerEvent, commit = true) => {
    pointers.delete(event.pointerId);
    if (pointers.size) {
      if (drag) drag.moved = true;
      return;
    }
    state.pointerActive = false;
    const previous = drag;
    drag = null;
    if (!previous) return;
    if (!commit) {
      state.track = null;
      sync();
      return;
    }
    if (!previous.moved) {
      scene?.pick(event.clientX, event.clientY, false);
      return;
    }
    if (state.mode !== "browse") return;
    const position = state.track ??
      scene?.position() ?? { lane: state.lane, row: state.row };
    const velocity = archiveDrag.releaseVelocity(
      event.timeStamp,
      !motionAllowed(state.preferences, "dragMomentum"),
    );
    const momentum = new ArchivePlaneMomentum(position, velocity, state.config.parameters.inertia, state.config.parameters.snapSpeed);
    let last = performance.now();
    const coast = (now: number) => {
      momentum.step(Math.min(1, Math.max(0, (now - last) / 1000)));
      last = now;
      navigatePlane(momentum.value);
      root.dataset.navigation = momentum.phase;
      if (momentum.phase !== "idle") coastFrame = requestAnimationFrame(coast);
      else {
        state.track = null;
        select(Math.round(momentum.value.lane), Math.round(momentum.value.row));
        root.dataset.navigation = "idle";
      }
    };
    coastFrame = requestAnimationFrame(coast);
  };
  stage.addEventListener("pointerup", (event) => endPointer(event), {
    signal: abort.signal,
  });
  stage.addEventListener("pointercancel", (event) => endPointer(event, false), {
    signal: abort.signal,
  });
  stage.addEventListener(
    "pointerleave",
    () => {
      scene?.clearHover();
      q("[data-lab-hover]").hidden = true;
    },
    { signal: abort.signal },
  );
  stage.addEventListener(
    "dblclick",
    (event) => {
      if (authoring) return;
      if (!(event.target as Element).closest("button")) mode("detail");
    },
    { signal: abort.signal },
  );
  let wheelAt = 0,
    wheelTotal = 0,
    wheelAxis = "row";
  stage.addEventListener(
    "wheel",
    (event) => {
      if (authoring) return;
      if (state.mode === "inspect") return;
      if ((event.target as Element).closest("button")) return;
      event.preventDefault();
      if (state.mode !== "browse" || event.ctrlKey || event.altKey) {
        state.zoom = Math.max(
          0.65,
          Math.min(1.8, state.zoom * Math.exp(-event.deltaY * 0.001)),
        );
        sync();
        return;
      }
      if (drag) return;
      const axis =
        event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? "lane"
          : "row";
      const delta = Math.max(
        -300,
        Math.min(
          300,
          (axis === "lane" ? event.deltaX || event.deltaY : event.deltaY) *
            (event.deltaMode === 1
              ? 40
              : event.deltaMode === 2
                ? stage.clientHeight
                : 1),
        ),
      );
      const now = performance.now();
      if (
        now - wheelAt > 180 ||
        Math.sign(delta) !== Math.sign(wheelTotal) ||
        wheelAxis !== axis
      )
        wheelTotal = 0;
      wheelAt = now;
      wheelAxis = axis;
      wheelTotal += delta;
      const steps = Math.min(3, Math.floor(Math.abs(wheelTotal) / 100));
      if (!steps) return;
      const direction = Math.sign(wheelTotal);
      wheelTotal -= direction * steps * 100;
      for (let i = 0; i < steps; i++) {
        if (axis === "lane") stepColumn(direction);
        else select(state.lane, state.row + direction);
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
    if (disposed || authoring) return;
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
      state.pointerActive = false;
      state.offset = { x: 0, y: 0 };
      state.track = null;
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
      state.preferences = normalizePreferences({ ...state.preferences, motion: true }, media.matches);
      if (!state.preferences.motion) skipBoot();
      sync();
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
    rollingText.forEach((reel) => reel.destroy());
    rollingNumbers.forEach((reel) => reel.destroy());
    surfaces.forEach((surface) => surface.dispose());
    modalSurfaces.forEach((surface) => surface.dispose());
    root
      .querySelectorAll<HTMLDialogElement>("dialog[open]")
      .forEach((d) => d.close());
    scene?.dispose();
    audio.dispose();
    delete root.dataset.labController;
    live.delete(root);
  };
  function command(command: LabCommand) {
    if (command.type === "view" && authoring) { skipBoot(); mode(command.value); return; }
    if (command.type === "action" && Object.hasOwn(labActions, command.value)) {
      if (command.value === "next") select(state.lane, state.row + 1);
      else if (command.value === "previous") select(state.lane, state.row - 1);
      else if (command.value === "next-column") stepColumn(1);
      else if (command.value === "previous-column") stepColumn(-1);
      else if (command.value === "open") mode("detail");
      else if (command.value === "back") mode("browse");
      else if (command.value === "inspect") mode("inspect");
      else if (command.value === "explode") { state.exploded = !state.exploded; sync(); }
      else if (command.value === "assemble") { state.exploded = false; sync(); }
      else if (command.value === "glass") { state.frosted = !state.frosted; sync(); }
      else if (command.value === "clear" || command.value === "frosted") { state.frosted = command.value === "frosted"; sync(); }
      else if (command.value === "replay") boot();
      else if (command.value === "reset") { scene?.resetViewer(); state.rotation = { x: .08, y: .12 }; state.pan = { x: 0, y: 0 }; state.zoom = 1; sync(); }
      return;
    }
    const previous = state.config;
    state.config = command.type === "reset-config" ? baseConfig : patchLabConfig(state.config, command);
    if (previous === state.config) return;
    if (command.type === "reset-config" || command.type === "config") {
      state.preferences = command.type === "reset-config" ? structuredClone(initialPreferences) : configuredPreferences(state.config);
      state.frosted = state.config.options.glass === "frosted";
    } else if (command.type === "effect") {
      state.preferences.effects = { ...state.preferences.effects, [command.key]: state.config.effects[command.key as MotionKey] };
    } else if (command.type === "parameter" && command.key === "volume") {
      state.preferences.volume = state.config.parameters.volume;
    } else if (command.type === "option") {
      if (command.key === "glass") state.frosted = state.config.options.glass === "frosted";
      else {
        const options = state.config.options;
        const value = options[command.key as keyof typeof options];
        state.preferences = normalizePreferences({ ...state.preferences,
          ...(command.key === "motionPreset" ? { motion: true } : {}),
          [command.key]: command.key === "sound" || command.key === "ambient" ? value === "on" : value,
        }, media.matches);
      }
    }
    // Settings changed through blocks are scoped to this runtime, not visitor storage.
    if (navigator.userActivation?.hasBeenActive && (command.type === "config" || command.type === "reset-config" ||
      command.type === "option" && ["sound", "ambient"].includes(command.key) || command.type === "parameter" && command.key === "volume")) syncAudio();
    if (!state.preferences.motion || !state.preferences.effects.boot) skipBoot();
    sync();
  }
  root.addEventListener("outdesign:lab-command", ((event: CustomEvent<LabCommand>) => command(event.detail)) as EventListener, { signal: abort.signal });
  root.addEventListener("outdesign:lab-settings", () => showModal(q<HTMLDialogElement>("[data-lab-modal=settings]")), { signal: abort.signal });
  root.dataset.labController = "ready";
  document.addEventListener("outdesign:site-motion", ((event: CustomEvent<SiteMotion>) => {
    if (authoring || !isSiteMotion(event.detail)) return;
    state.preferences = normalizePreferences({ ...state.preferences, motion: true, motionPreset: event.detail }, media.matches);
    if (!state.preferences.motion) skipBoot();
    persist();
    sync();
  }) as EventListener, { signal: abort.signal });
  document.addEventListener("outdesign:site-theme", ((event: CustomEvent<SiteTheme>) => {
    if (authoring || !["light", "dark"].includes(event.detail)) return;
    state.preferences.theme = event.detail;
    sync();
  }) as EventListener, { signal: abort.signal });
  live.set(root, dispose);
  sync();
  tab(0);
  if (!authoring) stage.focus({ preventScroll: true });
  try {
    const { createLabScene } = await import("./scene");
    if (disposed || !root.isConnected) {
      dispose();
      return dispose;
    }
    scene = createLabScene(stage, state, select, (value) => {
      root.style.setProperty(
        "--lab-reveal",
        String(motionAllowed(state.preferences, "documentReveal") ? value : 1),
      );
      root.dataset.revealing = String(
        state.mode !== "browse" &&
          motionAllowed(state.preferences, "documentReveal") &&
          value < 1,
      );
    });
    q("[data-lab-render-status]").textContent = "WEBGL / LIVE";
    root.dataset.engine = "webgl";
    sync();
    const bounds = stage.getBoundingClientRect();
    // An intentionally hidden/offscreen author layer must not hold the whole
    // public page behind its loading screen waiting for an invisible frame.
    if (!authoring && !document.hidden && bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < innerHeight) await scene.ready;
    if (disposed) return dispose;
    takeLabCommands(root).forEach(command);
    const hash = location.hash.slice(1);
    if (/^project-[0-9a-f-]{36}$/i.test(hash)) {
      const selected = allItems.find((item) => item.key === hash.slice(8));
      if (selected) {
        const cell = locateItem(allItems, selected.key);
        select(cell.lane, cell.row, true);
      }
    } // The shared page loader owns initial boot; replay remains available.
  } catch {
    root.dataset.engine = "fallback";
    stage.dataset.ready = "fallback";
    q("[data-lab-render-status]").textContent = "靜態預覽 / 互動索引可用";
    status.textContent =
      "此裝置無法建立 3D 場景。仍可搜尋、閱讀、收藏與匯出作品。";
    root.style.setProperty("--lab-reveal", "1");
    takeLabCommands(root).forEach(command);
  }
  return dispose;
}
