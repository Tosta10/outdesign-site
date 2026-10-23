import type { LabMode } from "./state.ts";

/** Retire the archive across the camera flight, rather than at one frame. */
export function archivePresence(detail: number) {
  const t = Math.max(0, Math.min(1, (detail - .65) / .35));
  return 1 - t * t * (3 - 2 * t);
}

/** Closing keeps the current print/lid reveal until the model is back home. */
export function advanceModelReveal(
  current: number,
  mode: LabMode,
  detail: number,
  lift: number,
  dt: number,
  duration: number,
) {
  if (mode === "browse") return detail <= .001 ? 0 : current;
  if (detail <= .78 || lift <= 3.3) return current;
  return Math.min(1, current + Math.max(0, dt) / Math.max(.01, duration));
}
