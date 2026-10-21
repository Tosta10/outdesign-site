import {
  memo,
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
  findLogicBlock,
  extractLogicBlock,
  duplicateLogicScript,
  isContainer,
  type LogicOp,
} from "../lib/logic";
import { collectLayers, type LayerItem } from "../lib/layers";
import { createCanvasNode } from "../lib/workspace";
import {
  SiteRenderer,
  pageNames,
  type SitePage,
} from "../components/SiteRenderer";
import { initViewer } from "../lib/viewer";
import { PanelResizer } from "./ResizablePanels";
import { LogicObjectProperties } from "./LogicObjectProperties";
const mime = "application/outdesign-logic";
type Payload = {
  op?: LogicOp;
  script?: string;
  block?: string;
  event?: LogicScript["event"];
  object?: string;
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
  const inventory = useRef<HTMLDivElement>(null),
    workspace = useRef<HTMLDivElement>(null);
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
      if (p.block === parentId) return;
      let block: LogicBlock | undefined;
      if (p.op) block = createLogicBlock(p.op);
      else if (p.block && p.script) {
        const source = next.workspace?.scripts?.find((s) => s.id === p.script);
        if (source) block = extractLogicBlock(source.blocks, p.block);
      }
      if (!block) return;
      const list = parentId
        ? findLogicBlock(script.blocks, parentId)?.[branch]
        : script.blocks;
      // Moving a container into its descendant is discarded by leaving the draft unchanged.
      if (!list) throw new Error("無法將積木放入自己的內部");
      list.splice(Math.min(index, list.length), 0, block);
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
          <div key={b.id} className="logic-block-unit">
            <div
              className={`scratch-block category-${def.category} ${isContainer(b.op) ? "c-block" : ""}`}
              style={{ "--block-color": cat.color } as CSSProperties}
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                startPayload(e, { script: s.id, block: b.id });
              }}
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
                {b.op.includes("variable")
                  ? `${b.value} ${b.op === "if-variable" ? "≥" : b.op === "add-variable" ? "+" : "="} ${b.amount}`
                  : ["color", "text", "animate", "link"].includes(b.op)
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
  const selectedCategory = logicCategories.find((c) => c.id === category)!;
  return (
    <div className="scratch-studio">
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
              {[0.5, 0.75, 1, 1.25].map((z) => (
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
            if (p.object)
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
                data-script-id={s.id}
              >
                <div
                  className="scratch-object"
                  tabIndex={0}
                  role="group"
                  aria-label={`編輯物件腳本：${s.name}`}
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
            "拖曳積木至連接槽 · 雙擊編輯屬性 · 拖曳紫色物件標頭移動腳本"}
        </div>
      </section>
      <aside className="scratch-library" aria-label="邏輯積木庫">
        <PanelResizer side="logic" />
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
                  onDragStart={(e) => startPayload(e, { object })}
                  onClick={() =>
                    addScript(
                      40 + (scripts.length % 3) * 350,
                      50 + Math.floor(scripts.length / 3) * 150,
                      target,
                      object === "existing" ? undefined : object,
                    )
                  }
                >
                  {label}
                </button>
              ))}
              {content.workspace?.presets?.map((p) => (
                <div className="saved-assembly-row" key={p.id}>
                  <button
                    className="library-scratch-block"
                    onClick={async () => {
                      const { instantiateAssembly } = await import(
                        "../lib/assemblies"
                      );
                      candidateChange((next) =>
                        next.workspace!.nodes.push(
                          ...instantiateAssembly(p, page, null),
                        ),
                      );
                    }}
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
                onDragStart={(e) => startPayload(e, { object: "image" })}
                onClick={() => addScript(40, 50, target, "image")}
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
                onDragStart={(e) => startPayload(e, { op: b.op })}
                onClick={() => {
                  if (!scripts.length) {
                    setMessage("先建立物件腳本，再拖入動作。");
                    return;
                  }
                  modifyScript(scripts.at(-1)!.id, (s) =>
                    s.blocks.push(createLogicBlock(b.op)),
                  );
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
                {[
                  "text",
                  "link",
                  "color",
                  "set-variable",
                  "add-variable",
                  "if-variable",
                ].includes(editBlock.op) && (
                  <label>
                    {editBlock.op.includes("variable")
                      ? "變數名稱"
                      : editBlock.op === "color"
                        ? "色碼"
                        : "文字或連結"}
                    <input
                      aria-label="積木文字參數"
                      type={editBlock.op === "color" ? "color" : "text"}
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
                {![
                  "text",
                  "color",
                  "show",
                  "hide",
                  "toggle",
                  "link",
                  "wait",
                  "animate",
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
