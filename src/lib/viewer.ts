export function initViewer(root: Document | HTMLElement): () => void {
  const abort = new AbortController();
  const listen = (element: EventTarget, type: string, handler: EventListener) =>
    element.addEventListener(type, handler, { signal: abort.signal });
  const menu = root.querySelector<HTMLElement>(".mobile-nav");
  const toggle = root.querySelector<HTMLButtonElement>("[data-menu-toggle]");
  if (toggle && menu) {
    listen(toggle, "click", () => {
      menu.hidden = !menu.hidden;
      toggle.setAttribute("aria-expanded", String(!menu.hidden));
      toggle.setAttribute("aria-label", menu.hidden ? "開啟選單" : "關閉選單");
    });
    listen(menu, "click", () => {
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
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
    abort.abort();
    audio?.pause();
  };
}
