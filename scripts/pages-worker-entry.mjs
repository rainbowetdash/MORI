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

    // The browser never receives this secret. Only the default test model gets
    // the key, and the API route verifies its exact model and endpoint first.
    const headers = new Headers(request.headers);
    headers.delete("x-mori-default-deepseek-key");
    if (env.MORI_DEEPSEEK_API_KEY) headers.set("x-mori-default-deepseek-key", env.MORI_DEEPSEEK_API_KEY);
    return app.fetch(new Request(request, { headers }), env, ctx);
  },
};
