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
          aria-describedby={hint ? `${id}-hint` : undefined}
          value={value}
          maxLength={max}
          rows={4}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
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
}: {
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
      <label className="editor-field">
        <span>編輯區塊</span>
        <select
          value={selection}
          onChange={(e) => setSelection(e.target.value as Selection)}
        >
          <option value="hero">首頁主視覺</option>
          <optgroup label="作品">
            {c.projects.map((p) => (
              <option key={p.id} value={`project:${p.id}`}>
                {p.title}
              </option>
            ))}
          </optgroup>
          <optgroup label="筆記">
            {c.notes.map((n) => (
              <option key={n.id} value={`note:${n.id}`}>
                {n.title}
              </option>
            ))}
          </optgroup>
          <option value="about">關於我</option>
          <option value="music">音樂播放器</option>
          <option value="contact">聯絡資訊</option>
        </select>
      </label>
      <p className="panel-help">也可以直接點選左側頁面的區塊來編輯。</p>
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
              image: "/assets/work-quiet.svg",
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
        三種視覺組合共用排版與內容；切換後立即預覽，發布後才會對訪客生效。
      </p>
      <div className="theme-options">
        {(
          [
            { value: "prism", name: "Prism", desc: "深黑底色，少量虹彩引導" },
            { value: "quiet", name: "Quiet", desc: "純粹黑白，讓作品成為焦點" },
            {
              value: "luminous",
              name: "Luminous",
              desc: "柔光與較鮮明的虹色細節",
            },
          ] as const
        ).map((t) => (
          <button
            key={t.value}
            className={`theme-option ${t.value} ${c.settings.theme === t.value ? "selected" : ""}`}
            aria-pressed={c.settings.theme === t.value}
            onClick={() =>
              update((n) => {
                n.settings.theme = t.value;
              })
            }
          >
            <span className="theme-preview">
              <i />
              <i />
              <i />
              <span />
            </span>
            <strong>{t.name}</strong>
            <span>{t.desc}</span>
            {c.settings.theme === t.value && <Icon name="check" size={17} />}
          </button>
        ))}
      </div>
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
        label="瀏覽器標題"
        value={c.settings.siteTitle}
        max={100}
        onChange={(v) =>
          update((n) => {
            n.settings.siteTitle = v;
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
