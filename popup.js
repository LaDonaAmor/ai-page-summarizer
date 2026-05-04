const el = (id) => document.getElementById(id);

const themeBtn = el("themeToggle");
const themeIcon = el("themeIcon");

const modeSel = el("summaryMode");
const highlightChk = el("enableHighlight");

const summarizeBtn = el("summarizeBtn");
const resetBtn = el("resetBtn");

const statusEl = el("statusMessage");

const outputEl = el("summaryOutput");
const summaryList = el("summaryList");
const insightsList = el("insightsList");
const readingTimeEl = el("readingTime");
const wordCountEl = el("wordCount");
const cachedFlag = el("cacheIndicator");
const copyBtn = el("copyBtn");

const titleEl = el("pageTitle");
const urlEl = el("pageUrl");

let currentTab = null;

init();

async function init() {
  const { theme } = await chrome.storage.local.get("theme");
  applyTheme(theme || "light");

  const { mode, highlightEnabled } = await chrome.storage.local.get([
    "mode",
    "highlightEnabled",
  ]);

  if (mode) modeSel.value = mode;
  if (typeof highlightEnabled === "boolean")
    highlightChk.checked = highlightEnabled;

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    currentTab = tab;
    titleEl.textContent = tab?.title || "(untitled)";
    titleEl.title = tab?.title || "";
    urlEl.textContent = tab?.url || "";

    if (!isInjectableUrl(tab?.url)) {
      setStatus(
        "This page can't be summarized (browser-internal page).",
        "error",
      );
      summarizeBtn.disabled = true;
    }
  } catch (e) {
    setStatus("Could not access the active tab.", "error");
  }

  summarizeBtn.addEventListener("click", () => runSummarize(false));
  resetBtn.addEventListener("click", reset);
  copyBtn.addEventListener("click", copySummary);
  themeBtn.addEventListener("click", toggleTheme);
  modeSel.addEventListener("change", () =>
    chrome.storage.local.set({ highlightEnabled: highlightChk.checked }),
  );
}

function isInjectableUrl(url) {
  if (!url) return false;
  return /^https?:\/\//i.test(url) || /^file:\/\//i.test(url);
}

function setStatus(msg, kind) {
  statusEl.className = "status" + (kind === "error" ? " error" : "");
  statusEl.textContent = "";
  if (kind === "loading") {
    const sp = document.createElement("span");
    sp.className = "spinner";
    statusEl.appendChild(sp);
  }
  if (msg) {
    const t = document.createTextNode(msg);
    statusEl.appendChild(t);
  }
}

async function runSummarize(force) {
  if (!currentTab?.id) return;
  outputEl.hidden = true;
  summarizeBtn.disabled = true;
  setStatus("Reading the page…", "loading");

  try {
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ["content.js"],
    });

    const ext = await chrome.tabs.sendMessage(currentTab.id, {
      action: "EXTRACT",
    });
    if (!ext?.ok) throw new Error(ext?.error || "Extraction failed");
    const { title, url, content } = ext.data;
    if (!content || content.length < 200)
      throw new Error("Not enough readable content on this page.");

    setStatus("Summarizing with AI…", "loading");

    const resp = await chrome.runtime.sendMessage({
      type: "SUMMARIZE",
      payload: { url, title, content, mode: modeSel.value, force },
    });
    if (!resp?.ok) throw new Error(resp?.error || "Summarization failed");

    renderSummary(resp.data, content);

    if (highlightChk.checked && Array.isArray(resp.data.key_phrases)) {
      const hl = await chrome.tabs.sendMessage(currentTab.id, {
        action: "HIGHLIGHT",
        phrases: resp.data.key_phrases,
      });
      if (hl?.ok) {
        setStatus(
          resp.data.cached
            ? `Loaded from cache · highlighted ${hl.data.count} passage(s).`
            : `Done · highlighted ${hl.data.count} passage(s).`,
        );
      } else {
        setStatus(resp.data.cached ? "Loaded from cache." : "Done.");
      }
    } else {
      setStatus(resp.data.cached ? "Loaded from cache." : "Done.");
    }
  } catch (e) {
    setStatus(e?.message || "Something went wrong.", "error");
  } finally {
    summarizeBtn.disabled = false;
  }
}

function renderSummary(data, originalText) {
  summaryList.textContent = "";
  insightsList.textContent = "";

  (data.summary || []).forEach((line) => {
    const li = document.createElement("li");
    li.textContent = String(line);
    summaryList.appendChild(li);
  });
  (data.insights || []).forEach((line) => {
    const li = document.createElement("li");
    li.textContent = String(line);
    insightsList.appendChild(li);
  });

  const minutes = Math.max(
    1,
    Math.round(Number(data.reading_time_minutes) || 1),
  );
  readingTimeEl.textContent = `⏱ ${minutes} min read`;
  const words = (originalText.match(/\S+/g) || []).length;
  wordCountEl.textContent = `📝 ${words.toLocaleString()} words`;
  cachedFlag.hidden = !data.cached;

  outputEl.hidden = false;
}

async function reset() {
  outputEl.hidden = true;
  summaryList.textContent = "";
  insightsList.textContent = "";
  setStatus("");
  if (currentTab?.id && isInjectableUrl(currentTab.url)) {
    try {
      await chrome.tabs.sendMessage(currentTab.id, {
        action: "CLEAR_HIGHLIGHTS",
      });
    } catch (_) {}
  }
  if (currentTab?.url) {
    await chrome.runtime.sendMessage({
      type: "CLEAR_CACHE",
      payload: { url: currentTab.url },
    });
  }
}

async function copySummary() {
  const lines = [];
  lines.push(`# ${currentTab?.title || "Summary"}`);
  lines.push(currentTab?.url || "");
  lines.push("");
  lines.push("## Summary");
  summaryList
    .querySelectorAll("li")
    .forEach((li) => lines.push(`- ${li.textContent}`));
  lines.push("");
  lines.push("## Key insights");
  insightsList
    .querySelectorAll("li")
    .forEach((li) => lines.push(`- ${li.textContent}`));
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    const old = copyBtn.textContent;
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = old), 1500);
  } catch (_) {
    setStatus("Could not copy to clipboard.", "error");
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
}
async function toggleTheme() {
  const cur =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "light"
      : "dark";
  applyTheme(cur);
  await chrome.storage.local.set({ theme: cur });
}
