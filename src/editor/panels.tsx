import { defaultDesign } from "../../supabase/functions/_shared/schema";
import type { SitePage } from "../components/SiteRenderer";
import { useId } from "react";
import type {
  Selection,
  SiteContent,
} from "../../supabase/functions/_shared/schema.ts";
import { Icon } from "../components/Icon";
type Update = (edit: (next: SiteContent) => void) => void;
function Field({
  label,
  value,
  onChange,
  multiline = false,
  max = 2000,
  hint = "",
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  max?: number;
  hint?: string;
  type?: string;
}) {
  const id = useId();
  return (
    <div className="editor-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          aria-label={label}
          aria-describedby={hint ? `${id}-hint` : undefined}
          value={value}
          maxLength={max}
          rows={4}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          aria-label={label}
          type={type}
          aria-describedby={hint ? `${id}-hint` : undefined}
          value={value}
          maxLength={max}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="editor-switch">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
    </label>
  );
}
function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="panel-section-title">{children}</h3>;
}

export function ContentPanel({
  content: c,
  selection,
  setSelection,
  update,
  openMedia,
  page,
}: {
  page: SitePage;
  content: SiteContent;
  selection: Selection;
  setSelection: (v: Selection) => void;
  update: Update;
  openMedia: () => void;
}) {
  const project = selection.startsWith("project:")
    ? c.projects.find((p) => p.id === selection.slice(8))
    : null;
  const note = selection.startsWith("note:")
    ? c.notes.find((n) => n.id === selection.slice(5))
    : null;
  return (
    <>
      <p className="panel-help">
        從左側圖層或畫布選取內容，屬性會在此同步顯示。
      </p>
      {selection === "hero" && (
        <>
          <Heading>首頁主視覺</Heading>
          <Field
            label="上方短句"
            value={c.hero.eyebrow}
            max={80}
            onChange={(v) =>
              update((n) => {
                n.hero.eyebrow = v;
              })
            }
          />
          <Field
            label="標題第一行"
            value={c.hero.line1}
            max={32}
            onChange={(v) =>
              update((n) => {
                n.hero.line1 = v;
              })
            }
          />
          <Field
            label="標題第二行"
            value={c.hero.line2}
            max={32}
            onChange={(v) =>
              update((n) => {
                n.hero.line2 = v;
              })
            }
          />
          <Field
            label="介紹文字"
            value={c.hero.description}
            multiline
            max={500}
            onChange={(v) =>
              update((n) => {
                n.hero.description = v;
              })
            }
          />
          <Field
            label="主視覺圖片"
            value={c.hero.image}
            max={2048}
            hint="可使用 HTTPS 圖片網址，或從媒體資料庫選擇。"
            onChange={(v) =>
              update((n) => {
                n.hero.image = v;
              })
            }
          />
          <button className="panel-secondary" onClick={openMedia}>
            <Icon name="upload" size={15} />
            上傳或選擇圖片
          </button>
          <Field
            label="圖片替代文字"
            value={c.hero.alt}
            max={160}
            hint="為使用螢幕閱讀器的訪客描述圖片。"
            onChange={(v) =>
              update((n) => {
                n.hero.alt = v;
              })
            }
          />
        </>
      )}
      {project && (
        <>
          <Heading>作品內容</Heading>
          <Field
            label="作品名稱"
            value={project.title}
            max={80}
            onChange={(v) =>
              update((n) => {
                n.projects.find((p) => p.id === project.id)!.title = v;
              })
            }
          />
          <label className="editor-field">
            <span>作品分類</span>
            <select
              value={project.category}
              onChange={(e) =>
                update((n) => {
                  n.projects.find((p) => p.id === project.id)!.category = e
                    .target.value as typeof project.category;
                })
              }
            >
              {["設計", "開發", "實驗"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <Field
            label="年份"
            value={project.year}
            max={12}
            onChange={(v) =>
              update((n) => {
                n.projects.find((p) => p.id === project.id)!.year = v;
              })
            }
          />
          <Field
            label="作品說明"
            value={project.description}
            max={500}
            multiline
            onChange={(v) =>
              update((n) => {
                n.projects.find((p) => p.id === project.id)!.description = v;
              })
            }
          />
          <Field
            label="作品封面"
            value={project.image}
            max={2048}
            onChange={(v) =>
              update((n) => {
                n.projects.find((p) => p.id === project.id)!.image = v;
              })
            }
          />
          <button className="panel-secondary" onClick={openMedia}>
            <Icon name="upload" size={15} />
            上傳或選擇封面
          </button>
          <Field
            label="封面替代文字"
            value={project.alt}
            max={160}
            onChange={(v) =>
              update((n) => {
                n.projects.find((p) => p.id === project.id)!.alt = v;
              })
            }
          />
          <Field
            label="外部作品網址"
            value={project.url}
            max={2048}
            hint="選填，需以 https:// 開頭。"
            onChange={(v) =>
              update((n) => {
                n.projects.find((p) => p.id === project.id)!.url = v;
              })
            }
          />
          <Switch
            label="標示為概念示範"
            checked={project.demo}
            onChange={(v) =>
              update((n) => {
                n.projects.find((p) => p.id === project.id)!.demo = v;
              })
            }
          />
        </>
      )}
      {note && (
        <>
          <Heading>筆記內容</Heading>
          <Field
            label="筆記標題"
            value={note.title}
            max={100}
            onChange={(v) =>
              update((n) => {
                n.notes.find((p) => p.id === note.id)!.title = v;
              })
            }
          />
          <Field
            label="筆記內文"
            value={note.excerpt}
            max={600}
            multiline
            onChange={(v) =>
              update((n) => {
                n.notes.find((p) => p.id === note.id)!.excerpt = v;
              })
            }
          />
          <Field
            label="顯示日期"
            value={note.date}
            max={32}
            onChange={(v) =>
              update((n) => {
                n.notes.find((p) => p.id === note.id)!.date = v;
              })
            }
          />
          <Field
            label="分類標籤"
            value={note.tag}
            max={24}
            onChange={(v) =>
              update((n) => {
                n.notes.find((p) => p.id === note.id)!.tag = v;
              })
            }
          />
          <Field
            label="延伸閱讀網址"
            value={note.url}
            max={2048}
            hint="選填，需以 https:// 開頭。"
            onChange={(v) =>
              update((n) => {
                n.notes.find((p) => p.id === note.id)!.url = v;
              })
            }
          />
        </>
      )}
      {selection === "about" && (
        <>
          <Heading>關於我</Heading>
          <Field
            label="介紹卡圖片"
            value={
              c.presentation?.missionImage || "/assets/lunar-landscape.webp"
            }
            max={2048}
            onChange={(value) =>
              update((next) => {
                next.presentation ||= {};
                next.presentation.missionImage = value;
              })
            }
          />
          <button className="panel-secondary" onClick={openMedia}>
            替換介紹卡圖片
          </button>
          <Field
            label="介紹卡圖片替代文字"
            value={c.presentation?.missionAlt || "銀光映照的月面山脈"}
            max={160}
            onChange={(value) =>
              update((next) => {
                next.presentation ||= {};
                next.presentation.missionAlt = value;
              })
            }
          />

          <Field
            label="關於我的標題"
            value={c.about.title}
            max={100}
            multiline
            onChange={(v) =>
              update((n) => {
                n.about.title = v;
              })
            }
          />
          <Field
            label="自我介紹"
            value={c.about.body}
            max={2000}
            multiline
            onChange={(v) =>
              update((n) => {
                n.about.body = v;
              })
            }
          />
          <Field
            label="個人標籤"
            value={c.about.tags.join("、")}
            max={248}
            hint="以頓號「、」分隔，最多 8 個標籤。"
            onChange={(v) =>
              update((n) => {
                n.about.tags = v
                  .split("、")
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .slice(0, 8);
              })
            }
          />
        </>
      )}
      {selection === "contact" && (
        <>
          <Heading>聯絡資訊</Heading>
          <Field
            label="邀請標題"
            value={c.contact.headline}
            multiline
            max={100}
            onChange={(v) =>
              update((n) => {
                n.contact.headline = v;
              })
            }
          />
          <Field
            label="聯絡 Email"
            value={c.contact.email}
            type="email"
            max={254}
            onChange={(v) =>
              update((n) => {
                n.contact.email = v;
              })
            }
          />
          <Field
            label="GitHub 網址"
            value={c.contact.github}
            max={2048}
            onChange={(v) =>
              update((n) => {
                n.contact.github = v;
              })
            }
          />
          <Field
            label="Instagram 網址"
            value={c.contact.instagram}
            max={2048}
            onChange={(v) =>
              update((n) => {
                n.contact.instagram = v;
              })
            }
          />
        </>
      )}
      {selection === "music" && (
        <>
          <Heading>音樂播放器</Heading>
          <Switch
            label="顯示播放器"
            checked={c.settings.showMusic}
            onChange={(v) =>
              update((n) => {
                n.settings.showMusic = v;
              })
            }
          />
          <Field
            label="曲目名稱"
            value={c.music.title}
            max={100}
            onChange={(v) =>
              update((n) => {
                n.music.title = v;
              })
            }
          />
          <Field
            label="演出者或說明"
            value={c.music.artist}
            max={100}
            onChange={(v) =>
              update((n) => {
                n.music.artist = v;
              })
            }
          />
          <Field
            label="音訊網址"
            value={c.music.url}
            max={2048}
            hint="音樂由訪客主動播放，不會自動播放。"
            onChange={(v) =>
              update((n) => {
                n.music.url = v;
              })
            }
          />
          <button className="panel-secondary" onClick={openMedia}>
            <Icon name="upload" size={15} />
            上傳或選擇音樂
          </button>
        </>
      )}
      {page === "work" && (
        <>
          <Heading>作品管理</Heading>
          <div className="block-list">
            {c.projects.map((p, i) => (
              <div
                key={p.id}
                className={selection === `project:${p.id}` ? "selected" : ""}
              >
                <button
                  className="block-label"
                  onClick={() => setSelection(`project:${p.id}`)}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {p.title}
                </button>
                <button
                  className="icon-button"
                  aria-label={`上移 ${p.title}`}
                  disabled={i === 0}
                  onClick={() =>
                    update((n) => {
                      [n.projects[i - 1], n.projects[i]] = [
                        n.projects[i],
                        n.projects[i - 1],
                      ];
                    })
                  }
                >
                  <Icon name="up" size={14} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`下移 ${p.title}`}
                  disabled={i === c.projects.length - 1}
                  onClick={() =>
                    update((n) => {
                      [n.projects[i + 1], n.projects[i]] = [
                        n.projects[i],
                        n.projects[i + 1],
                      ];
                    })
                  }
                >
                  <Icon name="down" size={14} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`移除作品 ${p.title}`}
                  onClick={() => {
                    update((n) => {
                      n.projects = n.projects.filter((x) => x.id !== p.id);
                    });
                    if (selection === `project:${p.id}`) setSelection("hero");
                  }}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="panel-secondary"
            disabled={c.projects.length >= 24}
            onClick={() => {
              const id = crypto.randomUUID();
              update((n) => {
                n.projects.push({
                  id,
                  title: "新的作品",
                  category: "設計",
                  description: "在這裡介紹你的作品。",
                  year: new Date().getUTCFullYear().toString(),
                  image: "",
                  alt: "作品封面",
                  url: "",
                  tone: "lilac",
                  demo: false,
                });
              });
              setSelection(`project:${id}`);
            }}
          >
            <Icon name="plus" size={15} />
            新增作品
          </button>
        </>
      )}
      {page === "journal" && (
        <>
          <Heading>筆記管理</Heading>
          <Switch
            label="顯示筆記區塊"
            checked={c.settings.showNotes}
            onChange={(v) =>
              update((n) => {
                n.settings.showNotes = v;
              })
            }
          />
          <div className="block-list">
            {c.notes.map((n) => (
              <div key={n.id}>
                <button
                  className="block-label"
                  onClick={() => setSelection(`note:${n.id}`)}
                >
                  {n.title}
                </button>
                <button
                  className="icon-button"
                  aria-label={`移除筆記 ${n.title}`}
                  onClick={() => {
                    update((next) => {
                      next.notes = next.notes.filter((x) => x.id !== n.id);
                    });
                    if (selection === `note:${n.id}`) setSelection("hero");
                  }}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="panel-secondary"
            disabled={c.notes.length >= 30}
            onClick={() => {
              const id = crypto.randomUUID();
              update((n) => {
                n.notes.push({
                  id,
                  title: "新的筆記",
                  excerpt: "寫下你現在的想法。",
                  date: new Intl.DateTimeFormat("zh-TW", {
                    timeZone: "Asia/Taipei",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })
                    .format(new Date())
                    .replaceAll("/", "."),
                  tag: "隨筆",
                  url: "",
                });
              });
              setSelection(`note:${id}`);
            }}
          >
            <Icon name="plus" size={15} />
            新增筆記
          </button>
        </>
      )}
      {page === "resources" && (
        <>
          <Heading>附件與下載連結</Heading>
          {c.attachments.map((a) => (
            <div className="attachment-editor" key={a.id}>
              <Field
                label="附件名稱"
                value={a.name}
                max={100}
                onChange={(v) =>
                  update((n) => {
                    n.attachments.find((x) => x.id === a.id)!.name = v;
                  })
                }
              />
              <Field
                label="檔案或外部網址"
                value={a.url}
                max={2048}
                onChange={(v) =>
                  update((n) => {
                    n.attachments.find((x) => x.id === a.id)!.url = v;
                  })
                }
              />
              <Field
                label="下載資訊"
                value={a.label}
                max={30}
                onChange={(v) =>
                  update((n) => {
                    n.attachments.find((x) => x.id === a.id)!.label = v;
                  })
                }
              />
              <button
                className="panel-danger"
                onClick={() =>
                  update((n) => {
                    n.attachments = n.attachments.filter((x) => x.id !== a.id);
                  })
                }
              >
                <Icon name="trash" size={13} />
                移除附件連結
              </button>
            </div>
          ))}
          <button
            className="panel-secondary"
            disabled={c.attachments.length >= 20}
            onClick={openMedia}
          >
            <Icon name="upload" size={15} />
            上傳附件
          </button>
          <button
            className="panel-secondary"
            disabled={c.attachments.length >= 20}
            onClick={() =>
              update((n) => {
                n.attachments.push({
                  id: crypto.randomUUID(),
                  name: "新的連結",
                  url: "",
                  label: "外部資源",
                });
              })
            }
          >
            <Icon name="plus" size={15} />
            新增外部連結
          </button>
        </>
      )}
    </>
  );
}

export function ThemePanel({
  content: c,
  update,
  exportContent,
  importContent,
}: {
  content: SiteContent;
  update: Update;
  exportContent: () => void;
  importContent: (file: File) => void;
}) {
  return (
    <>
      <p className="panel-help">
        調整全站色彩；單一面板的邊框、陰影與互動可在畫布選取後設定。
      </p>
      <Heading>網站調色</Heading>
      <div className="property-grid">
        {(
          [
            ["background", "網站背景"],
            ["surface", "面板底色"],
            ["raised", "浮層底色"],
            ["text", "主要文字"],
            ["muted", "次要文字"],
            ["accent", "強調色"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="color"
              aria-label={label}
              value={(c.design || defaultDesign)[key]}
              onChange={(e) =>
                update((next) => {
                  next.design = {
                    ...(next.design || defaultDesign),
                    [key]: e.target.value,
                  };
                })
              }
            />
          </label>
        ))}
      </div>
      <label>
        全站圓角
        <input
          type="range"
          aria-label="全站圓角"
          min="0"
          max="32"
          value={(c.design || defaultDesign).radius}
          onChange={(e) =>
            update((next) => {
              next.design = {
                ...(next.design || defaultDesign),
                radius: Number(e.target.value),
              };
            })
          }
        />
      </label>
      <Heading>網站資訊</Heading>
      <Field
        label="網站顯示名稱"
        value={c.settings.name}
        max={60}
        onChange={(v) =>
          update((n) => {
            n.settings.name = v;
          })
        }
      />
      <Field
        label="網站描述"
        value={c.settings.description}
        max={220}
        multiline
        hint="用於搜尋結果與分享摘要。"
        onChange={(v) =>
          update((n) => {
            n.settings.description = v;
          })
        }
      />
      <Heading>內容備份</Heading>
      <p className="panel-help">
        備份包含文字、設定與素材參照。上傳檔案另存於素材空間，遷移時請一併備份。
      </p>
      <button className="panel-secondary" onClick={exportContent}>
        <Icon name="file" size={15} />
        匯出內容 JSON
      </button>
      <label className="panel-secondary import-label">
        <Icon name="upload" size={15} />
        匯入內容備份
        <input
          type="file"
          accept="application/json,.json"
          aria-label="匯入內容備份"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importContent(file);
            e.target.value = "";
          }}
        />
      </label>
    </>
  );
}
