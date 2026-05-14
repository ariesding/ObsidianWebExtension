# Obsidian AI Clipper

A WXT Chrome extension that saves selected text and clipboard text into Obsidian through the Local REST API plugin.

## Features

- Right-click selected text on any webpage and save it to Obsidian.
- Read clipboard text in the popup, preview it, then send it to Obsidian.
- Show save feedback with a page toast, extension badge, notification, and popup history.
- Configure Local REST API URL, API key, target Inbox file, daily note folder, and whether to open the note after saving.
- Test the Local REST API connection from the options page.

## Defaults

- API URL: `http://127.0.0.1:27123`
- Inbox path: `00-Inbox/AI Clippings.md`
- Save mode: append to the target note

## Local Setup

1. In Obsidian, install and enable the Local REST API plugin.
2. Copy the API key from Obsidian settings.
3. Build the extension:

```sh
npm install
npm run build
```

4. In Chrome, open `chrome://extensions`, enable Developer mode, and load `.output/chrome-mv3` as an unpacked extension.
5. Open the extension options page, paste the API key, and click `测试连接`.

If Chrome rejects the HTTPS request, trust the certificate provided by the Local REST API plugin first.
