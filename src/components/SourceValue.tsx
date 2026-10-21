import type { SiteContent } from "../../supabase/functions/_shared/schema";
import { elementProps } from "../lib/presentation";
import { readSource, sourceKey, sourceLabels } from "../lib/source-fields";
export function SourceValue({
  content,
  path,
  editing = false,
}: {
  content: SiteContent;
  path: string;
  editing?: boolean;
}) {
  return (
    <span
      {...elementProps(content, sourceKey(path), editing)}
      data-field={sourceLabels[path] || path.split(".").at(-1)}
    >
      {readSource(content, path)}
    </span>
  );
}
