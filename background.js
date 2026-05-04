import { SUMMARIZE_URL, SUPABASE_ANON_KEY } from "./config.js";

const CACHE_PREFIX = "summary:";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    sendResponse({ ok: false, error: "Invalid message" });
    return false;
  }

  if (message.type === "SUMMARIZE") {
    handleSummarize(message.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) =>
        sendResponse({ ok: false, error: err?.message || "Unknown error" }),
      );
    return true;
  }

  if (message.type === "CLEAR_CACHE") {
    clearCache(message.payload?.url)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err?.message }));
    return true;
  }

  sendResponse({ ok: false, error: "Unknown message type" });
  return false;
});

async function handleSummarize(payload) {
  const { url, title, content, mode, force } = payload || {};
  if (!url || !content) throw new Error("Missing url or content");

  const cacheKey = CACHE_PREFIX + mode + ":" + url;

  if (!force) {
    const cached = await readCache(cacheKey);
    if (cached) return { ...cached, cached: true };
  }

  const res = await fetch(SUMMARIZE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ url, title, content, mode }),
  });

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch (_) {}
    throw new Error(msg);
  }

  const data = await res.json();
  await writeCache(cacheKey, data);
  return { ...data, cached: false };
}

async function readCache(key) {
  const obj = await chrome.storage.local.get(key);
  const entry = obj?.[key];
  if (!entry) return null;
  if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
    await chrome.storage.local.remove(key);
    return null;
  }
  return entry.data;
}

async function writeCache(key, data) {
  await chrome.storage.local.set({
    [key]: { savedAt: Date.now(), data },
  });
}

async function clearCache(url) {
  if (url) {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter(
      (k) => k.startsWith(CACHE_PREFIX) && k.endsWith(":" + url),
    );
    if (keys.length) await chrome.storage.local.remove(keys);
    return;
  }
  await chrome.storage.local.clear();
}
