import { blockRecipes, type BlockRecipe } from "../lib/blocks";
import type { Assembly } from "../../supabase/functions/_shared/schema";
export const blockMime = "application/x-outdesign-block";
export function BlockLibrary({
  insert,
  remaining,
  presets = [],
  removePreset,
}: {
  insert: (recipe: BlockRecipe | `preset:${string}`) => void;
  presets?: Assembly[];
  removePreset: (id: string) => void;
  remaining: number;
}) {
  return (
    <section className="block-library" aria-label="積木庫">
      <p className="blueprint-caption">組合 / 參數 / 即時畫布</p>
      <p className="panel-help">
        點選插入，或拖到畫布與現有面板。每組積木皆可拆解與重排。
      </p>
      {presets.length > 0 && (
        <div className="saved-assemblies">
          <h3>我的組裝</h3>
          {presets.map((preset) => (
            <div className="saved-assembly" key={preset.id}>
              <button
                className="panel-secondary"
                disabled={remaining < preset.nodes.length}
                aria-label={`插入組裝：${preset.name}`}
                onClick={() => insert(`preset:${preset.id}`)}
              >
                {preset.name}
                <small>{preset.nodes.length} 積木</small>
              </button>
              <button
                className="assembly-delete"
                aria-label={`刪除組裝：${preset.name}`}
                title="移除組裝預設，已插入面板不受影響"
                onClick={() => removePreset(preset.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {blockRecipes.map((block, index) => {
        const disabled = remaining < (block.id === "columns" ? 4 : 3);
        return (
          <button
            key={block.id}
            className="recipe-card"
            disabled={disabled}
            draggable={!disabled}
            onDragStart={(e) => {
              e.dataTransfer.setData(blockMime, block.id);
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => insert(block.id)}
            aria-label={`插入積木：${block.name}`}
          >
            <span
              className={`recipe-wireframe wire-${block.shape}`}
              aria-hidden="true"
            >
              <i />
              <i />
              <i />
            </span>
            <span>
              <small>0{index + 1}</small>
              <strong>{block.name}</strong>
              <em>{block.detail}</em>
            </span>
          </button>
        );
      })}
    </section>
  );
}
