# AI Page Summarizer (Chrome Extension)

A local Chrome Extension built with Manifest V3 that extracts readable content from the active webpage, sends it to a secure AI proxy, and displays a structured summary in the extension popup.

The extension is designed to work out of the box for reviewers. Users do not need to enter an OpenAI, Gemini, or Supabase key in the popup.

## Features

- Extracts meaningful page content from the active tab
- Filters common clutter such as navigation, headers, footers, sidebars, ads, forms, and comments
- Sends extracted content to a Supabase Edge Function AI proxy
- Displays a bullet-point summary
- Displays key insights
- Shows estimated reading time and word count
- Caches summaries per URL with `chrome.storage.local`
- Prevents duplicate AI calls for recently summarized pages
- Optional in-page highlighting for important phrases
- Clear/reset action for cached result and highlights
- Dark/light mode setting
- Copy summary button
- Loading spinner and graceful error states

## Project Structure

```text
.
|-- manifest.json                       # Manifest V3 extension config
|-- background.js                       # Service worker for API calls, caching, and message handling
|-- content.js                          # Page extraction and optional highlighting
|-- popup.html                          # Popup markup
|-- popup.js                            # Popup behavior and Chrome messaging
|-- popup.css                           # Popup styles
|-- config.js                           # Public Supabase endpoint and anon key
|-- icons/                              # Extension icon assets
|-- supabase/
|   |-- config.toml                     # Supabase project config
|   `-- functions/
|       `-- summarize/
|           |-- index.ts                # Secure AI proxy function
|           `-- deno.json
|-- package.json
`-- README.md
```

## Setup and Installation

This is a local extension and should not be uploaded to the Chrome Web Store.

1. Download or clone this repository.

```bash
git clone https://github.com/LaDonaAmor/ai-page-summarizer
cd ai-page-summarizer
```

2. Install dependencies if you want to work on the Supabase function locally.

```bash
npm install
```

3. Open Chrome and go to:

```text
chrome://extensions/
```

4. Turn on **Developer mode**.

5. Click **Load unpacked**.

6. Select the project folder that contains `manifest.json`.

7. Open any readable article page and click the **AI Page Summarizer** extension icon.

8. Click **Summarize Page**.

## How It Works

```text
Popup -> Content Script -> Background Service Worker -> Supabase Edge Function -> Gemini API
```

1. The popup reads the active tab title and URL.
2. When the user clicks **Summarize Page**, the popup injects the content script into the active tab.
3. The content script extracts the most readable page content using article/main selectors and scoring heuristics.
4. The popup sends the extracted content to the background service worker.
5. The background service worker checks `chrome.storage.local` for a cached summary.
6. If no valid cache exists, the service worker calls the Supabase Edge Function.
7. The Supabase Edge Function calls Gemini using a server-side secret.
8. The structured response is returned to the popup and rendered with safe DOM APIs.

## AI Integration

The extension does not call Gemini directly from the browser. Instead, it calls a Supabase Edge Function:

```text
https://gwfxlojrhayfekfxvzjz.supabase.co/functions/v1/summarize
```

The Edge Function reads `GEMINI_API_KEY` from Supabase environment secrets:

```ts
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
```

The browser extension contains only the public Supabase URL and Supabase anon key needed to call the deployed function. The actual AI provider key is never committed to the repository and is never exposed in the popup, content script, or extension UI.

## Security Decisions

- Uses Manifest V3 only
- Uses a background service worker for AI requests
- Keeps the Gemini API key out of the frontend bundle
- Does not ask users to enter an API key
- Does not commit `.env` files or local secret files
- Uses `textContent` and DOM node creation when rendering AI output to reduce XSS risk
- Validates message shape before handling runtime and tab messages
- Uses `activeTab`, `scripting`, and `storage` permissions
- Limits host permissions to the deployed Supabase backend
- Injects highlights with sanitized text nodes instead of raw HTML

## Caching

Summaries are cached in `chrome.storage.local` using this key format:

```text
summary:<mode>:<url>
```

Cached summaries expire after 24 hours. The reset button clears the current page cache and removes highlights from the page.

## Trade-offs

- The extension uses custom extraction heuristics instead of a full readability package. This keeps the extension smaller and avoids extra bundle complexity, but some unusual page layouts may produce less precise extraction.
- The Supabase anon key is included in the extension because it is a public client key. The sensitive Gemini key remains server-side.
- The extension caches per URL and summary mode, which improves speed and cost, but a page that changes frequently may need reset/refresh to force a new summary.
- Optional highlighting is phrase-based, so exact matches work best when the AI returns phrases that appear verbatim on the page.

## Local Backend Development

The deployed extension is configured to call the hosted Supabase function. For local backend work, configure the Gemini key as a Supabase secret and deploy the function:

```bash
supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>
supabase functions deploy summarize
```

Do not commit local `.env` files, API keys, or secret exports.

## Demo Video

Add your 2-5 minute demo video link here before final submission:

```text
Demo video: https://www.loom.com/share/6d09c16bce5b4efe8d0531b458a0f018
```

## Submission Checklist

- [x] Manifest V3 extension
- [x] Background service worker
- [x] Popup UI
- [x] Content script
- [x] AI proxy integration
- [x] No AI provider key in frontend code
- [x] `chrome.storage` caching
- [x] Graceful loading and error states
- [x] README setup, architecture, AI integration, security, and trade-offs
- [ ] Demo video link added

---

## License

Built for the HNGi14 internship Task.

## Author

Racheal I. Ogunmodede (TechNurse)

---
