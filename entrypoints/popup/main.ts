import './style.css';
import { getSettings, saveSettings } from '@/lib/settings';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="popup">
    <section class="top-row">
      <input id="targetFolder" list="folderList" placeholder="Daily Notes" />
      <datalist id="folderList"></datalist>
      <button class="icon-button" id="settings" title="打开设置" type="button">⚙</button>
    </section>

    <textarea id="preview" placeholder="点击“读取并保存”后会在这里显示内容" spellcheck="false"></textarea>

    <div class="actions">
      <button id="readClipboard" type="button">读取并保存</button>
      <button id="saveClipboard" class="primary" type="button" disabled>发送到 Obsidian</button>
    </div>

    <section class="last-result" id="lastResult">最近保存结果会显示在这里。</section>
  </main>
`;

const previewEl = document.querySelector<HTMLTextAreaElement>('#preview')!;
const readButton = document.querySelector<HTMLButtonElement>('#readClipboard')!;
const saveButton = document.querySelector<HTMLButtonElement>('#saveClipboard')!;
const settingsButton = document.querySelector<HTMLButtonElement>('#settings')!;
const lastResultEl = document.querySelector<HTMLElement>('#lastResult')!;
const targetFolderEl = document.querySelector<HTMLInputElement>('#targetFolder')!;
const folderListEl = document.querySelector<HTMLDataListElement>('#folderList')!;

function updateSaveState() {
  saveButton.disabled = previewEl.value.trim().length === 0;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function refreshLastResult() {
  const result = await browser.runtime.sendMessage({ type: 'get-last-result' });
  if (!result) return;

  lastResultEl.dataset.kind = result.ok ? 'success' : 'error';
  lastResultEl.textContent = result.ok
    ? `最近一次：${formatTime(result.savedAt)} 已保存到 ${result.path}`
    : `最近一次：${formatTime(result.savedAt)} 保存失败：${result.error}`;
}

async function loadFolderChoices() {
  try {
    const result = await browser.runtime.sendMessage({ type: 'list-folders' });
    const folders: string[] = Array.isArray(result?.folders) ? result.folders : [];
    folderListEl.innerHTML = '';
    folders.forEach((folder) => {
      const option = document.createElement('option');
      option.value = folder;
      folderListEl.appendChild(option);
    });
  } catch {
    folderListEl.innerHTML = '';
  }
}

async function saveFolderPreference() {
  const settings = await getSettings();
  const next = targetFolderEl.value.trim() || settings.targetFolder;
  await saveSettings({ ...settings, targetFolder: next });
}

settingsButton.addEventListener('click', () => {
  void browser.runtime.openOptionsPage();
});

targetFolderEl.addEventListener('change', () => {
  void saveFolderPreference();
});

readButton.addEventListener('click', async () => {
  readButton.disabled = true;
  saveButton.disabled = true;

  try {
    const text = await navigator.clipboard.readText();
    previewEl.value = text;
    updateSaveState();

    if (!text.trim()) {
      lastResultEl.dataset.kind = 'error';
      lastResultEl.textContent = '剪贴板里没有文本。';
      return;
    }

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const result = await browser.runtime.sendMessage({
      type: 'save-clip',
      targetFolder: targetFolderEl.value.trim(),
      payload: {
        text,
        source: 'clipboard',
        pageTitle: tab?.title,
        pageUrl: tab?.url,
      },
    });

    await refreshLastResult();
  } catch (error) {
    lastResultEl.dataset.kind = 'error';
    lastResultEl.textContent = `读取或保存失败：${(error as Error).message}`;
    await refreshLastResult();
  } finally {
    readButton.disabled = false;
    updateSaveState();
  }
});

previewEl.addEventListener('input', updateSaveState);

saveButton.addEventListener('click', async () => {
  saveButton.disabled = true;

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const result = await browser.runtime.sendMessage({
      type: 'save-clip',
      targetFolder: targetFolderEl.value.trim(),
      payload: {
        text: previewEl.value,
        source: 'clipboard',
        pageTitle: tab?.title,
        pageUrl: tab?.url,
      },
    });

    await refreshLastResult();
  } catch (error) {
    lastResultEl.dataset.kind = 'error';
    lastResultEl.textContent = `保存失败：${(error as Error).message}`;
    await refreshLastResult();
  } finally {
    updateSaveState();
  }
});

const settings = await getSettings();
targetFolderEl.value = settings.targetFolder;
await loadFolderChoices();
void refreshLastResult();
