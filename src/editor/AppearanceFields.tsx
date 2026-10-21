import type { Appearance } from "../../supabase/functions/_shared/schema";

/** Bounded, typed controls shared by built-in panels and composed blocks. */
export function AppearanceFields({
  values = {},
  patch,
}: {
  values?: Appearance;
  patch: (values: Partial<Appearance>) => void;
}) {
  return (
    <div className="appearance-fields">
      <div className="property-grid">
        {(
          [
            ["color", "文字色", "#efefec"],
            ["background", "背景色", "#141414"],
            ["borderColor", "邊框色", "#555555"],
          ] as const
        ).map(([key, label, fallback]) => (
          <label key={key}>
            {label}
            <input
              type="color"
              aria-label={`面板${label}`}
              value={values[key] || fallback}
              onChange={(e) => patch({ [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <label>
        邊框粗細
        <input
          type="number"
          aria-label="面板邊框粗細"
          min="0"
          max="8"
          value={values.borderWidth ?? ""}
          placeholder="沿用設計"
          onChange={(e) => {
            if (e.target.value !== "")
              patch({
                borderWidth: Math.min(8, Math.max(0, Number(e.target.value))),
              });
          }}
        />
      </label>
      <label>
        陰影
        <select
          aria-label="面板陰影"
          value={values.shadow || ""}
          onChange={(e) =>
            patch({
              shadow: (e.target.value || undefined) as Appearance["shadow"],
            })
          }
        >
          <option value="">沿用設計</option>
          <option value="none">無</option>
          <option value="soft">柔和</option>
          <option value="deep">層次</option>
        </select>
      </label>
      <label>
        懸停效果
        <select
          aria-label="面板懸停效果"
          value={values.effect || ""}
          onChange={(e) =>
            patch({
              effect: (e.target.value || undefined) as Appearance["effect"],
            })
          }
        >
          <option value="">沿用全站互動</option>
          <option value="none">靜態</option>
          <option value="lift">微浮起</option>
          <option value="scale">輕微放大</option>
          <option value="glow">柔光</option>
          <option value="outline">描邊</option>
          <option value="tilt">游標傾斜</option>
        </select>
      </label>
    </div>
  );
}
