import { instantiateAssembly } from "../lib/assemblies";
import { descendants } from "../lib/workspace";
import {
  memo,
  useDeferredValue,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  SiteContent,
  Selection,
} from "../../supabase/functions/_shared/schema.ts";
import {
  collectAssetIds,
  contentSchema,
} from "../../supabase/functions/_shared/schema.ts";
import type { Draft, Media } from "../../supabase/functions/_shared/store.ts";
import {
  SiteRenderer,
  pageNames,
  type SitePage,
} from "../components/SiteRenderer";
import { defaultSections } from "../components/ContentSection";
import { BlockLibrary, blockMime } from "./BlockLibrary";
import {
  createBlockRecipe,
  blockRecipes,
  type BlockRecipe,
} from "../lib/blocks";
import { ElementStylePanel } from "./ElementStylePanel";
import { PresentationPanel } from "./PresentationPanel";
import { copyDefaults } from "../lib/presentation";
import { WorkspacePanel, LayerTree } from "./WorkspacePanel";
import { ScopedCode } from "./ScopedCode";
import { useFreeLayout } from "./useFreeLayout";
import { selectedForPage } from "../lib/workspace";
import { useCanvasDrag } from "./useCanvasDrag";
import { Icon } from "../components/Icon";
import { initViewer } from "../lib/viewer";
import { ApiError, prepareUpload, StudioApi } from "./api";
import { Auth } from "./Auth";
import { CodePanel, InteractionsPanel } from "./advanced";
import { ContentPanel, ThemePanel } from "./panels";

const MemoSiteRenderer = memo(SiteRenderer);

type PublishResult = {
  version: string;
  deployment: string;
  message: string;
  runId?: number;
  runUrl?: string;
};
export function Studio({
  apiBase,
  base,
  onClose,
  onAuthenticated,
}: {
  apiBase: string;
  base: string;
  onClose: (reload?: boolean) => void;
  onAuthenticated: () => void;
}) {
  const api = useMemo(() => new StudioApi(apiBase), [apiBase]);
  const [session, setSession] = useState<{
      token: string;
      expiresAt: number;
    } | null>(null),
    [reason, setReason] = useState("");
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () => {
        api.token = "";
        setReason("工作階段已到期，請重新登入。");
        setSession(null);
      },
      Math.max(0, session.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [session]);
  if (!session)
    return (
      <Auth
        api={api}
        reason={reason}
        onClose={() => onClose()}
        onLogin={(token, expiresAt) => {
          api.token = token;
          setSession({ token, expiresAt });
          onAuthenticated();
        }}
      />
    );
  return (
    <Editor
      api={api}
      base={base}
      onClose={onClose}
      onExpire={() => {
        api.token = "";
        setReason("工作階段已到期，請重新登入。");
        setSession(null);
      }}
    />
  );
}

