export type SaveDestination = 'inbox' | 'daily';

export interface AppSettings {
  apiUrl: string;
  apiKey: string;
  inboxPath: string;
  dailyFolder: string;
  destination: SaveDestination;
  openAfterSave: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiUrl: 'http://127.0.0.1:27123',
  apiKey: '',
  inboxPath: '00-Inbox/AI Clippings.md',
  dailyFolder: 'Daily Notes',
  destination: 'inbox',
  openAfterSave: false,
};

const SETTINGS_KEY = 'local:obsidian-ai-clipper-settings';

export async function getSettings(): Promise<AppSettings> {
  const saved = await storage.getItem<Partial<AppSettings>>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...saved };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await storage.setItem(SETTINGS_KEY, settings);
}

export function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.trim().replace(/\/+$/, '');
}

export function getTargetPath(settings: AppSettings, now = new Date()): string {
  if (settings.destination === 'daily') {
    const date = now.toISOString().slice(0, 10);
    return `${settings.dailyFolder.replace(/\/+$/, '')}/${date}.md`;
  }

  return settings.inboxPath;
}
