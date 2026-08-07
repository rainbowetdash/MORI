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

    return app.fetch(request, env, ctx);
  },
};