function Editor({
  api,
  base,
  onClose,
  onExpire,
}: {
  api: StudioApi;
  base: string;
  onClose: (reload?: boolean) => void;
  onExpire: () => void;
}) {
  const [content, setContent] = useState<SiteContent | null>(null),
    [selection, setSelection] = useState<Selection>("hero"),
    [tab, setTab] = useState<
      "content" | "theme" | "media" | "interactions" | "code" | "layout"
    >("content");
  const [panelOpen, setPanelOpen] = useState(true),
    [preview, setPreview] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [page, setPage] = useState<SitePage>(
    (document.body.dataset.page as SitePage) || "home",
  );
  const [layersOpen, setLayersOpen] = useState(false);
  const [blockMode, setBlockMode] = useState(false);
  const deferredContent = useDeferredValue(content);
  const editGroup = useRef({ key: "", time: 0 });
  const [device, setDevice] = useState("auto"),
    [zoom, setZoom] = useState(1),
    [snap, setSnap] = useState(true);
  const codeDirty = useRef(false);
  function discardCode() {
    if (!codeDirty.current) return true;
    if (!window.confirm("代碼尚未套用，確定捨棄並離開程式碼工作區？"))
      return false;
    codeDirty.current = false;
    return true;
  }
  function changeTab(
    value: "content" | "theme" | "media" | "interactions" | "code" | "layout",
  ) {
    if (discardCode()) setTab(value);
  }
  function changePage(value: SitePage) {
    if (!discardCode()) return;
    setPage(value);
    if (current.current)
      setSelection(selectedForPage(current.current, value) as Selection);
    setTab("content");
  }
  function selectLayer(value: Selection) {
    if (!discardCode()) return;
    setSelection(value);
    if (innerWidth <= 1000) setLayersOpen(false);
    setTab(
      value === "settings"
        ? "theme"
        : value.startsWith("node:")
          ? "layout"
          : "content",
    );
    setPanelOpen(true);
    requestAnimationFrame(() =>
      document
        .querySelector(".panel-scroll")
        ?.scrollTo({ top: 0, behavior: "instant" }),
    );
  }
  function replaceContent(next: SiteContent) {
    apply(next);
  }
  function closePanel() {
    if (discardCode()) setPanelOpen(false);
  }

  const [saveState, setSaveState] = useState<
      "saved" | "dirty" | "saving" | "error"
    >("saved"),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false);
  const [media, setMedia] = useState<Media[]>([]),
    [assets, setAssets] = useState<Record<string, string>>({}),
    [history, setHistory] = useState<{ id: string; createdAt: string }[]>([]);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(
      null,
    ),
    [showPublish, setShowPublish] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const currentSignature = useRef("");
  const alive = useRef(true);
  const assetCache = useRef(new Map<string, string>());
  const current = useRef<SiteContent | null>(null),
    revision = useRef(0),
    saved = useRef(""),
    conflicts = useRef(false),
    undo = useRef<SiteContent[]>([]),
    redo = useRef<SiteContent[]>([]);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve()),
    view = useRef<HTMLDivElement>(null),
    objectUrls = useRef<string[]>([]),
    confirmDialog = useRef<HTMLDialogElement>(null);
  const wasPublished = useRef(false),
    saveRef = useRef<() => Promise<void>>(async () => {});
  const fail = useCallback(
    (e: unknown) => {
      const message = e instanceof Error ? e.message : "操作失敗，請稍後重試";
      setError(message);
      if (e instanceof ApiError && e.status === 401) onExpire();
    },
    [onExpire],
  );
  async function cacheMedia(items: Media[], needed: string[]) {
    const pairs = await Promise.allSettled(
      items
        .filter((m) => needed.includes(m.id))
        .map(async (m) => {
          const cached = assetCache.current.get(m.id);
          if (cached) return [m.id, cached] as const;
          const blob = await api.mediaBlob(m.id);
          if (!alive.current) throw new Error("Editor closed");
          const url = URL.createObjectURL(blob);
          objectUrls.current.push(url);
          assetCache.current.set(m.id, url);
          return [m.id, url] as const;
        }),
    );
    const mapped = Object.fromEntries(
      pairs.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
    );
    setAssets((previous) => ({ ...previous, ...mapped }));
  }
  async function load() {
    setError("");
    try {
      const [draft, files, versions] = await Promise.all([
        api.request<Draft>("/draft"),
        api.request<{ media: Media[] }>("/media"),
        api.request<{ versions: { id: string; createdAt: string }[] }>(
          "/history",
        ),
      ]);
      current.current = draft.content;
      revision.current = draft.revision;
      saved.current = JSON.stringify(draft.content);
      currentSignature.current = saved.current;
      conflicts.current = false;
      setContent(draft.content);
      setSelection(selectedForPage(draft.content, page) as Selection);
      setMedia(files.media);
      setHistory(versions.versions);
      setSaveState("saved");
      await cacheMedia(files.media, collectAssetIds(draft.content, true));
    } catch (e) {
      fail(e);
    }
  }
  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
      objectUrls.current.forEach(URL.revokeObjectURL);
      assetCache.current.clear();
    };
  }, []);
  useEffect(() => {
    if (!view.current || !content || !preview) return;
    return initViewer(view.current);
  }, [deferredContent, preview, assets, page]);
  useEffect(() => {
    if (!content) return;
    document.title = 'OutDesign';
  }, [content?.settings.name]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (
        codeDirty.current ||
        (current.current && currentSignature.current !== saved.current)
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  function apply(next: SiteContent, remember = true) {
    const signature = JSON.stringify(next);
    if (!current.current || signature === currentSignature.current) return;
    const focused = document.activeElement as HTMLInputElement | null;
    const typing =
      focused &&
      ["INPUT", "TEXTAREA"].includes(focused.tagName) &&
      !["checkbox", "file"].includes(focused.type);
    const group = typing
      ? `${selection}:${tab}:${focused.getAttribute("aria-label") || focused.closest("label")?.textContent}`
      : "";
    const now = performance.now();
    const coalesce = Boolean(
      group &&
      group === editGroup.current.key &&
      now - editGroup.current.time < 650,
    );
    editGroup.current = { key: group, time: now };
    if (remember && !coalesce) {
      undo.current.push(current.current);
      if (undo.current.length > 50) undo.current.shift();
      redo.current = [];
    }
    current.current = next;
    currentSignature.current = signature;
    setContent(next);
    setHistoryTick((t) => t + 1);
    setSaveState("dirty");
    setError("");
  }
  function update(edit: (next: SiteContent) => void) {
    if (!current.current) return;
    const next = structuredClone(current.current);
    edit(next);
    apply(next);
  }
  function moveBlock(from: string, to: string) {
    const [kind, fromId] = from.split(":"),
      [targetKind, toId] = to.split(":");
    if (kind !== targetKind || fromId === toId) return;
    update((next) => {
      if (kind === "node") {
        const list = next.workspace?.nodes;
        if (!list) return;
        const a = list.findIndex((node) => node.id === fromId),
          b = list.findIndex((node) => node.id === toId);
        if (
          a < 0 ||
          b < 0 ||
          list[a].locked ||
          list[a].parent !== list[b].parent ||
          list[a].page !== list[b].page
        )
          return;
        list.splice(b, 0, list.splice(a, 1)[0]);
      } else if (kind === "section") {
        const sections = [...(next.layout?.sections || defaultSections)];
        const a = sections.indexOf(fromId as (typeof sections)[number]),
          b = sections.indexOf(toId as (typeof sections)[number]);
        if (a < 0 || b < 0) return;
        sections.splice(b, 0, sections.splice(a, 1)[0]);
        next.layout = { sections };
      } else if (kind === "project") {
        const a = next.projects.findIndex((p) => p.id === fromId),
          b = next.projects.findIndex((p) => p.id === toId);
        if (a >= 0 && b >= 0)
          next.projects.splice(b, 0, next.projects.splice(a, 1)[0]);
      } else if (kind === "note") {
        const a = next.notes.findIndex((n) => n.id === fromId),
          b = next.notes.findIndex((n) => n.id === toId);
        if (a >= 0 && b >= 0)
          next.notes.splice(b, 0, next.notes.splice(a, 1)[0]);
      }
    });
  }
  function stepBlock(id: string, direction: number) {
    if (!current.current) return;
    const [kind, item] = id.split(":"),
      c = current.current;
    const ids =
      kind === "node"
        ? (c.workspace?.nodes || [])
            .filter(
              (node) =>
                node.page === page &&
                node.parent ===
                  c.workspace?.nodes.find((node) => node.id === item)?.parent,
            )
            .map((node) => node.id)
        : kind === "section"
          ? (c.layout?.sections || defaultSections).filter((key) =>
              (
                ({
                  home: [],
                  work: ["work"],
                  journal: ["notes"],
                  about: ["about", "contact"],
                  resources: ["attachments"],
                }) as Record<SitePage, string[]>
              )[page].includes(key),
            )
          : kind === "project"
            ? c.projects.map((p) => p.id)
            : c.notes.map((n) => n.id);
    const index = ids.indexOf(item as never),
      target = ids[index + direction];
    if (target) {
      moveBlock(id, `${kind}:${target}`);
      setNotice("區塊位置已更新，正在自動儲存。");
    }
  }
  useCanvasDrag(
    view,
    Boolean(content && !preview),
    moveBlock,
    stepBlock,
    setNotice,
  );
  useFreeLayout(
    view,
    Boolean(content && !preview),
    content?.workspace?.nodes || [],
    (id, patch) =>
      update((next) => {
        const node = next.workspace?.nodes.find((node) => node.id === id);
        if (node) Object.assign(node, patch);
      }),
    (id) => setSelection(`node:${id}`),
    snap,
  );
  function insertRecipe(
    recipe: BlockRecipe | `preset:${string}`,
    droppedParent?: string | null,
  ) {
    if (!current.current || !discardCode()) return;
    const selectedNode = current.current.workspace?.nodes.find(
      (n) => `node:${n.id}` === selection,
    );
    const parent =
      droppedParent !== undefined
        ? droppedParent
        : selectedNode?.type === "frame"
          ? selectedNode.id
          : selectedNode?.parent || null;
    const preset = recipe.startsWith("preset:")
      ? current.current.workspace?.presets?.find(
          (p) => p.id === recipe.slice(7),
        )
      : undefined;
    if (recipe.startsWith("preset:") && !preset) return;
    const nodes = preset
      ? instantiateAssembly(preset, page, parent)
      : createBlockRecipe(recipe as BlockRecipe, page, parent);
    const candidate = structuredClone(current.current);
    candidate.workspace ||= { nodes: [] };
    candidate.workspace.nodes.push(...nodes);
    if (!contentSchema.safeParse(candidate).success) {
      setNotice("此位置超過積木上限或六層深度，請選擇較外層的面板。");
      return;
    }
    if ((current.current.workspace?.nodes.length || 0) + nodes.length > 100) {
      setNotice("網站積木已達上限，請先整理圖層。");
      return;
    }
    update((next) => {
      next.workspace ||= { nodes: [] };
      next.workspace.nodes.push(...nodes);
    });
    selectLayer(`node:${nodes[0].id}`);
    setNotice(`已插入${nodes[0].name}，可拆解、重排與復原。`);
    requestAnimationFrame(() =>
      view.current
        ?.querySelector(`[data-node-id="${nodes[0].id}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  }
  const saveNow = () => {
    const job = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        if (!current.current || currentSignature.current === saved.current)
          return;
        if (conflicts.current)
          throw new Error("草稿有版本衝突，請重新載入後再儲存。");
        // Immutable snapshots are reused; update() always clones before mutation.
        const document = current.current,
          signature = currentSignature.current;
        const valid = contentSchema.safeParse(document);
        if (!valid.success) {
          setSaveState("error");
          throw new Error(
            `請完成內容欄位：${valid.error.issues[0].path.join(".")} · ${valid.error.issues[0].message}`,
          );
        }
        setSaveState("saving");
        try {
          const result = await api.request<Draft>("/draft", {
            method: "PATCH",
            body: JSON.stringify({
              content: document,
              revision: revision.current,
            }),
          });
          revision.current = result.revision;
          saved.current = signature;
          setSaveState(
            currentSignature.current === signature ? "saved" : "dirty",
          );
        } catch (e) {
          if (e instanceof ApiError && e.status === 409)
            conflicts.current = true;
          setSaveState("error");
          throw e;
        }
      });
    saveQueue.current = job;
    return job;
  };
  saveRef.current = saveNow;
  useEffect(() => {
    if (!content || currentSignature.current === saved.current) return;
    const timer = setTimeout(() => {
      saveRef.current().catch(fail);
    }, 1200);
    return () => clearTimeout(timer);
  }, [content]);
  useEffect(() => {
    if (!publishResult?.runId || publishResult.deployment !== "queued") return;
    const timer = setInterval(async () => {
      try {
        const state = await api.request<{
          status: string;
          conclusion: string | null;
        }>("/deployment?run=" + publishResult.runId);
        if (state.status === "completed")
          setPublishResult((p) =>
            p
              ? {
                  ...p,
                  deployment:
                    state.conclusion === "success" ? "success" : "failed",
                  message:
                    state.conclusion === "success"
                      ? "部署完成，公開網站已更新。"
                      : "部署未完成，公開網站保留原版本。請查看建置紀錄。",
                }
              : null,
          );
      } catch {
        /* A transient status read must not claim deployment success. */
      }
    }, 15_000);
    return () => clearInterval(timer);
  }, [publishResult?.runId, publishResult?.deployment]);
  useEffect(() => {
    if (showPublish && confirmDialog.current && !confirmDialog.current.open)
      confirmDialog.current.showModal();
  }, [showPublish]);
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current().catch(fail);
      }
      if (e.key === "Escape" && !showPublish) closePanel();
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [showPublish]);
  async function exit() {
    if (!discardCode()) return;
    if (
      current.current &&
      JSON.stringify(current.current) !== saved.current &&
      !window.confirm("仍有未儲存的修改，確定離開？")
    )
      return;
    try {
      await api.request("/logout", { method: "POST" });
      api.token = "";
      onClose(wasPublished.current);
    } catch (e) {
      fail(e);
    }
  }
  async function publish(retry = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      let result: PublishResult;
      if (retry && publishResult)
        result = await api.request("/deploy", {
          method: "POST",
          body: JSON.stringify({ version: publishResult.version }),
        });
      else {
        await saveRef.current();
        result = await api.request("/publish", {
          method: "POST",
          body: JSON.stringify({ revision: revision.current }),
        });
      }
      setPublishResult(result);
      wasPublished.current = result.deployment === "local";
      setShowPublish(false);
      confirmDialog.current?.close();
      const versions = await api.request<{
        versions: { id: string; createdAt: string }[];
      }>("/history");
      setHistory(versions.versions);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      const prepared = await prepareUpload(file);
      const form = new FormData();
      form.append("file", prepared);
      const result = await api.request<{ media: Media }>("/media", {
        method: "POST",
        body: form,
      });
      if (!alive.current) return;
      setMedia((previous) => [result.media, ...previous]);
      const objectUrl = URL.createObjectURL(prepared);
      objectUrls.current.push(objectUrl);
      assetCache.current.set(result.media.id, objectUrl);
      setAssets((previous) => ({ ...previous, [result.media.id]: objectUrl }));
      setNotice("素材已上傳，選擇「套用」後加入內容。");
    } catch (e) {
      fail(e);
    } finally {
      setUploading(false);
    }
  }
  async function useMedia(m: Media) {
    if (m.kind === "file" && (current.current?.attachments.length || 0) >= 20) {
      setError("附件最多 20 個，請先移除不需要的連結。");
      return;
    }
    if (!assets[m.id]) {
      try {
        const blob = await api.mediaBlob(m.id);
        if (!alive.current) return;
        const objectUrl = URL.createObjectURL(blob);
        objectUrls.current.push(objectUrl);
        assetCache.current.set(m.id, objectUrl);
        setAssets((previous) => ({ ...previous, [m.id]: objectUrl }));
      } catch (e) {
        fail(e);
        return;
      }
    }
    const value = `asset:${m.id}`;
    update((next) => {
      if (m.kind === "audio") {
        next.music.url = value;
        next.music.title = m.name.replace(/\.[^.]+$/, "");
        next.settings.showMusic = true;
        setSelection("music");
        setPage("about");
      } else if (m.kind === "image") {
        const project =
          selection.startsWith("project:") &&
          next.projects.find((p) => p.id === selection.slice(8));
        const canvasImage =
          selection.startsWith("node:") &&
          next.workspace?.nodes.find(
            (node) => node.id === selection.slice(5) && node.type === "image",
          );
        if (canvasImage) canvasImage.image = value;
        else if (project) project.image = value;
        else if (selection === "settings") {
          next.presentation ||= {};
          next.presentation.logo = value;
        } else if (selection === "about") {
          next.presentation ||= {};
          next.presentation.missionImage = value;
        } else {
          next.hero.image = value;
          setSelection("hero");
          setPage("home");
        }
      } else {
        setPage("resources");
        setSelection("attachments");
        next.attachments.push({
          id: crypto.randomUUID(),
          name: m.name,
          url: value,
          label: `${(m.size / 1_000_000).toFixed(1)} MB`,
        });
      }
    });
    changeTab(
      selection.startsWith("node:") && m.kind === "image"
        ? "layout"
        : "content",
    );
    setNotice("素材已套用至草稿。");
  }
  async function removeMedia(m: Media) {
    try {
      await api.request(`/media/${m.id}`, { method: "DELETE" });
      setMedia((previous) => previous.filter((x) => x.id !== m.id));
      const url = assetCache.current.get(m.id);
      if (url) URL.revokeObjectURL(url);
      assetCache.current.delete(m.id);
      setAssets((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([id]) => id !== m.id),
        ),
      );
      setNotice("未使用的素材已刪除。");
    } catch (e) {
      fail(e);
    }
  }
  async function restore(id: string) {
    try {
      const result = await api.request<{ content: SiteContent }>(
        `/history/${id}`,
      );
      const restored = structuredClone(result.content);
      const presets = current.current?.workspace?.presets;
      if (presets?.length) {
        restored.workspace ||= { nodes: [] };
        restored.workspace.presets = structuredClone(presets);
      }
      apply(restored);
      setNotice("歷史版本已載入草稿，發布後才會更新網站。");
      setHistoryOpen(false);
    } catch (e) {
      fail(e);
    }
  }
  function exportContent() {
    if (!current.current) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(current.current, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "outdesign-content.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importContent(file: File) {
    try {
      if (file.size > 256_000) throw new Error("備份檔案過大");
      const parsed = contentSchema.parse(JSON.parse(await file.text()));
      apply(parsed);
      setNotice("備份已匯入草稿，尚未發布。");
    } catch {
      setError("備份格式不正確，請選擇此網站匯出的 JSON 檔案。");
    }
  }
  if (!content)
    return (
      <div className="studio-loading" role="status">
        <Icon name="lock" size={30} />
        <h2>正在開啟你的空間…</h2>
        {error && (
          <p className="studio-error" role="alert">
            {error}
          </p>
        )}
        <div>
          <button className="button" onClick={load}>
            重新載入
          </button>
          <button className="button" onClick={exit}>
            離開
          </button>
        </div>
      </div>
    );
  const selectedProject = selection.startsWith("project:")
    ? content.projects.find((p) => p.id === selection.slice(8))
    : null;
  const saveLabels = {
    saved: "所有修改已儲存",
    dirty: "有未儲存的修改",
    saving: "正在儲存…",
    error: "尚未儲存",
  };
  return (
    <div
      className={`editor-shell ${blockMode ? "blueprint-mode" : ""} ${panelOpen ? "panel-open" : ""} ${!preview ? "has-layers" : ""} ${layersOpen ? "layers-open" : ""}`}
      data-history-tick={historyTick}
      data-preview-pending={content !== deferredContent}
    >
      <header className="editor-topbar">
        <div className="editor-title">
          <span>{content.settings.name}</span>
          <span className="editor-badge">作者模式</span>
        </div>
        <select
          className="editor-page-select"
          aria-label="預覽頁面"
          value={page}
          onChange={(event) => changePage(event.target.value as SitePage)}
        >
          {Object.entries(pageNames).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className={`save-status status-${saveState}`} role="status">
          <span />
          {saveLabels[saveState]}
        </p>
        <div className="editor-top-actions">
          <button
            className="icon-button"
            aria-label="復原上一步"
            title="復原"
            disabled={!undo.current.length}
            onClick={() => {
              if (!undo.current.length || !current.current) return;
              redo.current.push(current.current);
              apply(undo.current.pop()!, false);
            }}
          >
            <Icon name="undo" size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="重做"
            title="重做"
            disabled={!redo.current.length}
            onClick={() => {
              if (!redo.current.length || !current.current) return;
              undo.current.push(current.current);
              apply(redo.current.pop()!, false);
            }}
          >
            <Icon name="redo" size={17} />
          </button>
          <span className="topbar-divider" />
          <button
            className="editor-small-button preview-toggle"
            aria-pressed={preview}
            onClick={() => setPreview((p) => !p)}
          >
            <Icon name={preview ? "edit" : "eye"} size={15} />
            <span>{preview ? "繼續編輯" : "預覽"}</span>
          </button>
          <button
            className="editor-small-button panel-toggle"
            aria-expanded={panelOpen}
            onClick={() => {
              if (panelOpen) closePanel();
              else setPanelOpen(true);
            }}
          >
            <Icon name="menu" size={16} />
            <span>面板</span>
          </button>
          <button
            className="editor-small-button save-button"
            onClick={() => saveRef.current().catch(fail)}
            disabled={saveState === "saving" || saveState === "saved"}
          >
            儲存
          </button>
          <button
            className="editor-publish"
            onClick={() => setShowPublish(true)}
            disabled={busy}
          >
            發布
            <Icon name="diagonal" size={13} />
          </button>
          <button
            className="icon-button"
            onClick={exit}
            aria-label="登出並關閉編輯器"
            title="登出"
          >
            <Icon name="logout" size={17} />
          </button>
        </div>
      </header>
      {!preview && (
        <aside className="editor-layers" aria-label="頁面與圖層">
          <div className="studio-modes" role="group" aria-label="編輯模式">
            <button
              aria-pressed={!blockMode}
              onClick={() => setBlockMode(false)}
            >
              圖層
            </button>
            <button
              aria-pressed={blockMode}
              onClick={() => {
                setBlockMode(true);
              }}
            >
              積木模式
            </button>
          </div>
          {blockMode && (
            <BlockLibrary
              insert={insertRecipe}
              presets={content.workspace?.presets}
              removePreset={(id) =>
                update((next) => {
                  next.workspace!.presets = next.workspace!.presets?.filter(
                    (p) => p.id !== id,
                  );
                })
              }
              remaining={100 - (content.workspace?.nodes.length || 0)}
            />
          )}
          <div className="layers-title">
            <span>LAYERS</span>
            <span>長按拖曳</span>
          </div>

          <p className="layer-section-label">頁面區塊</p>
          <div className="layer-blocks">
            {(content.layout?.sections || defaultSections)
              .filter((key) =>
                (
                  ({
                    home: [],
                    work: ["work"],
                    journal: ["notes"],
                    about: ["about", "contact"],
                    resources: ["attachments"],
                  }) as Record<SitePage, string[]>
                )[page].includes(key),
              )
              .map((key, index, list) => (
                <div key={key}>
                  <button
                    onClick={() => {
                      selectLayer(
                        {
                          work: content.projects[0]
                            ? `project:${content.projects[0].id}`
                            : "projects",
                          notes: content.notes[0]
                            ? `note:${content.notes[0].id}`
                            : "notes",
                          about: "about",
                          contact: "contact",
                          attachments: "attachments",
                        }[key] as Selection,
                      );
                      requestAnimationFrame(() => {
                        const node = view.current?.querySelector<HTMLElement>(
                          `[data-layout="section:${key}"]`,
                        );
                        node?.scrollIntoView({
                          block: "center",
                          behavior: window.matchMedia(
                            "(prefers-reduced-motion: reduce)",
                          ).matches
                            ? "auto"
                            : "smooth",
                        });
                      });
                    }}
                  >
                    {
                      {
                        work: "作品",
                        notes: "筆記",
                        about: "關於",
                        attachments: "附件",
                        contact: "聯絡",
                      }[key]
                    }
                  </button>
                  <button
                    aria-label={`上移區塊：${key}`}
                    disabled={index === 0}
                    onClick={() => stepBlock(`section:${key}`, -1)}
                  >
                    <Icon name="up" size={12} />
                  </button>
                  <button
                    aria-label={`下移區塊：${key}`}
                    disabled={index === list.length - 1}
                    onClick={() => stepBlock(`section:${key}`, 1)}
                  >
                    <Icon name="down" size={12} />
                  </button>
                </div>
              ))}
          </div>
          {page === "home" && (
            <button className="node-layer" onClick={() => selectLayer("hero")}>
              首頁主視覺
            </button>
          )}
          {page === "home" && (
            <>
              <button
                className="node-layer"
                onClick={() => selectLayer("about")}
              >
                介紹卡片
              </button>
            </>
          )}
          <button
            className="node-layer"
            onClick={() => selectLayer("settings")}
          >
            品牌與全站設定
          </button>
          {page === "work" &&
            content.projects.map((item) => (
              <button
                key={item.id}
                className="node-layer"
                aria-label={`選取圖層：${item.title}`}
                onClick={() => selectLayer(`project:${item.id}`)}
              >
                {item.title}
              </button>
            ))}
          {page === "journal" &&
            content.notes.map((item) => (
              <button
                key={item.id}
                className="node-layer"
                aria-label={`選取圖層：${item.title}`}
                onClick={() => selectLayer(`note:${item.id}`)}
              >
                {item.title}
              </button>
            ))}
          {page === "about" && (
            <button className="node-layer" onClick={() => selectLayer("music")}>
              音樂播放器
            </button>
          )}
          <p className="layer-section-label">自訂圖層</p>
          <LayerTree
            content={content}
            page={page}
            selected={selection}
            select={selectLayer}
          />
          <button
            className="node-layer"
            onClick={() => {
              changeTab("layout");
              setPanelOpen(true);
            }}
          >
            ＋ 新增面板／佈局
          </button>
          <div className="layers-help">
            <Icon name="edit" size={15} />
            <p>
              點選畫布編輯內容。
              <br />
              長按 ⠿ 拖曳排序，
              <br />
              也可使用方向鍵。
            </p>
          </div>
        </aside>
      )}
      <div
        className="editor-canvas"
        ref={view}
        onAuxClickCapture={(event) => {
          if (!preview) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onDragStart={(event) => event.preventDefault()}
        onDragOver={(event) => {
          if (!preview && event.dataTransfer.types.includes(blockMime)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(event) => {
          const recipe = event.dataTransfer.getData(blockMime);
          if (!preview && blockRecipes.some((r) => r.id === recipe)) {
            event.preventDefault();
            const id = (event.target as Element).closest<HTMLElement>(
              ".node-frame",
            )?.dataset.nodeId;
            insertRecipe(recipe as BlockRecipe, id || null);
          }
        }}
        onKeyDownCapture={(event) => {
          if (
            !preview &&
            ["Enter", " "].includes(event.key) &&
            !(event.target as Element).closest(
              "[data-drag-handle],[data-free-move],[data-free-resize],[data-delete-node]",
            )
          ) {
            event.preventDefault();
            event.stopPropagation();
            const edit = (event.target as Element).closest<HTMLElement>(
              "[data-edit]",
            )?.dataset.edit;
            if (edit) selectLayer(edit as Selection);
          }
        }}
        onClickCapture={(event) => {
          const target = event.target as Element;
          if (preview) {
            const link = target.closest<HTMLElement>("[data-page-target]");
            if (link?.dataset.pageTarget) {
              event.preventDefault();
              event.stopPropagation();
              changePage(link.dataset.pageTarget as SitePage);
            }
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const deleteId =
            target.closest<HTMLElement>("[data-delete-node]")?.dataset
              .deleteNode;
          if (deleteId && current.current?.workspace) {
            const node = current.current.workspace.nodes.find(
              (n) => n.id === deleteId,
            );
            if (node && !node.locked) {
              const ids = new Set([
                node.id,
                ...descendants(current.current.workspace.nodes, node.id),
              ]);
              update((next) => {
                next.workspace!.nodes = next.workspace!.nodes.filter(
                  (n) => !ids.has(n.id),
                );
              });
              selectLayer(node.parent ? `node:${node.parent}` : "settings");
              setNotice("面板已刪除，可使用頂部復原。");
            }
            return;
          }

          if (
            target.closest(
              "[data-drag-handle],[data-free-move],[data-free-resize]",
            )
          )
            return;
          const edit = target.closest<HTMLElement>("[data-edit]")?.dataset.edit;
          if (edit) {
            selectLayer(edit as Selection);
            const field =
              target.closest<HTMLElement>("[data-field]")?.dataset.field;
            if (field)
              requestAnimationFrame(() => {
                const input = [
                  ...document.querySelectorAll<HTMLInputElement>(
                    ".editor-panel input,.editor-panel textarea",
                  ),
                ].find((el) => el.getAttribute("aria-label") === field);
                input?.focus({ preventScroll: true });
                input?.select();
              });
          }
        }}
      >
        <div
          className={`canvas-stage ${snap ? "show-grid" : ""}`}
          style={{ width: device === "auto" ? "100%" : `${device}px`, zoom }}
        >
          <MemoSiteRenderer
            content={deferredContent || content}
            api={api.base}
            base={base}
            editing={!preview}
            selected={selection}
            privateAssets={assets}
            page={page}
          />
        </div>
      </div>
      {!preview && (
        <div className="canvas-view-tools">
          <label>
            裝置
            <select
              aria-label="畫布裝置"
              value={device}
              onChange={(e) => setDevice(e.target.value)}
            >
              <option value="auto">適應視窗</option>
              <option value="1440">桌面 1440</option>
              <option value="768">平板 768</option>
              <option value="390">手機 390</option>
            </select>
          </label>
          <label>
            縮放
            <select
              aria-label="畫布縮放"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            >
              {[0.5, 0.75, 1, 1.25].map((value) => (
                <option key={value} value={value}>
                  {value * 100}%
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={snap}
              onChange={(e) => setSnap(e.target.checked)}
            />
            8px 吸附
          </label>
        </div>
      )}
      {!preview && (
        <div className="canvas-toolbar" role="toolbar" aria-label="畫布工具">
          <button
            aria-label="開關圖層面板"
            aria-pressed={layersOpen}
            onClick={() => setLayersOpen((value) => !value)}
          >
            <Icon name="menu" size={16} />
            <span>圖層與積木</span>
          </button>
        </div>
      )}
      {panelOpen && (
        <aside className="editor-panel" aria-label="網站編輯面板">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">INSPECTOR / LIVE CANVAS</p>
              <h2>
                {tab === "theme"
                  ? "視覺風格"
                  : tab === "media"
                    ? "素材資料庫"
                    : tab === "interactions"
                      ? "交互設定"
                      : tab === "code"
                        ? "程式碼工作區"
                        : tab === "layout"
                          ? "佈局與圖層"
                          : "編輯內容"}
              </h2>
            </div>
            <button
              className="icon-button"
              onClick={closePanel}
              aria-label="關閉編輯面板"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <p className="selection-path">
            {pageNames[page]} /{" "}
            {selection.startsWith("node:")
              ? content.workspace?.nodes.find(
                  (n) => `node:${n.id}` === selection,
                )?.name || "積木"
              : selection.startsWith("project:")
                ? content.projects.find((p) => `project:${p.id}` === selection)
                    ?.title
                : selection.startsWith("copy:")
                  ? selection.slice(5)
                  : (
                      {
                        hero: "首頁主視覺",
                        about: "介紹卡片",
                        settings: "全站設定",
                      } as Record<string, string>
                    )[selection] || selection}
          </p>
          <div className="panel-tabs" role="tablist" aria-label="編輯工具">
            {(
              [
                ["content", "內容"],
                ["theme", "風格"],
                ["media", "媒體"],
                ["interactions", "互動"],
                ["layout", "佈局"],
                ["code", "代碼"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                aria-controls={`panel-${value}`}
                id={`tab-${value}`}
                onClick={() => changeTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="panel-scroll"
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
          >
            {error && (
              <div className="studio-error" role="alert">
                {error}
                {conflicts.current && (
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          "重新載入會捨棄本分頁未儲存的修改，確定繼續？",
                        )
                      )
                        load();
                    }}
                  >
                    重新載入草稿
                  </button>
                )}
              </div>
            )}
            {notice && (
              <p className="studio-notice" role="status">
                {notice}
                <button aria-label="關閉提示" onClick={() => setNotice("")}>
                  ×
                </button>
              </p>
            )}
            {publishResult && (
              <div
                className={`deployment-result ${publishResult.deployment}`}
                role="status"
              >
                <p>{publishResult.message}</p>
                {publishResult.runUrl && (
                  <a
                    href={publishResult.runUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    查看建置紀錄 ↗
                  </a>
                )}
                {["failed", "unconfigured"].includes(
                  publishResult.deployment,
                ) && (
                  <button onClick={() => publish(true)} disabled={busy}>
                    重試部署
                  </button>
                )}
              </div>
            )}
            {tab === "layout" && (
              <WorkspacePanel
                content={content}
                page={page}
                selection={selection}
                select={selectLayer}
                update={update}
              />
            )}
            {tab === "interactions" && (
              <InteractionsPanel content={content} update={update} />
            )}
            {tab === "code" && (
              <CodePanel
                content={content}
                page={page}
                api={api.base}
                base={base}
                assets={assets}
                onDirty={(dirty) => {
                  codeDirty.current = dirty;
                }}
                apply={(next) =>
                  update((n) => {
                    Object.keys(n).forEach(
                      (key) =>
                        delete (n as unknown as Record<string, unknown>)[key],
                    );
                    Object.assign(n, next);
                  })
                }
              />
            )}
            {tab === "content" &&
              (selection.startsWith("copy:") ? (
                <PresentationPanel
                  content={content}
                  selection={selection}
                  update={update}
                />
              ) : (
                <ContentPanel
                  content={content}
                  page={page}
                  selection={selection}
                  setSelection={(value) => {
                    setSelection(value);
                    if (value.startsWith("project:")) setPage("work");
                    else if (value.startsWith("note:")) setPage("journal");
                    else if (value === "hero") setPage("home");
                    else if (["about", "contact", "music"].includes(value))
                      setPage("about");
                  }}
                  update={update}
                  openMedia={() => changeTab("media")}
                />
              ))}
            {tab === "theme" && (
              <div className="advanced-panel">
                <label>
                  品牌圖標
                  <input
                    aria-label="品牌圖標"
                    value={
                      content.presentation?.logo ||
                      "/assets/outdesign-mark.webp"
                    }
                    onChange={(e) =>
                      update((next) => {
                        next.presentation ||= {};
                        next.presentation.logo = e.target.value;
                      })
                    }
                  />
                </label>
                <label>
                  編輯介面文字
                  <select
                    aria-label="選擇介面文字"
                    value=""
                    onChange={(e) => selectLayer(`copy:${e.target.value}`)}
                  >
                    <option value="" disabled>
                      選擇文字位置
                    </option>
                    {Object.keys(copyDefaults).map((key) => (
                      <option key={key} value={key}>
                        {copyDefaults[key].slice(0, 22)} · {key}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {tab === "theme" && (
              <ThemePanel
                content={content}
                update={update}
                exportContent={exportContent}
                importContent={importContent}
              />
            )}
            {tab === "media" && (
              <>
                <p className="panel-help">
                  圖片會先最佳化，再上傳至你的素材空間。選取作品後套用圖片，即可替換封面。
                </p>
                <label
                  className={`upload-drop ${uploading ? "uploading" : ""}`}
                >
                  <Icon name="upload" size={25} />
                  <strong>
                    {uploading ? "正在最佳化並上傳…" : "選擇檔案上傳"}
                  </strong>
                  <span>圖片 10 MB · 音訊 25 MB · PDF 15 MB</span>
                  <input
                    type="file"
                    aria-label="上傳素材"
                    accept="image/jpeg,image/png,image/webp,image/avif,image/gif,audio/mpeg,audio/wav,audio/ogg,audio/mp4,.m4a,.zip,.pdf,.txt"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) upload(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="media-target">
                  圖片套用位置：
                  {selection === "settings"
                    ? "品牌圖標"
                    : selectedProject?.title || "首頁主視覺"}
                </p>
                <div className="media-list">
                  {media.map((m) => (
                    <div className="media-item" key={m.id}>
                      <div className="media-thumbnail">
                        {m.kind === "image" && assets[m.id] ? (
                          <img src={assets[m.id]} alt={m.name} />
                        ) : (
                          <Icon name={m.kind === "audio" ? "volume" : "file"} />
                        )}
                      </div>
                      <div className="media-info">
                        <strong>{m.name}</strong>
                        <span>
                          {(m.size / 1_000_000).toFixed(2)} MB ·{" "}
                          {m.isPublic ? "已公開" : "私人草稿"}
                        </span>
                      </div>
                      <button className="media-use" onClick={() => useMedia(m)}>
                        套用
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => removeMedia(m)}
                        disabled={m.isPublic}
                        aria-label={`刪除素材 ${m.name}`}
                        title={
                          m.isPublic
                            ? "發布版本正在使用此素材"
                            : "刪除未使用素材"
                        }
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                {!media.length && (
                  <p className="panel-empty">
                    還沒有上傳素材。從一張圖片開始吧。
                  </p>
                )}
              </>
            )}
            {(tab === "content" ||
              (tab === "theme" && selection === "settings")) && (
              <ElementStylePanel
                content={content}
                page={page}
                selection={selection}
                update={update}
              />
            )}
            <div className="history-block">
              {tab !== "code" && (
                <ScopedCode
                  key={`${tab}:${page}`}
                  content={content}
                  scope={tab}
                  page={page}
                  apply={replaceContent}
                  onDirty={(dirty) => {
                    codeDirty.current = dirty;
                  }}
                />
              )}
              <button
                className="history-toggle"
                onClick={() => setHistoryOpen((p) => !p)}
                aria-expanded={historyOpen}
              >
                發布歷史<span>{history.length}</span>
                <Icon name="down" size={15} />
              </button>
              {historyOpen && (
                <div className="history-list">
                  {history.map((v, i) => (
                    <div key={v.id}>
                      <span>
                        {i === 0 ? "最新版本" : `版本 ${history.length - i}`}
                        <small>
                          {new Date(v.createdAt).toLocaleString("zh-TW", {
                            timeZone: "Asia/Taipei",
                            hour12: false,
                          })}
                        </small>
                      </span>
                      <button onClick={() => restore(v.id)}>載入草稿</button>
                    </div>
                  ))}
                  {!history.length && <p>尚未發布任何版本。</p>}
                </div>
              )}
            </div>
          </div>
          <div className="panel-footer">
            <Icon name="lock" size={12} />
            草稿僅你可見，發布後才會公開。
          </div>
        </aside>
      )}
      {!panelOpen && (
        <button className="floating-panel" onClick={() => setPanelOpen(true)}>
          <Icon name="edit" size={16} />
          開啟編輯面板
        </button>
      )}
      {showPublish && (
        <dialog
          className="publish-dialog"
          ref={confirmDialog}
          onCancel={() => setShowPublish(false)}
        >
          <p className="eyebrow">READY WHEN YOU ARE</p>
          <h2>發布這個版本？</h2>
          <p>
            即將發布 {content.projects.length} 件作品、
            {content.settings.showNotes ? content.notes.length : 0}{" "}
            篇筆記與目前的視覺風格。
          </p>
          <p className="publish-note">
            公開網站將於部署成功後更新。部署失敗時，既有網站仍可瀏覽。
          </p>
          {error && (
            <p className="studio-error" role="alert">
              {error}
            </p>
          )}
          <div className="publish-actions">
            <button
              className="button"
              onClick={() => {
                setShowPublish(false);
                confirmDialog.current?.close();
              }}
              disabled={busy}
            >
              繼續編輯
            </button>
            <button
              className="button button-white"
              onClick={() => publish()}
              disabled={busy}
            >
              {busy ? "正在發布…" : "確認發布"}
              <Icon name="diagonal" size={16} />
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
