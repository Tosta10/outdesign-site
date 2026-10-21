import { useRef, useState } from "react";
export function PanelResizer({ side }: { side: "left" | "right" | "logic" }) {
  const drag = useRef<{
    start: number;
    width: number;
    shell: HTMLElement;
  } | null>(null);
  const [value, setValue] = useState(
    side === "left" ? 248 : side === "logic" ? 340 : 344,
  );
  const variable =
    side === "left"
      ? "--layer-width"
      : side === "logic"
        ? "--logic-library-width"
        : "--inspector-width";
  return (
    <div
      className={`panel-resizer resizer-${side}`}
      role="separator"
      tabIndex={0}
      aria-valuemin={200}
      aria-valuemax={640}
      aria-valuenow={value}
      aria-label={side === "left" ? "調整左側面板寬度" : "調整右側面板寬度"}
      aria-orientation="vertical"
      onPointerDown={(e) => {
        const shell = e.currentTarget.closest<HTMLElement>(".editor-shell")!;
        drag.current = {
          start: e.clientX,
          width: parseFloat(getComputedStyle(shell).getPropertyValue(variable)),
          shell,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const d = drag.current,
          max = Math.min(640, innerWidth * 0.42);
        d.shell.style.setProperty(
          variable,
          `${Math.min(max, Math.max(200, d.width + (side === "left" ? 1 : -1) * (e.clientX - d.start)))}px`,
        );
      }}
      onPointerUp={() => {
        if (drag.current)
          setValue(
            parseFloat(
              getComputedStyle(drag.current.shell).getPropertyValue(variable),
            ),
          );
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onKeyDown={(e) => {
        if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
        e.preventDefault();
        const shell = e.currentTarget.closest<HTMLElement>(".editor-shell")!;
        const width = parseFloat(
          getComputedStyle(shell).getPropertyValue(variable),
        );
        const next = Math.max(
          200,
          Math.min(
            640,
            width +
              (e.key === "ArrowRight" ? 16 : -16) * (side === "left" ? 1 : -1),
          ),
        );
        shell.style.setProperty(variable, `${next}px`);
        setValue(next);
      }}
    />
  );
}
