# Universal Tracker AI — Chrome Extension

AI‑assisted variant of Universal Tracker. Prefills category, tags, and summary notes using Gemini 2.0 Flash (Google AI Studio), with the same local‑first storage and optional Google Sheets sync.

## What’s Different

- AI prefill (opt‑in): category, tags, summary notes; optional reminder suggestion.
- Prefill‑only: AI never overwrites fields you’ve already typed.
- Options page adds Google AI Studio API key and per‑field toggles.

## Install (Side‑by‑Side)

1. Keep your original extension loaded from the root folder.
2. Load this AI variant from `universal-tracker-ai/` via `chrome://extensions` → Load unpacked.
3. They have different IDs; storage and settings are isolated.

## AI Setup (Google AI Studio)

1. Create a Google AI Studio API key (Gemini 2.0 Flash).
2. Open Options and paste the key into “Google AI Studio API key”.
3. Enable toggles for Prefill category/tags/summary/reminder as desired.
4. Click “Test AI” to validate; then open the popup on a page.

Notes:
- Only minimal metadata is sent: title, host, cleaned URL, and meta description.
- Prefill is fast and has a short timeout so the popup stays snappy.
