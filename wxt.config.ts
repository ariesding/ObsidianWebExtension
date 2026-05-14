import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Obsidian AI Clipper',
    description: 'Save selected text and clipboard content to Obsidian via Local REST API.',
    permissions: ['activeTab', 'contextMenus', 'storage', 'clipboardRead', 'notifications', 'scripting'],
    host_permissions: [
      'https://127.0.0.1/*',
      'https://localhost/*',
      'http://127.0.0.1/*',
      'http://localhost/*',
    ],
  },
});
