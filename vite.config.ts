import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Forward browser-side errors to the `npm run dev` terminal for easy copy-paste. */
function clientErrorLogger(): Plugin {
  return {
    name: "client-error-logger",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(
        "/__client-error",
        (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
        if (req.method !== "POST") return next();
        let body = "";
        req.on("data", (chunk: Buffer | string) => {
          body += chunk;
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body) as {
              context?: string;
              message?: string;
              stack?: string;
              extra?: Record<string, unknown>;
              time?: string;
            };
            console.error("\n──────── client error ────────");
            console.error(`context: ${payload.context ?? "unknown"}`);
            if (payload.time) console.error(`time:    ${payload.time}`);
            if (payload.message) console.error(`message: ${payload.message}`);
            if (payload.extra) console.error("details:", payload.extra);
            if (payload.stack) console.error(payload.stack);
            console.error("──────────────────────────────\n");
          } catch {
            console.error("\n──────── client error (unparsed) ────────");
            console.error(body);
            console.error("────────────────────────────────────────\n");
          }
          res.statusCode = 204;
          res.end();
        });
      },
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), clientErrorLogger()],
  server: {
    port: 5173,
    open: true,
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    include: ["pdfjs-dist"],
  },
});
