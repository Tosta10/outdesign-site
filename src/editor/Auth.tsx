import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { StudioApi } from "./api";

export function Auth({
  api,
  onLogin,
  onClose,
  reason = "",
}: {
  api: StudioApi;
  onLogin: (token: string, expiresAt: number) => void;
  onClose: () => void;
  reason?: string;
}) {
  const [setup, setSetup] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(reason),
    [busy, setBusy] = useState(false),
    [visible, setVisible] = useState(false);
  const [password1, setPassword1] = useState(""),
    [password2, setPassword2] = useState("");
  const first = useRef<HTMLInputElement>(null),
    dialog = useRef<HTMLDivElement>(null),
    id = useId();
  async function check() {
    setReady(false);
    try {
      const status = await api.request<{
        configured: boolean;
        setupAvailable: boolean;
      }>("/status");
      setSetup(status.setupAvailable);
      if (!status.configured && !status.setupAvailable)
        setError("作者服務尚未設定，請先依部署文件設定兩組密碼。");
      else setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "無法連線至作者服務");
    }
  }
  useEffect(() => {
    check();
  }, []);
  useEffect(() => {
    if (ready) first.current?.focus();
    else dialog.current?.focus();
  }, [ready]);
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError("");
    try {
      if (setup) {
        if (password1 === password2) throw new Error("請設定兩組不同的密碼。");
        await api.request("/setup", {
          method: "POST",
          body: JSON.stringify({ password1, password2 }),
        });
      }
      const session = await api.request<{ token: string; expiresAt: number }>(
        "/login",
        { method: "POST", body: JSON.stringify({ password1, password2 }) },
      );
      setPassword1("");
      setPassword2("");
      onLogin(session.token, session.expiresAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登入失敗，請重試");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="studio-shade">
      <div
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        ref={dialog}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key === "Tab") {
            const items = [
              ...(dialog.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input:not(:disabled),a[href]",
              ) || []),
            ];
            const firstItem = items[0],
              lastItem = items.at(-1);
            if (event.shiftKey && document.activeElement === firstItem) {
              event.preventDefault();
              lastItem?.focus();
            } else if (!event.shiftKey && document.activeElement === lastItem) {
              event.preventDefault();
              firstItem?.focus();
            }
          }
        }}
      >
        <button
          className="icon-button auth-close"
          onClick={onClose}
          aria-label="關閉作者登入"
        >
          <Icon name="close" />
        </button>
        <div className="auth-symbol">
          <Icon name="lock" size={27} />
        </div>
        <p className="eyebrow">YOUR SPACE. YOUR WORDS.</p>
        <h2 id={`${id}-title`}>
          {setup ? "設定你的作者入口" : "回到你的創作空間"}
        </h2>
        <p className="auth-description">
          {setup
            ? "首次使用，請設定兩組不同的密碼。之後輸入這兩組密碼，就能開始編輯。"
            : "輸入兩組作者密碼，繼續編輯你的作品與想法。"}
        </p>
        <form onSubmit={submit}>
          <label htmlFor={`${id}-one`}>
            第一組密碼
            <input
              id={`${id}-one`}
              ref={first}
              type={visible ? "text" : "password"}
              value={password1}
              onChange={(e) => setPassword1(e.target.value)}
              minLength={12}
              maxLength={200}
              autoComplete={setup ? "new-password" : "current-password"}
              required
              disabled={!ready || busy}
              placeholder={setup ? "至少 12 個字元" : "輸入第一組密碼"}
            />
          </label>
          <label htmlFor={`${id}-two`}>
            第二組密碼
            <input
              id={`${id}-two`}
              type={visible ? "text" : "password"}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              minLength={12}
              maxLength={200}
              autoComplete={setup ? "new-password" : "current-password"}
              required
              disabled={!ready || busy}
              placeholder={setup ? "使用另一組不同的密碼" : "輸入第二組密碼"}
            />
          </label>
          <label className="show-passwords">
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => setVisible(e.target.checked)}
            />
            顯示密碼
          </label>
          {error && (
            <p className="studio-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button button-white auth-submit"
            type="submit"
            disabled={busy || !ready}
          >
            {busy ? "正在驗證…" : setup ? "設定並進入編輯" : "進入作者模式"}
            <Icon name="arrow" size={17} />
          </button>
          {!ready && (
            <button
              type="button"
              className="text-link auth-retry"
              onClick={check}
            >
              重新檢查連線
            </button>
          )}
        </form>
        <p className="auth-note">
          {setup
            ? "密碼只以雜湊儲存在本機，不會加入 GitHub。"
            : "工作階段有效 2 小時；重新整理後需再次登入。"}
        </p>
      </div>
    </div>
  );
}
