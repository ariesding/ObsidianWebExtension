import './style.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="popup">
    <header>
      <div>
        <p class="eyebrow">Obsidian AI Clipper</p>
        <h1>保存剪贴板</h1>
      </div>
      <button class="icon-button" id="settings" title="打开设置" type="button">⚙</button>
    </header>

    <section class="flow">
      <span>1. 复制内容</span>
      <span>2. 读取剪贴板</span>
      <span>3. 发送到 Obsidian</span>
    </section>

    <section class="status" id="status">点击“读取剪贴板”，确认预览内容后再发送。</section>

    <textarea id="preview" placeholder="点击“读取剪贴板”后在这里预览内容" spellcheck="false"></textarea>

    <div class="actions">
      <button id="readClipboard" type="button">读取剪贴板</button>
      <button id="saveClipboard" class="primary" type="button" disabled>发送到 Obsidian</button>
    </div>

    <section class="last-result" id="lastResult">最近保存结果会显示在这里。</section>
  </main>
`;

const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const previewEl = document.querySelector<HTMLTextAreaElement>('#preview')!;
const readButton = document.querySelector<HTMLButtonElement>('#readClipboard')!;
const saveButton = document.querySelector<HTMLButtonElement>('#saveClipboard')!;
const settingsButton = document.querySelector<HTMLButtonElement>('#settings')!;
const lastResultEl = document.querySelector<HTMLElement>('#lastResult')!;

function setStatus(message: string, kind: 'idle' | 'success' | 'error' = 'idle') {
  statusEl.textContent = message;
  statusEl.dataset.kind = kind;
}

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

settingsButton.addEventListener('click', () => {
  void browser.runtime.openOptionsPage();
});

readButton.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    previewEl.value = text;
    updateSaveState();
    setStatus(text.trim() ? `已读取 ${text.trim().length} 个字符，确认后发送。` : '剪贴板里没有文本。');
  } catch (error) {
    setStatus(`读取失败：${(error as Error).message}`, 'error');
  }
});

previewEl.addEventListener('input', updateSaveState);

saveButton.addEventListener('click', async () => {
  saveButton.disabled = true;
  setStatus('正在发送到 Obsidian...');

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const result = await browser.runtime.sendMessage({
      type: 'save-clip',
      payload: {
        text: previewEl.value,
        source: 'clipboard',
        pageTitle: tab?.title,
        pageUrl: tab?.url,
      },
    });

    setStatus(`已保存到 ${result.path}，写入 ${result.bytes} bytes。`, 'success');
    await refreshLastResult();
  } catch (error) {
    setStatus(`保存失败：${(error as Error).message}`, 'error');
    await refreshLastResult();
  } finally {
    updateSaveState();
  }
});

void refreshLastResult();
