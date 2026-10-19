import { initialContent } from "../../supabase/functions/_shared/seed.ts";
import { contentSchema } from "../../supabase/functions/_shared/schema.ts";

export async function loadPublicContent() {
  const api = (
    import.meta.env.PUBLIC_API_URL ||
    process.env.PUBLIC_API_URL ||
    (import.meta.env.DEV ? "http://127.0.0.1:8788/api" : "")
  ).replace(/\/$/, "");
  if (!api) {
    if (process.env.CONTENT_REQUIRED === "true")
      throw new Error("PUBLIC_API_URL is required for production content.");
    return { content: initialContent, version: "demo" };
  }
  const response = await fetch(`${api}/public`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(
      `Published content unavailable (${response.status}); deployment stopped.`,
    );
  const data = await response.json();
  if (
    process.env.CONTENT_VERSION &&
    data.version !== process.env.CONTENT_VERSION
  )
    throw new Error(
      "A newer content version exists; stale deployment stopped.",
    );
  return {
    content: contentSchema.parse(data.content),
    version: String(data.version || "initial"),
  };
}

export function assetUrl(
  value: string,
  api = "",
  base = "/",
  privateAssets: Record<string, string> = {},
): string {
  if (value.startsWith("asset:"))
    return privateAssets[value.slice(6)] || `${api}/media/${value.slice(6)}`;
  return value.startsWith("/assets/")
    ? `${base.replace(/\/$/, "")}${value}`
    : value;
}
