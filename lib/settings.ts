export interface AppSettings {
  apiUrl: string;
  apiKey: string;
  targetFolder: string;
  openAfterSave: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiUrl: 'http://127.0.0.1:27123',
  apiKey: '',
  targetFolder: 'Daily Notes',
  openAfterSave: false,
};

const SETTINGS_KEY = 'local:obsidian-ai-clipper-settings';

export async function getSettings(): Promise<AppSettings> {
  const saved = await storage.getItem<Record<string, unknown>>(SETTINGS_KEY);
  const targetFolder =
    typeof saved?.targetFolder === 'string' && saved.targetFolder.trim()
      ? saved.targetFolder.trim()
      : typeof saved?.dailyFolder === 'string' && saved.dailyFolder.trim()
        ? saved.dailyFolder.trim()
        : DEFAULT_SETTINGS.targetFolder;

  return {
    apiUrl: typeof saved?.apiUrl === 'string' && saved.apiUrl.trim() ? saved.apiUrl : DEFAULT_SETTINGS.apiUrl,
    apiKey: typeof saved?.apiKey === 'string' ? saved.apiKey : DEFAULT_SETTINGS.apiKey,
    targetFolder,
    openAfterSave: typeof saved?.openAfterSave === 'boolean' ? saved.openAfterSave : DEFAULT_SETTINGS.openAfterSave,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await storage.setItem(SETTINGS_KEY, settings);
}

export function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.trim().replace(/\/+$/, '');
}
