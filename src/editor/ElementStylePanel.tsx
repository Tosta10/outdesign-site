import { AppearanceFields } from "./AppearanceFields";
import type {
  SiteContent,
  Selection,
} from "../../supabase/functions/_shared/schema";
import { useState } from "react";
import type { SitePage } from "../components/SiteRenderer";
export function ElementStylePanel({
  content,
  selection,
  page,
  update,
}: {
  content: SiteContent;
  selection: Selection;
  page: SitePage;
  update: (edit: (next: SiteContent) => void) => void;
}) {
  const [chrome, setChrome] = useState("header");
  if (selection.startsWith("node:")) return null;
  const key = selection.startsWith("copy:")
    ? `copy-${selection.slice(5)}`
    : selection.startsWith("project:")
      ? `project-${selection.slice(8)}`
      : selection.startsWith("note:")
        ? `note-${selection.slice(5)}`
        : selection === "about" && page === "home"
          ? "mission"
          : selection === "settings"
            ? chrome
            : selection;
  const values = content.presentation?.elements?.[key] || {};
  const patch = (name: string, value: unknown) =>
    update((next) => {
      next.presentation ||= {};
      next.presentation.elements ||= {};
      next.presentation.elements[key] = { ...values, [name]: value };
    });
  return (
    <details className="element-style-panel">
      <summary>元素外觀與留白</summary>
      <div className="advanced-panel">
        <p className="selection-path">{key}</p>
        {selection === "settings" && (
          <label>
            全站元素
            <select
              aria-label="選擇全站元素"
              value={chrome}
              onChange={(e) => setChrome(e.target.value)}
            >
              <option value="header">頁首品牌與導覽</option>
              <option value="footer">頁尾</option>
            </select>
          </label>
        )}
        {(
          [
            ["padding", "內距", 0, 120],
            ["radius", "圓角", 0, 40],
            ["fontSize", "字級", 8, 120],
            ["opacity", "透明度", 0.1, 1],
          ] as const
        ).map(([name, label, min, max]) => (
          <label key={name}>
            {label}
            <input
              aria-label={`元素${label}`}
              type="number"
              min={min}
              max={max}
              step={name === "opacity" ? 0.05 : 1}
              value={values[name] ?? ""}
              placeholder="沿用設計"
              onChange={(e) => {
                if (e.target.value !== "")
                  patch(
                    name,
                    Math.max(min, Math.min(max, Number(e.target.value))),
                  );
              }}
            />
          </label>
        ))}
        <AppearanceFields
          values={values}
          patch={(changed) =>
            update((next) => {
              next.presentation ||= {};
              next.presentation.elements ||= {};
              next.presentation.elements[key] = { ...values, ...changed };
            })
          }
        />
        <label className="advanced-check">
          <input
            type="checkbox"
            checked={Boolean(values.hidden)}
            onChange={(e) => patch("hidden", e.target.checked)}
          />
          在公開頁隱藏（編輯時仍可選取）
        </label>
        <button
          className="panel-secondary"
          onClick={() =>
            update((next) => {
              if (next.presentation?.elements)
                delete next.presentation.elements[key];
            })
          }
        >
          還原元素樣式
        </button>
      </div>
    </details>
  );
}
