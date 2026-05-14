import { getTargetPath, normalizeApiUrl, type AppSettings } from './settings';

export type ClipSource = 'selection' | 'clipboard';

export interface ClipPayload {
  text: string;
  source: ClipSource;
  pageTitle?: string;
  pageUrl?: string;
}

export interface SaveResult {
  path: string;
  bytes: number;
  savedAt: string;
}

function encodeVaultPath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function detectOriginLabel(url?: string): string {
  if (!url) return 'Clipboard';

  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.includes('chatgpt.com') || hostname.includes('openai.com')) return 'ChatGPT';
  if (hostname.includes('claude.ai')) return 'Claude';
  if (hostname.includes('gemini.google.com')) return 'Gemini';

  return hostname;
}

function formatDateTime(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatClipMarkdown(payload: ClipPayload, now = new Date()): string {
  const title = payload.pageTitle?.trim() || detectOriginLabel(payload.pageUrl);
  const source = detectOriginLabel(payload.pageUrl);
  const tags = payload.source === 'clipboard' ? '#clip/clipboard' : '#clip/web';
  const urlLine = payload.pageUrl ? `\n链接: ${payload.pageUrl}` : '';

  return [
    '',
    '---',
    '',
    `## ${formatDateTime(now)} - ${title}`,
    '',
    `来源: ${source}${urlLine}`,
    `标签: ${tags}`,
    '',
    '### 内容',
    '',
    payload.text.trim(),
    '',
  ].join('\n');
}

async function request(settings: AppSettings, path: string, init: RequestInit): Promise<Response> {
  const apiUrl = normalizeApiUrl(settings.apiUrl);
  let response: Response;

  try {
    response = await fetch(`${apiUrl}/${path.replace(/^\/+/, '')}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    throw new Error(
      `无法连接 Obsidian Local REST API。请确认 Obsidian 已打开、Local REST API 已启用、地址正确，并且浏览器已信任插件证书。原始错误：${(error as Error).message}`,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`);
  }

  return response;
}

export async function testObsidianConnection(settings: AppSettings): Promise<void> {
  if (!settings.apiKey.trim()) {
    throw new Error('请先填写 Local REST API 密钥。');
  }

  await request(settings, '/', { method: 'GET' });
}

export async function saveClipToObsidian(
  settings: AppSettings,
  payload: ClipPayload,
): Promise<SaveResult> {
  if (!settings.apiKey.trim()) {
    throw new Error('请先在设置页填写 Local REST API 密钥。');
  }

  const path = getTargetPath(settings);
  const markdown = formatClipMarkdown(payload);

  await request(settings, `vault/${encodeVaultPath(path)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/markdown' },
    body: markdown,
  });

  if (settings.openAfterSave) {
    await request(settings, `open/${encodeVaultPath(path)}`, { method: 'POST' });
  }

  return {
    path,
    bytes: new Blob([markdown]).size,
    savedAt: new Date().toISOString(),
  };
}
