import { useState } from "react";
import {
  contentSchema,
  type CanvasNode,
  type SiteContent,
} from "../../supabase/functions/_shared/schema";
import { saveAssembly, instantiateAssembly } from "../lib/assemblies";
import { descendants } from "../lib/workspace";

export function AssemblyPanel({
  content,
  node,
  update,
}: {
  content: SiteContent;
  node: CanvasNode;
  update: (edit: (next: SiteContent) => void) => void;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const presets = content.workspace?.presets || [];
  const save = () => {
    try {
      const label = name.trim() || node.name;
      if (presets.some((p) => p.name === label))
        throw new Error("名稱已存在，請換一個名稱。");
      const preset = saveAssembly(content.workspace!.nodes, node.id, label);
      if (
        new TextEncoder().encode(
          JSON.stringify({
            ...content,
            workspace: { ...content.workspace, presets: [...presets, preset] },
          }),
        ).length > 200000
      )
        throw new Error("名稱或組裝內容過大，請簡化後再儲存。");
      update((next) => {
        next.workspace!.presets ||= [];
        next.workspace!.presets.push(preset);
      });
      setName("");
      setMessage(`已儲存「${label}」，可從積木庫或面板選項重用。`);
    } catch (error) {
      setMessage(
        error instanceof Error && error.message.includes("名稱")
          ? error.message
          : "組裝最多 30 個積木，請先簡化內容。",
      );
    }
  };
  return (
    <details className="assembly-panel">
      <summary>組裝與重用</summary>
      <p className="panel-help">
        將此面板的文字、圖片、連結、排版與效果命名保存。每次套用都可獨立編輯。
      </p>
      <label>
        組裝名稱
        <input
          aria-label="組裝名稱"
          maxLength={60}
          placeholder={node.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        className="panel-secondary"
        disabled={presets.length >= 8}
        onClick={save}
      >
        儲存為組裝
      </button>
      {presets.length >= 8 && (
        <p className="panel-help">已達 8 組，可從積木庫刪除不用的組裝。</p>
      )}
      <label>
        套用組裝
        <select
          aria-label="套用組裝"
          value=""
          onChange={(e) => {
            const preset = presets.find((p) => p.id === e.target.value);
            if (!preset) return;
            const removed = new Set([
              node.id,
              ...descendants(content.workspace!.nodes, node.id),
            ]);
            const replacement = instantiateAssembly(
              preset,
              node.page,
              node.parent,
              node.id,
            );
            if (
              content.workspace!.nodes.length -
                removed.size +
                replacement.length >
              100
            ) {
              setMessage("套用後超過 100 個積木上限。");
              return;
            }
            const nodes = content
              .workspace!.nodes.filter((n) => !removed.has(n.id))
              .concat(replacement);
            if (
              !contentSchema.safeParse({
                ...content,
                workspace: { ...content.workspace, nodes },
              }).success
            ) {
              setMessage("此組裝超過六層深度，請選擇較外層面板。");
              return;
            }
            update((next) => {
              next.workspace!.nodes = nodes;
            });
            setMessage(`已套用「${preset.name}」。可使用頂部復原。`);
          }}
        >
          <option value="">選擇組裝取代此面板…</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.nodes.length} 積木
            </option>
          ))}
        </select>
      </label>
      {message && (
        <p className="panel-help" role="status">
          {message}
        </p>
      )}
    </details>
  );
}
