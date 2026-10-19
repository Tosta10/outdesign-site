export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export class StudioApi {
  base: string;
  token = "";
  constructor(base: string) {
    this.base = base;
  }
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await this.fetch(path, options);
    const data = await response.json();
    if (!response.ok)
      throw new ApiError(
        [data.error, ...(data.details || [])].filter(Boolean).join("；"),
        response.status,
      );
    return data as T;
  }
  async fetch(path: string, options: RequestInit = {}) {
    if (!this.base)
      throw new ApiError(
        "作者服務尚未連線。請依專案部署文件設定後端網址。",
        503,
      );
    const headers = new Headers(options.headers);
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    if (typeof options.body === "string")
      headers.set("Content-Type", "application/json");
    return fetch(`${this.base}${path}`, {
      ...options,
      headers,
      cache: "no-store",
      signal: options.signal || AbortSignal.timeout(30_000),
    });
  }
  async mediaBlob(id: string): Promise<Blob> {
    const response = await this.fetch(`/media/${id}`);
    if (!response.ok) throw new ApiError("素材暫時無法載入", response.status);
    return response.blob();
  }
}
export async function prepareUpload(file: File): Promise<File> {
  const aliases: Record<string, string> = {
    "application/x-zip-compressed": "application/zip",
    "audio/x-m4a": "audio/mp4",
    "audio/mp3": "audio/mpeg",
    "audio/x-wav": "audio/wav",
  };
  const extensions: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    avif: "image/avif",
    gif: "image/gif",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    pdf: "application/pdf",
    zip: "application/zip",
    txt: "text/plain",
  };
  const mime =
    aliases[file.type] ||
    (!file.type
      ? extensions[file.name.split(".").pop()?.toLowerCase() || ""]
      : "");
  if (mime) file = new File([file], file.name, { type: mime });
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    return file;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    if (Math.max(bitmap.width, bitmap.height) <= 1800 && file.size < 600_000)
      return file;
    const ratio = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.86),
    );
    return blob && blob.type === "image/webp" && blob.size < file.size
      ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
          type: "image/webp",
        })
      : file;
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
