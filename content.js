(function () {
  if (window.__aiSummarizerInjected) return;
  window.__aiSummarizerInjected = true;

  const BLOCK_SELECTORS = [
    "script",
    "style",
    "noscript",
    "nav",
    "header",
    "footer",
    "aside",
    "form",
    "iframe",
    "svg",
    "[role=navigation]",
    "[role=banner]",
    "[role=contentinfo]",
    "[aria-hidden=true]",
    ".sidebar",
    ".nav",
    ".menu",
    ".advert",
    ".ads",
    "#comments",
  ];

  function cleanClone(root) {
    const clone = root.cloneNode(true);
    clone
      .querySelectorAll(BLOCK_SELECTORS.join(","))
      .forEach((el) => el.remove());
    return clone;
  }

  function scoreNode(node) {
    const text = node.innerText || "";
    const len = text.length;
    if (len < 200) return 0;
    const pCount = node.getElementsByTagName("p").length;
    const linkLen = Array.from(node.getElementsByTagName("a")).reduce(
      (n, a) => n + (a.innerText || "").length,
      0,
    );
    const linkDensity = linkLen / Math.max(len, 1);
    return len + pCount * 50 - linkDensity * len;
  }

  function pickMain() {
    const candidates = [
      document.querySelector("article"),
      document.querySelector("main"),
      document.querySelector("[role=main]"),
      document.querySelector("#content"),
      document.querySelector(".content"),
      document.querySelector(".post"),
      document.querySelector(".article"),
    ].filter(Boolean);

    const all = document.body
      ? Array.from(document.body.querySelectorAll("div,section,article,main"))
      : [];
    const ranked = [...candidates, ...all]
      .map((n) => ({ n, s: scoreNode(n) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);

    return ranked[0]?.n || document.body;
  }

  function extract() {
    const main = pickMain();
    if (!main)
      return { title: document.title, url: location.href, content: "" };
    const cleaned = cleanClone(main);
    let text = (cleaned.innerText || "").replace(/\s+\n/g, "\n").trim();
    text = text.replace(/\n{3,}/g, "\n\n");
    return {
      title: document.title,
      url: location.href,
      content: text,
    };
  }

  function highlight(phrases) {
    removeHighlights();
    if (!Array.isArray(phrases) || !phrases.length) return 0;

    if (!document.getElementById("ai-summarizer-style")) {
      const style = document.createElement("style");
      style.id = "ai-summarizer-style";
      style.textContent =
        ".__ai-sum-hl{background:linear-gradient(180deg,transparent 55%,#fde68a 55%);padding:0 2px;border-radius:2px;}";
      document.head.appendChild(style);
    }

    let count = 0;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim())
            return NodeFilter.FILTER_REJECT;
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          const tag = p.tagName;
          if (
            tag === "SCRIPT" ||
            tag === "STYLE" ||
            tag === "NOSCRIPT" ||
            p.closest(".__ai-sum-hl")
          )
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    const textNodes = [];
    let cur;
    while ((cur = walker.nextNode())) textNodes.push(cur);

    const lowered = phrases
      .map((p) => (typeof p === "string" ? p.trim() : ""))
      .filter((p) => p.length >= 6)
      .map((p) => p.toLowerCase());

    for (const node of textNodes) {
      const text = node.nodeValue;
      const lower = text.toLowerCase();
      let matchIdx = -1;
      let matchLen = 0;
      for (const phrase of lowered) {
        const idx = lower.indexOf(phrase);
        if (idx !== -1 && phrase.length > matchLen) {
          matchIdx = idx;
          matchLen = phrase.length;
        }
      }
      if (matchIdx === -1) continue;
      try {
        const before = document.createTextNode(text.slice(0, matchIdx));
        const mark = document.createElement("mark");
        mark.className = "__ai-sum-hl";
        mark.textContent = text.slice(matchIdx, matchIdx + matchLen);
        const after = document.createTextNode(text.slice(matchIdx + matchLen));
        const parent = node.parentNode;
        parent.insertBefore(before, node);
        parent.insertBefore(mark, node);
        parent.insertBefore(after, node);
        parent.removeChild(node);
        count++;
      } catch (_) {}
    }

    const first = document.querySelector(".__ai-sum-hl");
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
    return count;
  }

  function removeHighlights() {
    document.querySelectorAll(".__ai-sum-hl").forEach((el) => {
      const parent = el.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(el.textContent || ""), el);
      parent.normalize();
    });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== "object") {
      sendResponse({ ok: false, error: "Invalid message" });
      return false;
    }
    try {
      if (msg.action === "EXTRACT") {
        sendResponse({ ok: true, data: extract() });
        return false;
      }
      if (msg.action === "HIGHLIGHT") {
        const phrases = Array.isArray(msg.phrases) ? msg.phrases : [];
        const count = highlight(phrases);
        sendResponse({ ok: true, data: { count } });
        return false;
      }
      if (msg.action === "CLEAR_HIGHLIGHTS") {
        removeHighlights();
        sendResponse({ ok: true });
        return false;
      }
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || "Content script error" });
      return false;
    }
    sendResponse({ ok: false, error: "Unknown action" });
    return false;
  });
})();
