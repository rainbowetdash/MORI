import app from "../dist/server/index.js";

const PUBLIC_ASSETS = new Set([
  "/favicon.svg",
  "/file.svg",
  "/globe.svg",
  "/og.png",
  "/vinext-client-entry-manifest.json",
  "/window.svg",
]);

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    // In Pages advanced mode the Worker owns every request. Explicitly hand
    // client bundles and public files back to Pages' static asset service.
    if (pathname.startsWith("/_next/static/") || PUBLIC_ASSETS.has(pathname)) {
      return env.ASSETS.fetch(request);
    }

    // The browser never receives this secret. Only the exact default testing
    // request is completed inside the worker before the app handles it.
    if (pathname === "/api/chat" && request.method === "POST" && env.MORI_DEEPSEEK_API_KEY) {
      try {
        const body = await request.clone().json();
        const isDefaultTestRequest = body.provider === "compatible"
          && body.model === "deepseek-v4-flash"
          && String(body.baseUrl || "").replace(/\/+$/, "") === "https://api.deepseek.com";
        if (isDefaultTestRequest && !body.apiKey) {
          const headers = new Headers(request.headers);
          headers.set("content-type", "application/json");
          return app.fetch(new Request(request, { headers, body: JSON.stringify({ ...body, apiKey: env.MORI_DEEPSEEK_API_KEY }) }), env, ctx);
        }
      } catch {
        // The app route returns its normal configuration error for malformed input.
      }
    }

    return app.fetch(request, env, ctx);
  },
};
