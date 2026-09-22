(() => {
  "use strict";

  const API_ORIGIN = "https://api.myinvestorportal.ca/";
  const PAGE_SOURCE = "manuvie-evolution-page";
  const CONTENT_SOURCE = "manuvie-evolution-content";
  const NativeXHR = window.XMLHttpRequest;
  const nativeFetch = window.fetch.bind(window);
  const recentResponses = [];
  const queryOrigins = new Map();
  let mfp = null;
  let language = "fr";

  const emitProgress = (id, status, detail) =>
    window.postMessage(
      { source: PAGE_SOURCE, type: "progress", detail: { id, status, detail } },
      location.origin,
    );

  const emit = (url, data, requestId = null) => {
    const detail = { url, data, requestId };
    recentResponses.push(detail);
    if (recentResponses.length > 80) recentResponses.shift();
    window.postMessage({ source: PAGE_SOURCE, type: "api-response", detail }, location.origin);
  };

  const emitReady = () =>
    window.postMessage({ source: PAGE_SOURCE, type: "bridge-ready" }, location.origin);

  const rememberHeaders = (headers) => {
    for (const [name, value] of Object.entries(headers)) {
      if (name.toLowerCase() === "mfp") mfp = value;
      if (name.toLowerCase() === "language") language = value;
    }
    if (mfp) {
      emitProgress("session", "done", "En-tête de session API détecté");
      emitReady();
    }
  };

  const routePayload = (url, data, requestId = null) => {
    if (!data || typeof data !== "object") return;
    const queryId = new URL(url, location.href).searchParams.get("queryId");
    if (queryId && data.pollingFlag === false && "result" in data) {
      const origin = queryOrigins.get(queryId);
      emit(origin?.url ?? url, data.result, origin?.requestId ?? requestId);
      emitProgress("activity", "done", "Réponse asynchrone reçue");
      return;
    }
    if (data.queryId) {
      queryOrigins.set(String(data.queryId), { url, requestId });
      emitProgress("activity", "active", "Traitement asynchrone demandé par Manuvie");
    }
    if (!queryId && !data.queryId) {
      emit(url, data, requestId);
      emitProgress("activity", "done", "Réponse API reçue");
    }
  };

  const parseText = (value) => {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  class ObservedXHR extends NativeXHR {
    constructor() {
      super();
      this.__manuvieHeaders = {};
      this.__manuvieUrl = "";
      this.addEventListener("load", () => {
        if (!this.__manuvieUrl.startsWith(API_ORIGIN)) return;
        if (this.status >= 400) {
          emitProgress("activity", "error", `API ${this.status} · ${this.__manuvieUrl}`);
          return;
        }
        const payload =
          this.responseType === "json"
            ? this.response
            : this.responseType === "" || this.responseType === "text"
              ? parseText(this.responseText)
              : null;
        if (!payload) {
          emitProgress("activity", "error", "Réponse API illisible");
          return;
        }
        routePayload(this.__manuvieUrl, payload);
      });
    }

    open(method, url, ...rest) {
      this.__manuvieUrl = new URL(String(url), location.href).href;
      if (this.__manuvieUrl.startsWith(API_ORIGIN))
        emitProgress("activity", "active", new URL(this.__manuvieUrl).pathname);
      return super.open(method, url, ...rest);
    }

    setRequestHeader(name, value) {
      this.__manuvieHeaders[name] = value;
      rememberHeaders(this.__manuvieHeaders);
      return super.setRequestHeader(name, value);
    }
  }

  window.XMLHttpRequest = ObservedXHR;
  window.fetch = async (...args) => {
    const input = args[0];
    const url = new URL(typeof input === "string" ? input : input.url, location.href).href;
    const headers = Object.fromEntries(
      new Headers(args[1]?.headers ?? input?.headers ?? {}).entries(),
    );
    rememberHeaders(headers);
    if (url.startsWith(API_ORIGIN)) emitProgress("activity", "active", new URL(url).pathname);
    let response;
    try {
      response = await nativeFetch(...args);
    } catch (error) {
      if (url.startsWith(API_ORIGIN)) emitProgress("activity", "error", error.message);
      throw error;
    }
    if (url.startsWith(API_ORIGIN)) {
      response
        .clone()
        .json()
        .then((data) => routePayload(url, data))
        .catch(() => undefined);
    }
    return response;
  };

  const requestJson = async (url, requestId) => {
    if (!url.startsWith(API_ORIGIN) || !mfp) throw new Error("Pont API non prêt");
    const response = await nativeFetch(url, {
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        MFP: mfp,
        language,
        Pragma: "no-cache",
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    if (!data.queryId) {
      emit(url, data, requestId);
      return;
    }
    queryOrigins.set(String(data.queryId), { url, requestId });
    const pollUrl = `${API_ORIGIN}async-api/result?queryId=${encodeURIComponent(data.queryId)}`;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const pollResponse = await nativeFetch(pollUrl, {
        credentials: "include",
        headers: { Accept: "application/json", MFP: mfp, language },
      });
      const poll = await pollResponse.json();
      if (poll.pollingFlag === false) {
        emit(url, poll.result, requestId);
        return;
      }
    }
    throw new Error("Délai API dépassé");
  };

  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      event.origin !== location.origin ||
      event.data?.source !== CONTENT_SOURCE
    )
      return;
    if (event.data.type === "api-request") {
      const { url, requestId } = event.data.detail ?? {};
      requestJson(String(url), String(requestId)).catch((error) => {
        emit(String(url), { __manuvieError: error.message }, String(requestId));
      });
      return;
    }
    if (event.data.type !== "sync") return;
    emitProgress("bridge", "done", "Pont principal initialisé");
    for (const detail of recentResponses) {
      window.postMessage({ source: PAGE_SOURCE, type: "api-response", detail }, location.origin);
    }
    if (mfp) emitReady();
  });

  emitProgress("bridge", "done", "Pont principal initialisé");
})();
