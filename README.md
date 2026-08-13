# Bikroy Ad Tracker

A Chrome/Firefox extension that tracks ad review activity for the Bikroy admin moderation team and keeps it in sync with a live Firebase backend.

## What it does

Reviewing ads on Bikroy's admin panel is a queue-based job spread across several team members. This extension turns that into something a supervisor can actually see in real time:

- Runs review sessions per agent directly from a popup, pulling from the different review queues (Member, Listing Fee, General, Manager, Fraud, Edited, Verification, Email)
- Tracks live counts per agent and per queue as reviews happen
- Syncs everything to Firebase Realtime Database so the numbers update instantly across devices
- Ships with a companion mobile dashboard (see [`bikroy_agent_tracking_mobile_dashboard`](https://github.com/roni2026/bikroy_agent_tracking_mobile_dashboard)) so a manager can check progress from a phone without opening the extension
- Popup can be popped out into its own window for a permanent on-screen view

## How it's built

- Manifest V3 extension, background logic runs as a service worker (`background.js`)
- Firebase is loaded as an ES module directly in the service worker — no build step needed
- `popup.js` handles all the UI: starting/stopping agent sessions, showing per-agent stats, and a permissions modal for managing what each agent is allowed to review
- `content.js` is a lightweight injected script reserved for future page-level interaction; all current logic runs through `chrome.scripting.executeScript` calls from the background worker
- A Firefox build variant lives under `firefox/` with its own manifest

## Setup

1. Load the extension unpacked in Chrome (`chrome://extensions` → Developer mode → Load unpacked) or Firefox (`about:debugging`) pointing at this folder.
2. Add your own `firebase-config.js` with a Firebase project's config object — this file is intentionally not committed since it's project-specific.
3. Update `host_permissions` in `manifest.json` if you're pointing this at a different admin domain.

## Notes

Agent names, IDs, and permission URLs are hardcoded in `background.js` and `popup.js` to match the current review team. If the team changes, update the `agents` object in both files — they're kept in sync manually.
