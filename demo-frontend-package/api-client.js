/**
 * 演示前端统一 API 入口。Base URL 只来自 DEMO_API_BASE_URL，禁止各页面散落绝对地址。
 */
(function (global) {
  function apiBaseUrl() {
    const raw = String(global.DEMO_API_BASE_URL || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      return url.origin;
    } catch {
      return "";
    }
  }

  function demoApiUrl(path) {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${apiBaseUrl()}${normalized}`;
  }

  function demoFetch(path, init) {
    return fetch(demoApiUrl(path), init);
  }

  global.DemoApi = { url: demoApiUrl, fetch: demoFetch, baseUrl: apiBaseUrl };
})(typeof window !== "undefined" ? window : globalThis);
