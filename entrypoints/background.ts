import { getSettings } from '@/lib/settings';
import { saveClipToObsidian, testObsidianConnection, type ClipPayload, type SaveResult } from '@/lib/obsidian';

const CONTEXT_MENU_ID = 'save-selection-to-obsidian';
const LAST_RESULT_KEY = 'local:last-save-result';

type RuntimeMessage =
  | { type: 'save-clip'; payload: ClipPayload }
  | { type: 'test-connection' }
  | { type: 'get-last-result' };

type LastSaveResult = {
  ok: boolean;
  source: ClipPayload['source'];
  path?: string;
  bytes?: number;
  savedAt: string;
  error?: string;
};

async function saveLastResult(result: LastSaveResult): Promise<void> {
  await storage.setItem(LAST_RESULT_KEY, result);
}

async function setBadge(ok: boolean): Promise<void> {
  await browser.action.setBadgeText({ text: ok ? 'OK' : 'ERR' });
  await browser.action.setBadgeBackgroundColor({ color: ok ? '#26683f' : '#9b321d' });
  setTimeout(() => {
    void browser.action.setBadgeText({ text: '' });
  }, 5000);
}

async function showNotification(title: string, message: string): Promise<void> {
  await browser.notifications.create({
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title,
    message,
  });
}

async function createContextMenu(): Promise<void> {
  await browser.contextMenus.removeAll();
  await browser.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: '保存选中文字到 Obsidian',
    contexts: ['selection'],
  });
}

async function showPageToast(tabId: number | undefined, message: string, ok: boolean): Promise<void> {
  if (!tabId) return;

  await browser.scripting
    .executeScript({
      target: { tabId },
      func: (toastMessage: string, isOk: boolean) => {
        const existing = document.getElementById('obsidian-ai-clipper-toast');
        existing?.remove();

        const toast = document.createElement('div');
        toast.id = 'obsidian-ai-clipper-toast';
        toast.textContent = toastMessage;
        Object.assign(toast.style, {
          position: 'fixed',
          zIndex: '2147483647',
          top: '18px',
          right: '18px',
          maxWidth: '360px',
          padding: '12px 14px',
          borderRadius: '8px',
          border: `1px solid ${isOk ? '#a9d4bb' : '#e4b8a7'}`,
          background: isOk ? '#dff2e8' : '#f9e6df',
          color: isOk ? '#173d27' : '#6a2919',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.16)',
          font: '14px/1.45 "Segoe UI", "Microsoft YaHei", sans-serif',
          whiteSpace: 'pre-wrap',
        });
        document.body.appendChild(toast);
        window.setTimeout(() => toast.remove(), 5200);
      },
      args: [message, ok],
    })
    .catch(() => undefined);
}

async function handleSave(payload: ClipPayload) {
  const settings = await getSettings();
  const result = await saveClipToObsidian(settings, payload);
  const lastResult: LastSaveResult = {
    ok: true,
    source: payload.source,
    path: result.path,
    bytes: result.bytes,
    savedAt: result.savedAt,
  };
  await saveLastResult(lastResult);
  await setBadge(true);
  return { ok: true, ...result };
}

async function handleFailure(payload: ClipPayload, error: Error): Promise<LastSaveResult> {
  const lastResult: LastSaveResult = {
    ok: false,
    source: payload.source,
    savedAt: new Date().toISOString(),
    error: error.message,
  };
  await saveLastResult(lastResult);
  await setBadge(false);
  return lastResult;
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void createContextMenu();
  });

  void createContextMenu();

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText?.trim()) return;

    const payload: ClipPayload = {
      text: info.selectionText,
      source: 'selection',
      pageTitle: tab?.title,
      pageUrl: info.pageUrl,
    };

    void handleSave(payload)
      .then((result: SaveResult) => {
        const message = `已保存到 Obsidian\n${result.path}`;
        void showNotification('已保存到 Obsidian', result.path);
        void showPageToast(tab?.id, message, true);
      })
      .catch((error: Error) => {
        void handleFailure(payload, error);
        void showNotification('保存失败', error.message);
        void showPageToast(tab?.id, `保存失败\n${error.message}`, false);
      });
  });

  browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (message.type === 'save-clip') {
      return handleSave(message.payload).catch(async (error: Error) => {
        await handleFailure(message.payload, error);
        throw error;
      });
    }

    if (message.type === 'test-connection') {
      return getSettings()
        .then(testObsidianConnection)
        .then(() => ({ ok: true }));
    }

    if (message.type === 'get-last-result') {
      return storage.getItem<LastSaveResult>(LAST_RESULT_KEY);
    }

    return undefined;
  });
});
