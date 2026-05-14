import './style.css';
import { DEFAULT_SETTINGS, getSettings, saveSettings, type AppSettings } from '@/lib/settings';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="settings">
    <form id="settingsForm">
      <label>
        API 地址
        <input id="apiUrl" name="apiUrl" autocomplete="off" placeholder="http://127.0.0.1:27123" />
      </label>

      <label>
        API 密钥
        <input id="apiKey" name="apiKey" type="password" autocomplete="off" placeholder="Local REST API 设置里的 API Key" />
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
      <p>建议先使用 <code>http://127.0.0.1:27123</code>。如果改用 HTTPS 地址 <code>https://127.0.0.1:27124</code>，需要先按插件说明信任证书。</p>
    </section>
  </main>
`;

const form = document.querySelector<HTMLFormElement>('#settingsForm')!;
const statusEl = document.querySelector<HTMLParagraphElement>('#status')!;
const apiUrlEl = document.querySelector<HTMLInputElement>('#apiUrl')!;
const apiKeyEl = document.querySelector<HTMLInputElement>('#apiKey')!;
const openAfterSaveEl = document.querySelector<HTMLInputElement>('#openAfterSave')!;
const testButton = document.querySelector<HTMLButtonElement>('#test')!;

function setStatus(message: string, kind: 'success' | 'error' | 'idle' = 'idle') {
  statusEl.textContent = message;
  statusEl.dataset.kind = kind;
}

async function readForm(): Promise<AppSettings> {
  const current = await getSettings();
  return {
    apiUrl: apiUrlEl.value.trim() || DEFAULT_SETTINGS.apiUrl,
    apiKey: apiKeyEl.value.trim(),
    targetFolder: current.targetFolder || DEFAULT_SETTINGS.targetFolder,
    openAfterSave: openAfterSaveEl.checked,
  };
}

function writeForm(settings: AppSettings) {
  apiUrlEl.value = settings.apiUrl;
  apiKeyEl.value = settings.apiKey;
  openAfterSaveEl.checked = settings.openAfterSave;
}

writeForm(await getSettings());

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await saveSettings(await readForm());
  setStatus('设置已保存。', 'success');
});

testButton.addEventListener('click', async () => {
  await saveSettings(await readForm());
  setStatus('正在测试连接...');

  try {
    await browser.runtime.sendMessage({ type: 'test-connection' });
    setStatus('连接成功。', 'success');
  } catch (error) {
    setStatus(`连接失败：${(error as Error).message}`, 'error');
  }
});
