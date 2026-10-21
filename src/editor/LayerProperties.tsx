import type {
  Selection,
  SiteContent,
} from "../../supabase/functions/_shared/schema";
import { pageNames, type SitePage } from "../components/SiteRenderer";
import { pageTitle } from "../lib/presentation";
import { patchLayer, selectionKey } from "../lib/layers";
import {
  readSource,
  sourceLabels,
  sourcePath,
  writeSource,
} from "../lib/source-fields";
type Props = {
  content: SiteContent;
  page: SitePage;
  selection: Selection;
  update: (fn: (c: SiteContent) => void) => void;
};
export function PageTitleField({
  content,
  page,
  update,
}: Omit<Props, "selection">) {
  return (
    <details className="page-title-settings">
      <summary>分頁名稱 · {pageNames[page]}</summary>
      <label>
        瀏覽器分頁名稱
        <input
          aria-label="瀏覽器分頁名稱"
          maxLength={100}
          value={pageTitle(content, page)}
          onChange={(e) =>
            update((next) => {
              next.settings.pageTitles ||= Object.fromEntries(
                Object.keys(pageNames).map((p) => [p, pageTitle(next, p)]),
              ) as NonNullable<SiteContent["settings"]["pageTitles"]>;
              next.settings.pageTitles[page] = e.target.value;
            })
          }
        />
      </label>
      <p>儲存為草稿，發布後套用至網站。</p>
    </details>
  );
}
export function SourceProperties({
  content,
  selection,
  update,
}: Omit<Props, "page">) {
  const key = selection.slice(8),
    path = sourcePath(key, content);
  if (path)
    return (
      <div className="advanced-panel">
        <label>
          {sourceLabels[path] || path.split(".").at(-1)}
          <textarea
            aria-label="原始元素內容"
            value={readSource(content, path)}
            onChange={(e) =>
              update((next) => writeSource(next, path, e.target.value))
            }
          />
        </label>
      </div>
    );
  if (["hero-image", "mission-image", "brand-logo"].includes(key)) {
    const image =
      key === "hero-image"
        ? content.hero.image
        : key === "brand-logo"
          ? content.presentation?.logo || "/assets/outdesign-mark.webp"
          : content.presentation?.missionImage ||
            "/assets/lunar-landscape.webp";
    return (
      <div className="advanced-panel">
        <label>
          圖片網址
          <input
            aria-label="原始圖片網址"
            value={image}
            onChange={(e) =>
              update((next) => {
                if (key === "hero-image") next.hero.image = e.target.value;
                else {
                  next.presentation ||= {};
                  if (key === "brand-logo")
                    next.presentation.logo = e.target.value;
                  else next.presentation.missionImage = e.target.value;
                }
              })
            }
          />
        </label>
      </div>
    );
  }
  return (
    <p className="panel-help">
      此物件可在「佈局」調整位置與尺寸，在下方調整外觀。展開左側圖層可選取內部文字與圖片。
    </p>
  );
}
export function LayerTransformPanel({
  content,
  page,
  selection,
  update,
}: Props) {
  const key = selectionKey(selection, page),
    values = content.presentation?.elements?.[key] || {};
  return (
    <details className="layer-transform-properties" open>
      <summary>位置與變形</summary>
      <div className="advanced-panel">
        <label>
          圖層命名
          <input
            aria-label="選取圖層命名"
            value={values.name || ""}
            placeholder="沿用物件名稱"
            maxLength={60}
            onChange={(e) =>
              update((next) => patchLayer(next, key, { name: e.target.value }))
            }
          />
        </label>
        <div className="property-grid">
          {(
            [
              ["x", "水平位移", -3000, 3000],
              ["y", "垂直位移", -3000, 3000],
              ["width", "物件寬度", 16, 3000],
              ["height", "物件高度", 16, 3000],
              ["rotation", "旋轉角度", -360, 360],
              ["zIndex", "堆疊順序", -100, 999],
            ] as const
          ).map(([name, label, min, max]) => (
            <label key={name}>
              {label}
              <input
                type="number"
                aria-label={label}
                value={values[name] ?? ""}
                placeholder="自動"
                min={min}
                max={max}
                disabled={values.locked}
                onChange={(e) => {
                  const v =
                    e.target.value === ""
                      ? undefined
                      : Math.max(min, Math.min(max, Number(e.target.value)));
                  update((next) => patchLayer(next, key, { [name]: v }));
                }}
              />
            </label>
          ))}
        </div>
        <button
          className="panel-secondary"
          onClick={() =>
            update((next) =>
              patchLayer(next, key, {
                x: undefined,
                y: undefined,
                width: undefined,
                height: undefined,
                rotation: undefined,
                zIndex: undefined,
                order: undefined,
              }),
            )
          }
        >
          還原位置與尺寸
        </button>
        <p className="panel-help">
          移動工具可直接拖曳原始內容與新增物件。角點縮放；方向鍵微調，Shift +
          方向鍵為 10px。小螢幕保留閱讀順序。
        </p>
      </div>
    </details>
  );
}
