import { WorkLabPanel } from "./WorkLabPanel";
import { LabBlockFields, labBlockSummary } from "./LabBlockFields";
import {
  memo,
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type {
  LogicBlock,
  LogicScript,
  SiteContent,
} from "../../supabase/functions/_shared/schema";
import { contentSchema } from "../../supabase/functions/_shared/schema";
import {
  logicCategories,
  logicCatalog,
  eventLabels,
  createLogicBlock,
  connectLogicBlock,
  findLogicBlock,
  extractLogicBlock,
  duplicateLogicScript,
  isContainer,
  type LogicOp,
} from "../lib/logic";
import { collectLayers, type LayerItem } from "../lib/layers";
import { instantiateAssembly } from "../lib/assemblies";
import { createCanvasNode } from "../lib/workspace";
import {
  SiteRenderer,
  pageNames,
  type SitePage,
} from "../components/SiteRenderer";
import { initViewer } from "../lib/viewer";
import { PanelResizer } from "./ResizablePanels";
import { LogicObjectProperties } from "./LogicObjectProperties";
import { MiniPreview } from "./MiniPreview";
import { useCanvasNavigation, isTextEntry, zoomLevels } from "./useCanvasNavigation";
const mime = "application/outdesign-logic";
type Payload = {
  op?: LogicOp;
  script?: string;
  block?: string;
  event?: LogicScript["event"];
  object?: string;
  preset?: string;
};
type Props = {
  content: SiteContent;
  page: SitePage;
  api: string;
  base: string;
  assets: Record<string, string>;
  update: (fn: (c: SiteContent) => void) => void;
  changePage: (p: SitePage) => void;
  onMode: () => void;
  onSave: () => void;
  onPublish: () => void;
  onExit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  status: string;
  error: string;
  onImport: (file: File) => Promise<string | undefined>;
};
function Modal({
  title,
  children,
  close,
  className = "",
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`logic-modal ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="logic-modal-title">
        <h2 id={titleId}>{title}</h2>
        <button aria-label="關閉積木視窗" onClick={close}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
const LogicPreview = memo(function LogicPreview({
  content,
  page,
  api,
  base,
  assets,
}: Pick<Props, "content" | "page" | "api" | "base" | "assets">) {
  const ref = useRef<HTMLDivElement>(null),
    [route, setRoute] = useState(page);
  useEffect(() => {
    if (ref.current) return initViewer(ref.current);
  }, [content, route]);
  return (
    <div
      ref={ref}
      className="logic-live-preview canvas-stage"
      onClickCapture={(e) => {
        const a = (e.target as Element).closest<HTMLElement>(
          "[data-page-target]",
        );
        if (a?.dataset.pageTarget) {
          e.preventDefault();
          setRoute(a.dataset.pageTarget as SitePage);
        }
        if ((e.target as Element).closest("[data-studio-launch]"))
          e.preventDefault();
      }}
    >
      <SiteRenderer
        content={content}
        api={api}
        base={base}
        page={route}
        privateAssets={assets}
      />
    </div>
  );
});
export default function ScratchStudio(props: Props) {
  const { content, page, update } = props;
  const scripts = (content.workspace?.scripts || []).filter(
    (s) => s.page === page,
  );
  const [category, setCategory] = useState("objects"),
    [layers, setLayers] = useState<LayerItem[]>([]),
    [target, setTarget] = useState("hero");
  const [editing, setEditing] = useState<{
      script: string;
      block?: string;
    } | null>(null),
    [preview, setPreview] = useState(false),
    [message, setMessage] = useState(""),
    [zoom, setZoom] = useState(1),
    [uploading, setUploading] = useState(false);
  const deferredContent = useDeferredValue(content);
  const [selected, setSelected] = useState<{ script: string; block?: string } | null>(null);
  const inventory = useRef<HTMLDivElement>(null),
    workspace = useRef<HTMLDivElement>(null);
  useCanvasNavigation(workspace, !editing && !preview, zoom, setZoom);
  const touchDrag = useRef<{ payload: Payload; x: number; y: number; ghost: HTMLElement; id: number; moved: boolean } | null>(null);
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    startX: number;
    startY: number;
    el: HTMLElement;
    dx: number;
    dy: number;
  } | null>(null);
  useEffect(() => () => { touchDrag.current?.ghost.remove(); }, []);
  useEffect(() => {
    if (inventory.current) setLayers(collectLayers(content, inventory.current));
  }, [content, page]);
  useEffect(() => {
    if (layers.length && !layers.some((l) => l.selection === target))
      setTarget(
        layers.find((l) => l.key === "hero")?.selection || layers[0].selection,
      );
  }, [layers, target]);
  const candidateChange = (fn: (next: SiteContent) => void) => {
    const candidate = structuredClone(content);
    fn(candidate);
    const result = contentSchema.safeParse(candidate);
    if (!result.success) {
      setMessage(result.error.issues[0]?.message || "積木超過結構上限");
      return;
    }
    update(fn);
    setMessage("已同步草稿");
  };
  const modifyScript = (id: string, fn: (s: LogicScript) => void) =>
    candidateChange((next) => {
      const s = next.workspace?.scripts?.find((s) => s.id === id);
      if (s) fn(s);
    });
  const addScript = (
    x = 40,
    y = 50,
    targetValue = target,
    nodeType?: "frame" | "text" | "image" | "link",
    image = "",
  ) => {
    let createdTarget = targetValue;
    candidateChange((next) => {
      next.workspace ||= { nodes: [] };
      next.workspace.scripts ||= [];
      if (nodeType) {
        const node = createCanvasNode(page, nodeType);
        node.image = image;
        next.workspace.nodes.push(node);
        createdTarget = `node:${node.id}`;
      }
      next.workspace.scripts.push({
        id: crypto.randomUUID(),
        page,
        name: nodeType
          ? `新${{ frame: "面板", text: "文字", image: "圖片", link: "連結" }[nodeType]}`
          : "互動腳本",
        target: createdTarget,
        event: "click",
        key: "Enter",
        enabled: true,
        x: Math.max(0, Math.min(4000, x)),
        y: Math.max(0, Math.min(4000, y)),
        blocks: [],
      });
    });
  };
  const startPayload = (e: React.DragEvent, payload: Payload) => {
    e.dataTransfer.setData(mime, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = payload.block ? "move" : "copy";
  };
  const payload = (e: React.DragEvent): Payload | null => {
    try {
      return JSON.parse(e.dataTransfer.getData(mime));
    } catch {
      return null;
    }
  };
  const insert = (
    e: React.DragEvent,
    scriptId: string,
    parentId: string | null,
    branch: "children" | "otherwise",
    index: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const p = payload(e);
    if (!p) return;
    candidateChange((next) => {
      const script = next.workspace?.scripts?.find((s) => s.id === scriptId);
      if (!script) return;
      if (p.event) {
        script.event = p.event;
        return;
      }
      connectLogicBlock(next.workspace?.scripts || [], p, { script: scriptId, parent: parentId, branch, index });
    });
  };
  const slot = (
    s: LogicScript,
    parent: string | null,
    branch: "children" | "otherwise",
    index: number,
  ) => (
    <div
      key={`slot-${parent}-${branch}-${index}`}
      className="logic-drop-slot"
      data-empty={(parent ? findLogicBlock(s.blocks, parent)?.[branch] : s.blocks)?.length === 0}
      data-script={s.id} data-parent={parent || ""} data-branch={branch} data-index={index}
      role="group"
      aria-label="積木連接位置"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(mime)) {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.classList.add("active");
        }
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("active")}
      onDrop={(e) => {
        e.currentTarget.classList.remove("active");
        try {
          insert(e, s.id, parent, branch, index);
        } catch (error) {
          setMessage((error as Error).message);
        }
      }}
    />
  );
  const magneticSlot = (e: { currentTarget: HTMLElement; clientX: number; clientY: number }) => {
    const slots = [...e.currentTarget.querySelectorAll<HTMLElement>(".logic-drop-slot")];
    let closest: HTMLElement | null = null;
    let best = Infinity;
    for (const el of slots) {
      const rect = el.getBoundingClientRect();
      if (e.clientX < rect.left - 12 || e.clientX > rect.right + 12) continue;
      const distance = Math.abs(e.clientY - (rect.top + rect.height / 2));
      if (distance < 30 * zoom && distance < best) { best = distance; closest = el; }
    }
    return closest;
  };
  const renderBlocks = (
    s: LogicScript,
    blocks: LogicBlock[],
    parent: string | null = null,
    branch: "children" | "otherwise" = "children",
  ): ReactNode => (
    <>
      {slot(s, parent, branch, 0)}
      {blocks.map((b, index) => {
        const def = logicCatalog.find((d) => d.op === b.op)!,
          cat = logicCategories.find((c) => c.id === def.category)!;
        return (
          <div key={b.id} className="logic-block-unit" data-block-id={b.id}>
            <div
              className={`scratch-block ${selected?.block === b.id ? "selected" : ""} category-${def.category} ${isContainer(b.op) ? "c-block" : ""}`}
              style={{ "--block-color": cat.color } as CSSProperties}
              draggable
              data-logic-payload={JSON.stringify({ script: s.id, block: b.id })}
              onDragStart={(e) => {
                e.stopPropagation();
                startPayload(e, { script: s.id, block: b.id });
              }}
              onClick={() => setSelected({ script: s.id, block: b.id })}
              onFocus={() => setSelected({ script: s.id, block: b.id })}
              onDoubleClick={() => setEditing({ script: s.id, block: b.id })}
              tabIndex={0}
              role="group"
              aria-label={`編輯積木：${def.label}`}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  setEditing({ script: s.id, block: b.id });
              }}
            >
              <span>{def.label}</span>
              <span className="block-value">
                {b.op.startsWith("lab-") ? labBlockSummary(b) : b.op.includes("variable")
                  ? `${b.value} ${b.op === "if-variable" ? "≥" : b.op === "add-variable" ? "+" : "="} ${b.amount}`
                  : ["stop", "reset-transform"].includes(b.op) ? ""
                  : ["color", "text-color", "text", "animate", "link"].includes(b.op)
                    ? b.value.slice(0, 30)
                    : b.op === "wait"
                      ? `${b.duration} 秒`
                      : ["show", "hide", "toggle"].includes(b.op)
                        ? "此物件"
                        : b.amount}
              </span>
              <button
                aria-label={`刪除積木：${def.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  modifyScript(s.id, (script) => {
                    extractLogicBlock(script.blocks, b.id);
                  });
                }}
              >
                ×
              </button>
            </div>
            {isContainer(b.op) && (
              <div
                className="logic-branch"
                style={{ "--block-color": cat.color } as CSSProperties}
              >
                {renderBlocks(s, b.children, b.id)}
                {b.op !== "repeat" && (
                  <>
                    <span className="logic-else">否則</span>
                    {renderBlocks(s, b.otherwise, b.id, "otherwise")}
                  </>
                )}
              </div>
            )}
            {slot(s, parent, branch, index + 1)}
          </div>
        );
      })}
    </>
  );
  const editScript = content.workspace?.scripts?.find(
      (s) => s.id === editing?.script,
    ),
    editBlock =
      editScript && editing?.block
        ? findLogicBlock(editScript.blocks, editing.block)
        : undefined;
  const changeBlock = (patch: Partial<LogicBlock>) => {
    if (editScript && editBlock)
      modifyScript(editScript.id, (s) =>
        Object.assign(findLogicBlock(s.blocks, editBlock.id)!, patch),
      );
  };
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (editing || preview || isTextEntry(e.target) || e.isComposing) return;
      if (e.key === "Escape") { setSelected(null); return; }
      if (!selected) return;
      if (["Delete", "Backspace"].includes(e.key)) {
        e.preventDefault();
        candidateChange((next) => {
          const script = next.workspace?.scripts?.find((s) => s.id === selected.script);
          if (!script) return;
          if (selected.block) extractLogicBlock(script.blocks, selected.block);
          else next.workspace!.scripts = next.workspace!.scripts!.filter((s) => s.id !== selected.script);
        });
        setSelected(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        candidateChange((next) => {
          const script = next.workspace?.scripts?.find((s) => s.id === selected.script);
          if (!script) return;
          const copy = duplicateLogicScript(script);
          if (selected.block) {
            // IDs have been regenerated; preserve tree position through a recursive source walk.
            const duplicateAt = (source: LogicBlock[], copies: LogicBlock[]): boolean => {
              for (let i = 0; i < source.length; i++) {
                if (source[i].id === selected.block) { source.splice(i + 1, 0, copies[i]); return true; }
                if (duplicateAt(source[i].children, copies[i].children) || duplicateAt(source[i].otherwise, copies[i].otherwise)) return true;
              }
              return false;
            };
            duplicateAt(script.blocks, copy.blocks);
          } else next.workspace!.scripts!.push(copy);
        });
      }
      if (!selected.block && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        modifyScript(selected.script, (s) => {
          const step = e.shiftKey ? 10 : 1;
          s.x = Math.max(0, Math.min(4000, s.x + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0)));
          s.y = Math.max(0, Math.min(4000, s.y + (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0)));
        });
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [content, selected, editing, preview]);
  const selectedCategory = logicCategories.find((c) => c.id === category)!;
  return (
    <div className="scratch-studio"
      onPointerDownCapture={(e) => {
        if (e.pointerType === "mouse" || e.button !== 0) return;
        if ((e.target as Element).closest(".scratch-block button")) return;
        const source = (e.target as Element).closest<HTMLElement>("[data-logic-payload]");
        if (!source) return;
        e.preventDefault(); e.stopPropagation();
        const ghost = document.createElement("div");
        ghost.className = "logic-touch-ghost";
        ghost.textContent = source.textContent?.slice(0, 45) || "積木";
        ghost.style.left = `${e.clientX + 12}px`; ghost.style.top = `${e.clientY + 12}px`;
        document.body.append(ghost);
        touchDrag.current = { payload: JSON.parse(source.dataset.logicPayload!), x: e.clientX, y: e.clientY, ghost, id: e.pointerId, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMoveCapture={(e) => {
        const d = touchDrag.current;
        if (!d || d.id !== e.pointerId) return;
        e.preventDefault(); e.stopPropagation();
        d.moved ||= Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 8;
        d.ghost.style.left = `${e.clientX + 12}px`; d.ghost.style.top = `${e.clientY + 12}px`;
        document.querySelectorAll(".logic-drop-slot.active").forEach((el) => el.classList.remove("active"));
        const stack = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>(".scratch-stack");
        if (stack) magneticSlot({ currentTarget: stack, clientX: e.clientX, clientY: e.clientY })?.classList.add("active");
      }}
      onPointerUpCapture={(e) => {
        const d = touchDrag.current;
        if (!d || d.id !== e.pointerId) return;
        e.preventDefault(); e.stopPropagation();
        touchDrag.current = null; d.ghost.remove();
        document.querySelectorAll(".logic-drop-slot.active").forEach((el) => el.classList.remove("active"));
        if (!d.moved) { setMessage("拖曳積木至工作區連接位置。"); return; }
        const hit = document.elementFromPoint(e.clientX, e.clientY);
        const stack = hit?.closest<HTMLElement>(".scratch-stack");
        const slot = stack && magneticSlot({ currentTarget: stack, clientX: e.clientX, clientY: e.clientY });
        try {
          if (stack && d.payload.event) modifyScript(stack.dataset.scriptId!, (s) => { s.event = d.payload.event!; });
          else if (stack && slot) candidateChange((next) => connectLogicBlock(next.workspace?.scripts || [], d.payload, { script: stack.dataset.scriptId!, parent: slot.dataset.parent || null, branch: slot.dataset.branch as "children" | "otherwise", index: Number(slot.dataset.index) }));
          else if (hit?.closest(".scratch-scroll") && d.payload.object && workspace.current) {
            const rect = workspace.current.getBoundingClientRect();
            addScript((e.clientX - rect.left + workspace.current.scrollLeft) / zoom, (e.clientY - rect.top + workspace.current.scrollTop) / zoom, target, d.payload.object === "existing" ? undefined : d.payload.object as "frame");
          } else if (hit?.closest(".scratch-scroll") && d.payload.preset) {
            const preset = content.workspace?.presets?.find((p) => p.id === d.payload.preset);
            if (preset) candidateChange((next) => next.workspace!.nodes.push(...instantiateAssembly(preset, page, null)));
          } else setMessage("請將積木拖近腳本上緣或下緣連接。");
        } catch (error) { setMessage((error as Error).message); }
      }}
      onPointerCancelCapture={() => {
        touchDrag.current?.ghost.remove(); touchDrag.current = null;
        document.querySelectorAll(".logic-drop-slot.active").forEach((el) => el.classList.remove("active"));
      }}
      onDragEnd={() => document.querySelectorAll(".logic-drop-slot.active").forEach((el) => el.classList.remove("active"))}>
      <header className="scratch-topbar">
        <div>
          <span className="eyebrow">OUTDESIGN / LOGIC STUDIO</span>
          <h1>積木工作區</h1>
        </div>
        <span className="scratch-save-status" role="status">
          {props.status}
        </span>
        <button disabled={!props.canUndo} onClick={props.onUndo}>
          復原
        </button>
        <button disabled={!props.canRedo} onClick={props.onRedo}>
          重做
        </button>
        <button onClick={() => setPreview(true)}>▶ 執行預覽</button>
        <button onClick={props.onSave}>儲存</button>
        <button
          className="logic-publish"
          onClick={() => {
            if (confirm("發布目前網站與積木邏輯？")) props.onPublish();
          }}
        >
          發布
        </button>
        <button onClick={props.onExit} aria-label="登出並關閉編輯器">
          離開
        </button>
      </header>
      <section className="scratch-workspace" aria-label="積木組合工作區">
        <div className="scratch-workspace-tools">
          <label className="mode-switch">
            切換模式
            <select
              aria-label="切換模式"
              value="blocks"
              onChange={() => props.onMode()}
            >
              <option value="layers">圖層模式</option>
              <option value="blocks">積木模式</option>
            </select>
          </label>
          <label>
            目前頁面
            <select
              aria-label="積木目前頁面"
              value={page}
              onChange={(e) => props.changePage(e.target.value as SitePage)}
            >
              {Object.entries(pageNames).map(([key, name]) => (
                <option value={key} key={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            縮放
            <select
              aria-label="積木工作區縮放"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            >
              {[...new Set([...zoomLevels, zoom])].sort((a, b) => a - b).map((z) => (
                <option key={z} value={z}>
                  {z * 100}%
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() =>
              addScript(
                40 + (scripts.length % 3) * 350,
                50 + Math.floor(scripts.length / 3) * 140,
              )
            }
          >
            ＋ 物件腳本
          </button>
        </div>
        <div
          ref={workspace}
          className="scratch-scroll"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(mime)) e.preventDefault();
          }}
          onDrop={(e) => {
            const p = payload(e);
            if (!p) return;
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const x =
                (e.clientX - rect.left + e.currentTarget.scrollLeft) / zoom,
              y = (e.clientY - rect.top + e.currentTarget.scrollTop) / zoom;
            if (p.preset) {
              const preset = content.workspace?.presets?.find((a) => a.id === p.preset);
              if (preset) candidateChange((next) => { next.workspace!.nodes.push(...instantiateAssembly(preset, page, null)); });
            } else if (p.object)
              addScript(
                x,
                y,
                target,
                p.object === "existing" ? undefined : (p.object as "frame"),
              );
            else setMessage("先加入物件腳本，再把事件或動作拖入連接位置。");
          }}
        >
          <div className="scratch-plane" style={{ zoom }}>
            {!scripts.length && (
              <div className="scratch-empty">
                <span>01 — 建立物件</span>
                <h2>讓想法，連成互動。</h2>
                <p>
                  從右側拖入「物件圖層」，指定原始內容或新物件。
                  <br />
                  再連接事件、動作與條件；雙擊積木調整屬性。
                </p>
                <button onClick={() => addScript()}>建立第一個腳本</button>
              </div>
            )}
            {scripts.map((s) => (
              <article
                key={s.id}
                className={`scratch-stack ${s.enabled ? "" : "disabled"}`}
                style={{ left: s.x, top: s.y }}
                data-selected={selected?.script === s.id && !selected.block}
                data-script-id={s.id}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes(mime)) return;
                  e.preventDefault(); e.stopPropagation();
                  document.querySelectorAll(".logic-drop-slot.active").forEach((el) => el.classList.remove("active"));
                  magneticSlot(e)?.classList.add("active");
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                    e.currentTarget.querySelectorAll(".active").forEach((el) => el.classList.remove("active"));
                }}
                onDrop={(e) => {
                  const el = magneticSlot(e);
                  e.currentTarget.querySelectorAll(".active").forEach((el) => el.classList.remove("active"));
                  if (!el) { e.preventDefault(); e.stopPropagation(); setMessage("請靠近積木上緣或下緣連接。"); return; }
                  try { insert(e, s.id, el.dataset.parent || null, el.dataset.branch as "children" | "otherwise", Number(el.dataset.index)); }
                  catch (error) { setMessage((error as Error).message); }
                }}
              >
                <div
                  className="scratch-object"
                  tabIndex={0}
                  role="group"
                  aria-label={`編輯物件腳本：${s.name}`}
                  onClick={() => setSelected({ script: s.id })}
                  onFocus={() => setSelected({ script: s.id })}
                  onDoubleClick={() => setEditing({ script: s.id })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setEditing({ script: s.id });
                  }}
                  onPointerDown={(e) => {
                    if (
                      (e.target as Element).closest("button") ||
                      e.button !== 0
                    )
                      return;
                    const el = e.currentTarget.parentElement!;
                    drag.current = {
                      id: s.id,
                      x: s.x,
                      y: s.y,
                      startX: e.clientX,
                      startY: e.clientY,
                      el,
                      dx: 0,
                      dy: 0,
                    };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const d = drag.current;
                    if (!d || d.id !== s.id) return;
                    d.dx = (e.clientX - d.startX) / zoom;
                    d.dy = (e.clientY - d.startY) / zoom;
                    d.el.style.translate = `${d.dx}px ${d.dy}px`;
                  }}
                  onPointerUp={() => {
                    const d = drag.current;
                    drag.current = null;
                    if (!d) return;
                    d.el.style.translate = "";
                    if (Math.abs(d.dx) + Math.abs(d.dy) > 2)
                      modifyScript(s.id, (t) => {
                        t.x = Math.max(0, Math.min(4000, d.x + d.dx));
                        t.y = Math.max(0, Math.min(4000, d.y + d.dy));
                      });
                  }}
                  onPointerCancel={() => {
                    if (drag.current) drag.current.el.style.translate = "";
                    drag.current = null;
                  }}
                >
                  <span>▣ {s.name}</span>
                  <small>
                    {layers.find((l) => l.selection === s.target)?.name ||
                      s.target}
                  </small>
                  <button
                    aria-label={`刪除腳本：${s.name}`}
                    onClick={() =>
                      candidateChange((next) => {
                        next.workspace!.scripts =
                          next.workspace!.scripts!.filter((t) => t.id !== s.id);
                      })
                    }
                  >
                    ×
                  </button>
                </div>
                <div
                  className="scratch-event"
                  onDoubleClick={() => setEditing({ script: s.id })}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes(mime)) e.preventDefault();
                  }}
                  onDrop={(e) => insert(e, s.id, null, "children", 0)}
                >
                  當 {eventLabels[s.event]} {s.event === "key" ? s.key : ""} 時
                </div>
                {renderBlocks(s, s.blocks)}
              </article>
            ))}
          </div>
        </div>
        <div className="scratch-status" role="status">
          {props.error ||
            message ||
            "Alt＋滾輪縮放 · 空格拖曳平移 · Ctrl＋Z 復原 · Ctrl＋D 複製 · Delete 刪除 · 雙擊屬性"}
        </div>
      </section>
      <aside className="scratch-library" aria-label="邏輯積木庫">
        <PanelResizer side="logic" />
        <MiniPreview content={deferredContent} page={page} api={props.api} base={props.base} assets={props.assets} suspended={Boolean(preview || editing)} onRun={() => setPreview(true)} />
        {page === "work" && <WorkLabPanel content={content} update={update} compact />}
        <div className="scratch-library-title">
          <p className="eyebrow">BLOCK LIBRARY</p>
          <h2>把邏輯組起來</h2>
        </div>
        <div className="logic-categories" role="tablist" aria-label="積木分類">
          {logicCategories.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              style={{ "--block-color": c.color } as CSSProperties}
            >
              <i />
              {c.name}
            </button>
          ))}
        </div>
        <div className="logic-library-content">
          <h3 style={{ color: selectedCategory.color }}>
            {selectedCategory.name}
          </h3>
          {category === "objects" && (
            <>
              <label>
                指定網站物件
                <select
                  aria-label="腳本目標物件"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  {layers
                    .filter((l) => !l.deleted)
                    .map((l) => (
                      <option key={l.key} value={l.selection}>
                        {l.name}
                      </option>
                    ))}
                </select>
              </label>
              {(
                [
                  ["existing", "物件圖層 · 指定既有內容"],
                  ["frame", "建立面板圖層"],
                  ["text", "建立文字圖層"],
                  ["link", "建立連結圖層"],
                ] as const
              ).map(([object, label]) => (
                <button
                  key={object}
                  className="library-scratch-block"
                  style={
                    { "--block-color": selectedCategory.color } as CSSProperties
                  }
                  draggable
                  data-logic-payload={JSON.stringify({ object })}
                  onDragStart={(e) => startPayload(e, { object })}
                  onClick={() => setMessage("拖曳此物件至工作區；鍵盤可使用上方「＋ 物件腳本」。")}
                >
                  {label}
                </button>
              ))}
              {content.workspace?.presets?.map((p) => (
                <div className="saved-assembly-row" key={p.id}>
                  <button
                    className="library-scratch-block"
                    draggable
                    data-logic-payload={JSON.stringify({ preset: p.id })}
                    onDragStart={(e) => startPayload(e, { preset: p.id })}
                    onClick={() => setMessage("拖曳組裝至工作區。")}
                  >
                    組裝 · {p.name}
                  </button>
                  <button
                    aria-label={`刪除組裝：${p.name}`}
                    onClick={() =>
                      candidateChange((next) => {
                        next.workspace!.presets =
                          next.workspace!.presets!.filter((a) => a.id !== p.id);
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </>
          )}
          {category === "imports" && (
            <>
              <p>匯入的圖片會建立可編輯圖層和獨立腳本。</p>
              <label className="logic-upload">
                {uploading ? "圖片最佳化與上傳中…" : "＋ 匯入圖片"}
                <input
                  aria-label="積木匯入圖片"
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setUploading(true);
                    try {
                      const image = await props.onImport(file);
                      if (image) addScript(40, 50, target, "image", image);
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </label>
              <button
                className="library-scratch-block"
                draggable
                data-logic-payload={JSON.stringify({ object: "image" })}
                onDragStart={(e) => startPayload(e, { object: "image" })}
                onClick={() => setMessage("拖曳圖片積木至工作區。")}
              >
                圖像匯入 · 圖片網址
              </button>
            </>
          )}
          {category === "events" &&
            Object.entries(eventLabels).map(([event, label]) => (
              <button
                key={event}
                className="library-scratch-block"
                style={
                  { "--block-color": selectedCategory.color } as CSSProperties
                }
                draggable
                data-logic-payload={JSON.stringify({ event })}
                onDragStart={(e) =>
                  startPayload(e, { event: event as LogicScript["event"] })
                }
              >
                當 {label} 時
              </button>
            ))}
          {logicCatalog
            .filter((b) => b.category === category)
            .map((b) => (
              <button
                key={b.op}
                className="library-scratch-block"
                title={b.hint}
                style={
                  { "--block-color": selectedCategory.color } as CSSProperties
                }
                draggable
                data-logic-payload={JSON.stringify({ op: b.op })}
                onDragStart={(e) => startPayload(e, { op: b.op })}
                onClick={() => setMessage("拖曳此積木至腳本連接處。鍵盤可選取腳本後，聚焦積木並按 Enter 插入。")}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || !selected) return;
                  e.preventDefault();
                  modifyScript(selected.script, (script) => script.blocks.push(createLogicBlock(b.op)));
                }}
              >
                {b.label}
                <small>{b.hint}</small>
              </button>
            ))}
          <p className="logic-library-help">
            拖入左側連接槽。條件積木有「符合」與「否則」兩個分支，重複最多 10
            次；執行預覽可直接測試互動。
          </p>
        </div>
      </aside>
      <div className="logic-inventory" ref={inventory} aria-hidden="true">
        <SiteRenderer
          content={content}
          page={page}
          editing
          api={props.api}
          base={props.base}
          privateAssets={props.assets}
        />
      </div>
      {editing && editScript && (
        <Modal
          title={editBlock ? "積木屬性" : "物件與事件"}
          close={() => setEditing(null)}
        >
          <div className="logic-properties">
            {editBlock ? (
              <>
                <h3>
                  {logicCatalog.find((b) => b.op === editBlock.op)?.label}
                </h3>
                {editBlock.op.startsWith("lab-") && <LabBlockFields block={editBlock} change={changeBlock} />}
                {[
                  "text",
                  "link",
                  "color",
                  "text-color",
                  "set-variable",
                  "add-variable",
                  "if-variable",
                ].includes(editBlock.op) && (
                  <label>
                    {editBlock.op.includes("variable")
                      ? "變數名稱"
                      : ["color", "text-color"].includes(editBlock.op)
                        ? "色碼"
                        : "文字或連結"}
                    <input
                      aria-label="積木文字參數"
                      type={["color", "text-color"].includes(editBlock.op) ? "color" : "text"}
                      value={editBlock.value}
                      onChange={(e) => changeBlock({ value: e.target.value })}
                    />
                  </label>
                )}
                {editBlock.op === "animate" && (
                  <label>
                    特效
                    <select
                      aria-label="積木動畫效果"
                      value={editBlock.value}
                      onChange={(e) => changeBlock({ value: e.target.value })}
                    >
                      <option value="fade">柔和淡入</option>
                      <option value="lift">向上浮起</option>
                      <option value="pulse">彈性脈衝</option>
                      <option value="sway">輕微搖擺</option>
                    </select>
                  </label>
                )}
                {!editBlock.op.startsWith("lab-") && ![
                  "text",
                  "color",
                  "text-color",
                  "show",
                  "hide",
                  "toggle",
                  "link",
                  "wait",
                  "animate",
                  "reset-transform",
                  "stop",
                ].includes(editBlock.op) && (
                  <label>
                    數值
                    <input
                      type="number"
                      aria-label="積木數值參數"
                      min={-3000}
                      max={3000}
                      value={editBlock.amount}
                      onChange={(e) =>
                        changeBlock({ amount: Number(e.target.value) })
                      }
                    />
                  </label>
                )}
                {["wait", "animate"].includes(editBlock.op) && (
                  <label>
                    秒數
                    <input
                      type="number"
                      aria-label="積木時間參數"
                      min={0}
                      max={5}
                      step={0.1}
                      value={editBlock.duration}
                      onChange={(e) =>
                        changeBlock({ duration: Number(e.target.value) })
                      }
                    />
                  </label>
                )}
              </>
            ) : (
              <>
                <label>
                  腳本名稱
                  <input
                    aria-label="物件腳本名稱"
                    maxLength={60}
                    value={editScript.name}
                    onChange={(e) =>
                      modifyScript(editScript.id, (s) => {
                        s.name = e.target.value;
                      })
                    }
                  />
                </label>
                <label>
                  目標物件
                  <select
                    aria-label="修改腳本目標"
                    value={editScript.target}
                    onChange={(e) =>
                      modifyScript(editScript.id, (s) => {
                        s.target = e.target.value;
                      })
                    }
                  >
                    {layers
                      .filter((l) => !l.deleted)
                      .map((l) => (
                        <option key={l.key} value={l.selection}>
                          {l.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  觸發事件
                  <select
                    aria-label="修改觸發事件"
                    value={editScript.event}
                    onChange={(e) =>
                      modifyScript(editScript.id, (s) => {
                        s.event = e.target.value as LogicScript["event"];
                      })
                    }
                  >
                    {Object.entries(eventLabels).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                {editScript.event === "key" && (
                  <label>
                    鍵盤按鍵
                    <input
                      aria-label="積木觸發按鍵"
                      value={editScript.key}
                      maxLength={20}
                      onChange={(e) =>
                        modifyScript(editScript.id, (s) => {
                          s.key = e.target.value;
                        })
                      }
                    />
                  </label>
                )}
                <label className="logic-check">
                  <input
                    type="checkbox"
                    checked={editScript.enabled}
                    onChange={(e) =>
                      modifyScript(editScript.id, (s) => {
                        s.enabled = e.target.checked;
                      })
                    }
                  />
                  啟用腳本
                </label>
                <LogicObjectProperties
                  content={content}
                  target={editScript.target}
                  update={candidateChange}
                />
                <button
                  className="logic-copy"
                  onClick={() => {
                    candidateChange((next) =>
                      next.workspace!.scripts!.push(
                        duplicateLogicScript(editScript),
                      ),
                    );
                    setEditing(null);
                  }}
                >
                  複製腳本並重用
                </button>
              </>
            )}
            <button className="logic-done" onClick={() => setEditing(null)}>
              完成
            </button>
          </div>
        </Modal>
      )}
      {preview && (
        <Modal
          title="互動執行預覽"
          className="logic-preview-modal"
          close={() => setPreview(false)}
        >
          <LogicPreview {...props} />
        </Modal>
      )}
    </div>
  );
}
