import { createRoot } from "react-dom/client";
import { Studio } from "./Studio";
import "../styles/editor.css";

let open = false;
export async function openStudio() {
  if (open) return;
  open = true;
  const target = document.getElementById("studio-root")!;
  const publicSite = document.getElementById("public-site")!;
  const previousFocus = document.activeElement as HTMLElement;
  const previousTitle = document.title;
  document
    .querySelectorAll<HTMLAudioElement>("#public-site audio")
    .forEach((a) => a.pause());
  const root = createRoot(target);
  document.body.classList.add("studio-active");
  publicSite.inert = true;
  root.render(
    <Studio
      apiBase={document.body.dataset.api || ""}
      base={document.body.dataset.base || "/"}
      onAuthenticated={() => {
        publicSite.hidden = true;
      }}
      onClose={(reload = false) => {
        root.unmount();
        publicSite.hidden = false;
        publicSite.inert = false;
        document.body.classList.remove("studio-active");
        document.title = previousTitle;
        open = false;
        previousFocus?.focus();
        if (reload) window.location.reload();
      }}
    />,
  );
}
