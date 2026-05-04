# AI Page Summarizer (Chrome Extension)

A professional Chrome Extension built with **Manifest V3** that leverages AI to provide instant, structured summaries of web articles.

This tool helps developers and readers **save time** by extracting key insights and estimating reading time directly within the browser.

---

## Features

### Intelligent Extraction

Uses a heuristic-based content script to filter out:

- Navbars
- Sidebars
- Ads

Focuses only on the **main readable article content**.

---

### AI-Powered Summaries

Integrated with a **Supabase Edge Function** (Gemini) to generate:

- Bullet-point summaries
- Key insights
- Reading time estimates

---

### In-Page Highlights

- Highlights important phrases directly on the webpage
- Automatically scrolls to key sections

---

### Smart Caching

- Uses `chrome.storage` to cache summaries
- Prevents duplicate API calls
- Cache duration: **24 hours**

---

### Modern UI

- Responsive popup interface
- Dark / Light mode support
- Loading states & animations
- Copy-to-clipboard functionality

---

## Project Structure

```
├── manifest.json         # Extension configuration (Manifest V3)
├── background.js         # Service worker (API calls, caching)
├── content.js            # Content extraction & highlighting logic
├── popup.html            # UI structure
├── popup.js              # UI logic & messaging
├── popup.css             # Styling
├── config.js             # API endpoints & keys
└── icons/                # Extension assets
```

---

# Setup & Installation

This is a **local development extension** (not published to Chrome Web Store).

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/ai-page-summarizer.git
cd ai-page-summarizer
```

---

### 2. Install Dependencies (Optional)

```bash
npm install
```

---

### 3. Load Extension in Chrome

1. Open Chrome and go to:

   ```
   chrome://extensions/
   ```

2. Enable:
   **Developer mode** (top right)

3. Click:
   **Load unpacked**

4. Select the project folder (where `manifest.json` is located)

---

## Security & Architecture

### Secret Management

- API keys are stored securely in the **background service worker**
- Never exposed in `content.js` or UI
- Prevents XSS-based key leaks

---

### Data Flow

```
Popup → Content Script → Background Worker → AI API → Popup UI
```

1. Popup requests page extraction
2. Content script extracts readable content
3. Background worker sends request to AI
4. Response is returned and rendered

---

### Permission Minimalism

Only required permissions are used:

- `activeTab`
- `scripting`
- `storage`

This keeps the extension secure and lightweight.

---

## Trade-offs & Decisions

### Heuristic Extraction vs Library

- Chose custom scoring instead of heavy libraries (e.g., Readability.js)
- Result:
  - Smaller bundle size
  - Better performance
  - More control

---

### Proxy Backend (Supabase)

- AI calls are routed through a **Supabase Edge Function**
- Prevents exposing API keys in frontend code
- Enables:
  - Rate limiting
  - Logging
  - Future scalability

---

## Future Improvements

- Streaming summaries (real-time typing effect)
- Multiple summary styles (TL;DR, detailed, technical)
- Multi-language support
- Better highlight accuracy
- Offline caching enhancements

---

## License

Built for the HNGi14 internship Task.

## Author

Racheal I. Ogunmodede (TechNurse)

---
