import './style.css';
import { DEFAULT_SETTINGS, getSettings, saveSettings, type AppSettings, type SaveDestination } from '@/lib/settings';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="settings">
    <header>
      <p class="eyebrow">Obsidian AI Clipper</p>
      <h1>连接 Local REST API</h1>
      <p>填写 Obsidian Local REST API 的地址和密钥。默认追加到固定 Inbox，也可以改成每日笔记。</p>
    </header>

    <form id="settingsForm">
      <label>
        API 地址
        <input id="apiUrl" name="apiUrl" autocomplete="off" placeholder="http://127.0.0.1:27123" />
      </label>

      <label>
        API 密钥
        <input id="apiKey" name="apiKey" type="password" autocomplete="off" placeholder="Local REST API 设置里的 API Key" />
      </label>

      <fieldset>
        <legend>保存位置</legend>
        <label class="radio">
          <input id="destinationInbox" name="destination" type="radio" value="inbox" />
          固定 Inbox 文件
        </label>
        <label class="radio">
          <input id="destinationDaily" name="destination" type="radio" value="daily" />
          每日笔记
        </label>
      </fieldset>

      <label>
        Inbox 文件路径
        <input id="inboxPath" name="inboxPath" autocomplete="off" placeholder="00-Inbox/AI Clippings.md" />
      </label>

      <label>
        每日笔记文件夹
        <input id="dailyFolder" name="dailyFolder" autocomplete="off" placeholder="Daily Notes" />
      </label>

      <label class="checkbox">
        <input id="openAfterSave" name="openAfterSave" type="checkbox" />
        保存后在 Obsidian 打开目标笔记
      </label>

      <div class="actions">
        <button id="save" class="primary" type="submit">保存设置</button>
        <button id="test" type="button">测试连接</button>
      </div>

      <p id="status" class="status"></p>
    </form>

    <section class="hint">
      <h2>证书提示</h2>
      <p>建议先使用 <code>http://127.0.0.1:27123</code>。如果改用 HTTPS 地址 <code>https://127.0.0.1:27124</code>，需要先按插件说明信任证书。</p>
    </section>
  </main>
`;

const form = document.querySelector<HTMLFormElement>('#settingsForm')!;
const statusEl = document.querySelector<HTMLParagraphElement>('#status')!;
const apiUrlEl = document.querySelector<HTMLInputElement>('#apiUrl')!;
const apiKeyEl = document.querySelector<HTMLInputElement>('#apiKey')!;
const inboxPathEl = document.querySelector<HTMLInputElement>('#inboxPath')!;
const dailyFolderEl = document.querySelector<HTMLInputElement>('#dailyFolder')!;
const openAfterSaveEl = document.querySelector<HTMLInputElement>('#openAfterSave')!;
const destinationInboxEl = document.querySelector<HTMLInputElement>('#destinationInbox')!;
const destinationDailyEl = document.querySelector<HTMLInputElement>('#destinationDaily')!;
const testButton = document.querySelector<HTMLButtonElement>('#test')!;

function setStatus(message: string, kind: 'success' | 'error' | 'idle' = 'idle') {
  statusEl.textContent = message;
  statusEl.dataset.kind = kind;
}

function readForm(): AppSettings {
  return {
    apiUrl: apiUrlEl.value.trim() || DEFAULT_SETTINGS.apiUrl,
    apiKey: apiKeyEl.value.trim(),
    inboxPath: inboxPathEl.value.trim() || DEFAULT_SETTINGS.inboxPath,
    dailyFolder: dailyFolderEl.value.trim() || DEFAULT_SETTINGS.dailyFolder,
    destination: (destinationDailyEl.checked ? 'daily' : 'inbox') as SaveDestination,
    openAfterSave: openAfterSaveEl.checked,
  };
}

function writeForm(settings: AppSettings) {
  apiUrlEl.value = settings.apiUrl;
  apiKeyEl.value = settings.apiKey;
  inboxPathEl.value = settings.inboxPath;
  dailyFolderEl.value = settings.dailyFolder;
  openAfterSaveEl.checked = settings.openAfterSave;
  destinationInboxEl.checked = settings.destination === 'inbox';
  destinationDailyEl.checked = settings.destination === 'daily';
}

writeForm(await getSettings());

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await saveSettings(readForm());
  setStatus('设置已保存。', 'success');
});

testButton.addEventListener('click', async () => {
  await saveSettings(readForm());
  setStatus('正在测试连接...');

  try {
    await browser.runtime.sendMessage({ type: 'test-connection' });
    setStatus('连接成功。', 'success');
  } catch (error) {
    setStatus(`连接失败：${(error as Error).message}`, 'error');
  }
});
