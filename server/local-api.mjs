import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { createHandler } from "../supabase/functions/_shared/handler.ts";
import { createLocalStore } from "./local-store.ts";

export async function startLocalApi({
  directory = join(process.cwd(), ".local"),
  port = 8788,
  allowedOrigins = ["http://127.0.0.1:4321", "http://localhost:4321"],
} = {}) {
  await mkdir(directory, { recursive: true });
  const secretsPath = join(directory, "secrets.json");
  const store = await createLocalStore(directory);
  const handler = createHandler(store, {
    local: true,
    allowedOrigins,
    getPasswordHashes: async () => {
      try {
        const data = JSON.parse(await readFile(secretsPath, "utf8"));
        return data.passwordHashes;
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    bootstrap: async (passwordHashes) => {
      await writeFile(secretsPath, JSON.stringify({ passwordHashes }), {
        flag: "wx",
        mode: 0o600,
      });
    },
  });
  const server = createServer(async (req, res) => {
    // Binding to loopback plus Host/Origin checks prevents a remote first-run setup.
    const actualPort = server.address().port;
    if (
      ![`127.0.0.1:${actualPort}`, `localhost:${actualPort}`].includes(
        req.headers.host,
      )
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const body = ["GET", "HEAD"].includes(req.method)
        ? undefined
        : Readable.toWeb(req);
      const request = new Request(`http://127.0.0.1:${actualPort}${req.url}`, {
        method: req.method,
        headers: req.headers,
        body,
        duplex: "half",
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) Readable.fromWeb(response.body).pipe(res);
      else res.end();
    } catch {
      if (!res.headersSent)
        res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "本機服務暫時無法完成操作" }));
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    server,
    store,
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
