export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    const SETTINGS_KEY = 'local:obsidian-ai-clipper-settings';
    const LAST_CLIPBOARD_KEY = 'local:obsidian-ai-clipper-last-clipboard-text';
    let lastText = '';
    let lastAt = 0;
    let currentText = '';
    let cachedFolder = 'Daily Notes';
    let globalLastClipboard = '';
    let isPromptVisible = false;
    let autoCloseTimer: number | null = null;
    let autoCloseStartedAt = 0;
    let autoCloseRemainingMs = 10000;

    const containerId = 'obsidian-ai-clipper-copy-prompt';

    const loadFolder = async () => {
      try {
        const raw = await browser.storage.local.get(SETTINGS_KEY);
        const value = raw?.[SETTINGS_KEY];
        if (value && typeof value === 'object' && typeof (value as { targetFolder?: string }).targetFolder === 'string') {
          const next = (value as { targetFolder?: string }).targetFolder?.trim();
          if (next) cachedFolder = next;
        }
      } catch {
        // ignore
      }
    };

    const loadLastClipboard = async () => {
      try {
        const raw = await browser.storage.local.get(LAST_CLIPBOARD_KEY);
        const value = raw?.[LAST_CLIPBOARD_KEY];
        if (typeof value === 'string') {
          globalLastClipboard = value;
          lastText = value;
        }
      } catch {
        // ignore
      }
    };

    const saveLastClipboard = async (text: string) => {
      globalLastClipboard = text;
      try {
        await browser.storage.local.set({ [LAST_CLIPBOARD_KEY]: text });
      } catch {
        // ignore
      }
    };

    const saveFolder = async (folder: string) => {
      const nextFolder = folder.trim() || 'Daily Notes';
      cachedFolder = nextFolder;
      try {
        const raw = await browser.storage.local.get(SETTINGS_KEY);
        const current = raw?.[SETTINGS_KEY];
        const base = current && typeof current === 'object' ? (current as Record<string, unknown>) : {};
        await browser.storage.local.set({
          [SETTINGS_KEY]: {
            ...base,
            targetFolder: nextFolder,
          },
        });
      } catch {
        // ignore
      }
    };

    const removePrompt = () => {
      if (autoCloseTimer !== null) {
        window.clearTimeout(autoCloseTimer);
        autoCloseTimer = null;
      }
      autoCloseRemainingMs = 10000;
      document.getElementById(containerId)?.remove();
      isPromptVisible = false;
    };

    const scheduleAutoClose = () => {
      if (autoCloseTimer !== null) window.clearTimeout(autoCloseTimer);
      autoCloseStartedAt = Date.now();
      autoCloseTimer = window.setTimeout(() => {
        removePrompt();
      }, autoCloseRemainingMs);
    };

    const pauseAutoClose = () => {
      if (autoCloseTimer === null) return;
      window.clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
      const elapsed = Date.now() - autoCloseStartedAt;
      autoCloseRemainingMs = Math.max(0, autoCloseRemainingMs - elapsed);
    };

    const showPrompt = (text: string) => {
      removePrompt();
      isPromptVisible = true;

      const root = document.createElement('div');
      root.id = containerId;
      Object.assign(root.style, {
        position: 'fixed',
        right: '16px',
        top: '16px',
        zIndex: '2147483647',
        width: '360px',
        maxWidth: 'calc(100vw - 24px)',
        background: '#ffffff',
        border: '1px solid #d0d0d0',
        borderRadius: '8px',
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.14)',
        padding: '10px',
        font: '13px/1.4 "Segoe UI","Microsoft YaHei",sans-serif',
        color: '#222',
      });

      const title = document.createElement('div');
      title.textContent = '检测到新复制内容，是否保存到 Obsidian？';
      title.style.marginBottom = '8px';
      root.appendChild(title);

      const preview = document.createElement('div');
      preview.textContent = text;
      Object.assign(preview.style, {
        padding: '6px 8px',
        background: '#f7f7f7',
        border: '1px solid #e2e2e2',
        borderRadius: '6px',
        height: '120px',
        overflowY: 'auto',
        marginBottom: '8px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontSize: '12px',
        lineHeight: '1.5',
      });
      root.appendChild(preview);

      const counter = document.createElement('div');
      counter.textContent = `${text.length} 字符`;
      Object.assign(counter.style, {
        fontSize: '11px',
        color: '#999',
        marginBottom: '8px',
        textAlign: 'right',
      });
      root.appendChild(counter);

      const folderInput = document.createElement('input');
      folderInput.value = cachedFolder;
      folderInput.placeholder = '输入保存目录';
      Object.assign(folderInput.style, {
        width: '100%',
        minHeight: '30px',
        padding: '0 8px',
        border: '1px solid #d0d0d0',
        borderRadius: '6px',
        marginBottom: '8px',
        font: '13px/1.4 "Segoe UI","Microsoft YaHei",sans-serif',
      });
      folderInput.addEventListener('input', () => {
        void saveFolder(folderInput.value);
      });
      root.appendChild(folderInput);

      const actions = document.createElement('div');
      Object.assign(actions.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
      });

      const skip = document.createElement('button');
      skip.textContent = '忽略';
      Object.assign(skip.style, {
        border: '1px solid #cfcfcf',
        background: '#fff',
        borderRadius: '6px',
        padding: '4px 10px',
        cursor: 'pointer',
      });
      skip.addEventListener('click', () => removePrompt());

      const save = document.createElement('button');
      save.textContent = '保存';
      Object.assign(save.style, {
        border: '1px solid #bdbdbd',
        background: '#f0f0f0',
        borderRadius: '6px',
        padding: '4px 10px',
        cursor: 'pointer',
      });
      save.addEventListener('click', async () => {
        const original = save.textContent;
        save.textContent = '保存中...';
        save.setAttribute('disabled', 'true');
        try {
          await browser.runtime.sendMessage({
            type: 'save-clip',
            targetFolder: folderInput.value.trim(),
            payload: {
              text: currentText,
              source: 'selection',
              pageTitle: document.title,
              pageUrl: location.href,
            },
          });
          save.textContent = '已保存';
          setTimeout(removePrompt, 700);
        } catch {
          save.textContent = '失败';
          setTimeout(() => {
            save.textContent = original;
            save.removeAttribute('disabled');
          }, 1000);
        }
      });

      actions.appendChild(skip);
      actions.appendChild(save);
      root.appendChild(actions);

      root.addEventListener('mouseenter', pauseAutoClose);
      root.addEventListener('mouseleave', scheduleAutoClose);
      document.documentElement.appendChild(root);
      autoCloseRemainingMs = 10000;
      scheduleAutoClose();
    };

    const shouldIgnoreText = (text: string): boolean => {
      const next = text.trim();
      if (!next) return true;
      if (next === globalLastClipboard) return true;
      const now = Date.now();
      if (next === lastText && now - lastAt < 1200) return true;
      lastText = next;
      lastAt = now;
      currentText = next;
      void saveLastClipboard(next);
      return false;
    };

    const handleDetectedText = (text: string) => {
      if (shouldIgnoreText(text)) return;
      showPrompt(currentText);
    };

    document.addEventListener('copy', (event) => {
      const copied = event.clipboardData?.getData('text/plain')?.trim() ?? '';
      const selected = window.getSelection()?.toString().trim() ?? '';
      const text = copied || selected;
      handleDetectedText(text);
    });

    const startClipboardPolling = async () => {
      try {
        const initial = await navigator.clipboard.readText();
        if (initial.trim()) {
          const next = initial.trim();
          lastText = next;
          if (!globalLastClipboard) {
            globalLastClipboard = next;
            void saveLastClipboard(next);
          }
        }
      } catch {
        // ignore
      }

      window.setInterval(async () => {
        if (!document.hasFocus()) return;
        try {
          const current = await navigator.clipboard.readText();
          handleDetectedText(current);
        } catch {
          // ignore
        }
      }, 1000);
    };

    const init = async () => {
      await Promise.all([loadFolder(), loadLastClipboard()]);
      await startClipboardPolling();
    };

    void init();
  },
});
