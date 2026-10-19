import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  SiteContent,
  Selection,
} from "../../supabase/functions/_shared/schema.ts";
import {
  collectAssetIds,
  contentSchema,
} from "../../supabase/functions/_shared/schema.ts";
import type { Draft, Media } from "../../supabase/functions/_shared/store.ts";
import { SiteRenderer } from "../components/SiteRenderer";
import { Icon } from "../components/Icon";
import { initViewer } from "../lib/viewer";
import { ApiError, prepareUpload, StudioApi } from "./api";
import { Auth } from "./Auth";
import { ContentPanel, ThemePanel } from "./panels";

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
    [tab, setTab] = useState<"content" | "theme" | "media">("content");
  const [panelOpen, setPanelOpen] = useState(true),
    [preview, setPreview] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
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
          const blob = await api.mediaBlob(m.id);
          const url = URL.createObjectURL(blob);
          objectUrls.current.push(url);
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
      conflicts.current = false;
      setContent(draft.content);
      setMedia(files.media);
      setHistory(versions.versions);
      setSaveState("saved");
      await cacheMedia(files.media, collectAssetIds(draft.content));
    } catch (e) {
      fail(e);
    }
  }
  useEffect(() => {
    load();
    return () => {
      objectUrls.current.forEach(URL.revokeObjectURL);
    };
  }, []);
  useEffect(() => {
    if (!view.current || !content) return;
    return initViewer(view.current);
  }, [content, preview, assets]);
  useEffect(() => {
    if (!content) return;
    document.title = `${content.settings.name} · 作者模式`;
  }, [content?.settings.name]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (
        current.current &&
        JSON.stringify(current.current) !== saved.current
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  function apply(next: SiteContent, remember = true) {
    if (
      !current.current ||
      JSON.stringify(next) === JSON.stringify(current.current)
    )
      return;
    if (remember) {
      undo.current.push(structuredClone(current.current));
      if (undo.current.length > 50) undo.current.shift();
      redo.current = [];
    }
    current.current = next;
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
  const saveNow = () => {
    const job = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        if (
          !current.current ||
          JSON.stringify(current.current) === saved.current
        )
          return;
        if (conflicts.current)
          throw new Error("草稿有版本衝突，請重新載入後再儲存。");
        const document = structuredClone(current.current),
          signature = JSON.stringify(document);
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
            JSON.stringify(current.current) === signature ? "saved" : "dirty",
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
    if (!content || JSON.stringify(content) === saved.current) return;
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
      if (e.key === "Escape" && !showPublish) setPanelOpen(false);
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [showPublish]);
  async function exit() {
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
      setMedia((previous) => [result.media, ...previous]);
      const objectUrl = URL.createObjectURL(prepared);
      objectUrls.current.push(objectUrl);
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
        const objectUrl = URL.createObjectURL(blob);
        objectUrls.current.push(objectUrl);
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
      } else if (m.kind === "image") {
        const project =
          selection.startsWith("project:") &&
          next.projects.find((p) => p.id === selection.slice(8));
        if (project) project.image = value;
        else {
          next.hero.image = value;
          setSelection("hero");
        }
      } else
        next.attachments.push({
          id: crypto.randomUUID(),
          name: m.name,
          url: value,
          label: `${(m.size / 1_000_000).toFixed(1)} MB`,
        });
    });
    setTab("content");
    setNotice("素材已套用至草稿。");
  }
  async function removeMedia(m: Media) {
    try {
      await api.request(`/media/${m.id}`, { method: "DELETE" });
      setMedia((previous) => previous.filter((x) => x.id !== m.id));
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
      apply(result.content);
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
      className={`editor-shell ${panelOpen ? "panel-open" : ""}`}
      data-history-tick={historyTick}
    >
      <header className="editor-topbar">
        <div className="editor-title">
          <span>{content.settings.name}</span>
          <span className="editor-badge">作者模式</span>
        </div>
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
              redo.current.push(structuredClone(current.current));
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
              undo.current.push(structuredClone(current.current));
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
            onClick={() => setPanelOpen((p) => !p)}
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
      <div
        className="editor-canvas"
        ref={view}
        onClickCapture={(event) => {
          if (preview) return;
          const element = (event.target as Element).closest<HTMLElement>(
            "[data-edit]",
          );
          if (element?.dataset.edit) {
            event.preventDefault();
            event.stopPropagation();
            setSelection(element.dataset.edit as Selection);
            setTab("content");
            setPanelOpen(true);
          }
        }}
      >
        <SiteRenderer
          content={content}
          api={api.base}
          base={base}
          editing={!preview}
          selected={selection}
          privateAssets={assets}
        />
      </div>
      {panelOpen && (
        <aside className="editor-panel" aria-label="網站編輯面板">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">MAKE IT YOURS</p>
              <h2>
                {tab === "theme"
                  ? "視覺風格"
                  : tab === "media"
                    ? "素材資料庫"
                    : "編輯內容"}
              </h2>
            </div>
            <button
              className="icon-button"
              onClick={() => setPanelOpen(false)}
              aria-label="關閉編輯面板"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="panel-tabs" role="tablist" aria-label="編輯工具">
            {(
              [
                ["content", "內容"],
                ["theme", "風格"],
                ["media", "媒體"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                aria-controls={`panel-${value}`}
                id={`tab-${value}`}
                onClick={() => setTab(value)}
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
            {tab === "content" && (
              <ContentPanel
                content={content}
                selection={selection}
                setSelection={setSelection}
                update={update}
                openMedia={() => setTab("media")}
              />
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
                  圖片套用位置：{selectedProject?.title || "首頁主視覺"}
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
            <div className="history-block">
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
