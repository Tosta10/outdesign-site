import type {
  Selection,
  SiteContent,
} from "../../supabase/functions/_shared/schema";
import { copyDefaults } from "../lib/presentation";
export function PresentationPanel({
  content,
  selection,
  update,
}: {
  content: SiteContent;
  selection: Selection;
  update: (edit: (next: SiteContent) => void) => void;
}) {
  const key = selection.slice(5);
  return (
    <div className="advanced-panel">
      <h3>介面文字</h3>
      <p className="selection-path">{key}</p>
      <label>
        文字內容
        <textarea
          aria-label="介面文字內容"
          value={content.presentation?.copy?.[key] ?? copyDefaults[key] ?? ""}
          maxLength={500}
          onChange={(e) =>
            update((next) => {
              next.presentation ||= {};
              next.presentation.copy ||= {};
              next.presentation.copy[key] = e.target.value;
            })
          }
        />
      </label>
      <button
        className="panel-secondary"
        onClick={() =>
          update((next) => {
            if (next.presentation?.copy) delete next.presentation.copy[key];
          })
        }
      >
        還原預設文字
      </button>
    </div>
  );
}
