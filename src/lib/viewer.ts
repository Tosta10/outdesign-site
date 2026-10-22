import { applySiteTheme, savedSiteTheme, setSiteTheme, type SiteTheme } from "./site-theme";
import { initEffects } from "./effects";
import { initPageLoading } from "./page-loading";
export function initViewer(root: Document | HTMLElement): () => void {
  if (root.querySelector('.site[data-editing="true"]')) return () => {};
  const disposeEffects = initEffects(root);
  const abort = new AbortController();
  const workLabs: (() => void)[] = [];
  const workReady = [...root.querySelectorAll<HTMLElement>("[data-work-lab]")].map(async (element) => {
    return await import("./work-lab/index").then(async ({ initWorkLab }) => {
      if (abort.signal.aborted) return;
      const dispose = await initWorkLab(element);
      if (abort.signal.aborted) dispose(); else workLabs.push(dispose);
    }).catch(() => { element.dataset.engine = "fallback"; });
  });
  const disposeLoading = root === document ? initPageLoading(Promise.all(workReady)) : () => {};
  let disposeLogic: (() => void) | undefined;
  const logicSource = root.querySelector("[data-site-logic]")?.textContent;
  if (logicSource)
    import("./logic-runtime")
      .then(async ({ initLogic }) => {
        await Promise.all(workReady);
        if (!abort.signal.aborted) {
          try {
            disposeLogic = initLogic(root, JSON.parse(logicSource));
          } catch {
            /* Keep content usable if a saved script is invalid. */
          }
        }
      })
      .catch(() => {
        /* A failed optional logic chunk must not block navigation. */
      });
  const listen = (element: EventTarget, type: string, handler: EventListener) =>
    element.addEventListener(type, handler, { signal: abort.signal });
  const site = root.querySelector<HTMLElement>(".site");
  const defaultTheme: SiteTheme = site?.dataset.siteTheme === "light" ? "light" : "dark";
  applySiteTheme(root, savedSiteTheme() || defaultTheme);
  listen(document, "outdesign:site-theme", ((event: CustomEvent<SiteTheme>) => {
    if (event.detail === "light" || event.detail === "dark") applySiteTheme(root, event.detail);
  }) as EventListener);
  const settings = root.querySelector<HTMLDialogElement>("[data-site-settings-modal]");
  root.querySelectorAll<HTMLElement>("[data-site-settings]").forEach(button => listen(button, "click", () => { menu?.close(); settings?.showModal(); }));
  root.querySelectorAll<HTMLElement>("[data-lab-settings-open]").forEach(button => listen(button, "click", () => {
    menu?.close();
    root.querySelector<HTMLElement>("[data-work-lab]")?.dispatchEvent(new Event("outdesign:lab-settings"));
  }));
  root.querySelectorAll<HTMLElement>("[data-site-settings-close]").forEach(button => listen(button, "click", () => settings?.close()));
  root.querySelectorAll<HTMLSelectElement>("[data-site-theme-select]").forEach(select => listen(select, "change", () => setSiteTheme(select.value as SiteTheme)));
  const menu = root.querySelector<HTMLDialogElement>(".nav-drawer");
  const toggle = root.querySelector<HTMLButtonElement>("[data-menu-toggle]");
  if (toggle && menu) {
    listen(toggle, "click", () => {
      if (menu.open) menu.close();
      else menu.showModal();
      toggle.setAttribute("aria-expanded", String(menu.open));
      toggle.setAttribute("aria-label", menu.open ? "關閉選單" : "開啟選單");
      document.documentElement.classList.toggle("nav-open", menu.open);
    });
    listen(menu, "close", () => {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "開啟選單");
      document.documentElement.classList.remove("nav-open");
    });
    listen(menu, "click", (event) => {
      if ((event.target as Element).closest("a")) menu.close();
    });
  }
  root.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) =>
    listen(button, "click", () => {
      root.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((b) => {
        b.classList.toggle("active", b === button);
        b.setAttribute("aria-pressed", String(b === button));
      });
      root.querySelectorAll<HTMLElement>("[data-category]").forEach((card) => {
        card.hidden =
          button.dataset.filter !== "全部" &&
          card.dataset.category !== button.dataset.filter;
      });
    }),
  );
  root
    .querySelectorAll<HTMLButtonElement>("[data-open-dialog]")
    .forEach((button) =>
      listen(button, "click", () => {
        const dialog = root.querySelector<HTMLDialogElement>(
          `#${button.dataset.openDialog}`,
        );
        if (dialog && !dialog.open) dialog.showModal();
      }),
    );
  root
    .querySelectorAll<HTMLButtonElement>("[data-close-dialog]")
    .forEach((button) =>
      listen(button, "click", () => button.closest("dialog")?.close()),
    );
  root.querySelectorAll<HTMLDialogElement>("dialog").forEach((dialog) =>
    listen(dialog, "click", (event) => {
      if (event.target === dialog) {
        const r = dialog.getBoundingClientRect();
        const e = event as MouseEvent;
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          dialog.close();
      }
    }),
  );
  const projectHash = window.location.hash.slice(1);
  if (/^project-[0-9a-f-]{36}$/i.test(projectHash)) {
    const dialog = root.querySelector<HTMLDialogElement>(
      `[id="${projectHash}"]`,
    );
    if (dialog && !dialog.open) dialog.showModal();
  }
  const audio = root.querySelector<HTMLAudioElement>("[data-site-audio]");
  const audioToggle = root.querySelector<HTMLButtonElement>(
    "[data-audio-toggle]",
  );
  const feedback = root.querySelector<HTMLElement>("[data-audio-feedback]");
  const updateAudio = () => {
    if (!audio || !audioToggle) return;
    const playing = !audio.paused;
    audioToggle.setAttribute("aria-pressed", String(playing));
    audioToggle.setAttribute("aria-label", playing ? "暫停音樂" : "播放音樂");
    const play = audioToggle.querySelector<HTMLElement>("[data-play-icon]");
    const pause = audioToggle.querySelector<HTMLElement>("[data-pause-icon]");
    if (play) play.hidden = playing;
    if (pause) pause.hidden = !playing;
    root.querySelector(".sound-bars")?.classList.toggle("playing", playing);
  };
  if (audio && audioToggle) {
    listen(audioToggle, "click", async () => {
      if (feedback) feedback.textContent = "";
      try {
        if (audio.paused) await audio.play();
        else audio.pause();
      } catch {
        if (feedback) feedback.textContent = "音樂暫時無法播放，請稍後再試。";
      }
      updateAudio();
    });
    ["play", "pause", "ended"].forEach((type) =>
      listen(audio, type, updateAudio),
    );
    listen(audio, "error", () => {
      if (feedback) feedback.textContent = "音訊載入失敗，請確認檔案。";
      updateAudio();
    });
  }
  return () => {
    disposeEffects();
    disposeLoading();
    disposeLogic?.();
    workLabs.forEach((dispose) => dispose());
    abort.abort();
    audio?.pause();
    if (settings?.open) settings.close();
    if (menu?.open) menu.close();
    document.documentElement.classList.remove("nav-open");
  };
}
