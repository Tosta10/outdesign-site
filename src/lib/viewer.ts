import { initEffects } from "./effects";
export function initViewer(root: Document | HTMLElement): () => void {
  const disposeEffects = initEffects(root);
  const abort = new AbortController();
  const listen = (element: EventTarget, type: string, handler: EventListener) =>
    element.addEventListener(type, handler, { signal: abort.signal });
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
    abort.abort();
    audio?.pause();
    if (menu?.open) menu.close();
    document.documentElement.classList.remove("nav-open");
  };
}
