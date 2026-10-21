import type { SiteContent } from "../../supabase/functions/_shared/schema";
import { elementProps, presentationCopy } from "../lib/presentation";
export function EditableText({
  content,
  id,
  editing,
  selected,
  fallback,
  className,
}: {
  content: SiteContent;
  id: string;
  editing?: boolean;
  selected?: string;
  fallback?: string;
  className?: string;
}) {
  return (
    <span
      className={`${className || ""}${editing && selected === `copy:${id}` ? " is-selected" : ""}`}
      {...elementProps(content, `copy-${id}`, editing)}
      data-edit={editing ? `copy:${id}` : undefined}
      data-copy-key={id}
    >
      {presentationCopy(content, id, fallback)}
    </span>
  );
}
