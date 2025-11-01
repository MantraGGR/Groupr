Groupr — AI Tab Organizer
=================================

This repo contains a Chrome extension (`groupr-app/`) that organizes tabs into groups using a language model, and a small example backend (`server/`) to proxy LLM requests and enforce an allowlist.

Quick dev flow
--------------
1. Backend
   - Copy `server/.env.example` to `server/.env` and fill `GENERATIVE_API_KEY` and `ALLOWLIST`.
   - From `/server` run `npm install` and `npm start`.
2. Extension
   - In Chrome, open `chrome://extensions`, enable Developer mode, and load unpacked extension pointing to `groupr-app`.
   - Reload the extension after edits.
   - Click the popup -> Add groups -> Test LLM or Organize Tabs. The extension will call the local server at `http://localhost:8080`.

Publishing notes
----------------
- Do NOT embed API keys or allowlist data in the extension. Keep all secrets server-side.
- Prepare a privacy policy and support contact before publishing to the Chrome Web Store.
- For public publishing while limiting who can *use* the LLM features, publish publicly but gate LLM calls via the server allowlist.

If you want, I can:
- Deploy the backend to Cloud Run and update the extension to call the production URL.
- Prepare the OAuth consent package and privacy policy text required by Google for verification.
