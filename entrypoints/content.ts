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
    let folderSaveTimer: number | null = null;
    let hoverOpenTimer: number | null = null;
    let hoverCloseTimer: number | null = null;

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

    const scheduleSaveFolder = (folder: string) => {
      if (folderSaveTimer !== null) window.clearTimeout(folderSaveTimer);
      folderSaveTimer = window.setTimeout(() => {
        void saveFolder(folder);
      }, 350);
    };

    const removePrompt = () => {
      if (autoCloseTimer !== null) {
        window.clearTimeout(autoCloseTimer);
        autoCloseTimer = null;
      }
      if (folderSaveTimer !== null) {
        window.clearTimeout(folderSaveTimer);
        folderSaveTimer = null;
      }
      if (hoverOpenTimer !== null) {
        window.clearTimeout(hoverOpenTimer);
        hoverOpenTimer = null;
      }
      if (hoverCloseTimer !== null) {
        window.clearTimeout(hoverCloseTimer);
        hoverCloseTimer = null;
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
        font: '13px/1.4 "Segoe UI","Microsoft YaHei",sans-serif',
        color: '#222',
        width: '34px',
        minHeight: '34px',
        borderRadius: '999px',
        border: '1px solid #cfcfcf',
        background: '#ffffff',
        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.14)',
        overflow: 'hidden',
        transition: 'all .16s ease',
      });

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.title = '有新复制内容，悬停展开';
      trigger.textContent = '📋';
      Object.assign(trigger.style, {
        all: 'initial',
        width: '34px',
        height: '34px',
        borderRadius: '999px',
        border: '0',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: '16px',
        lineHeight: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
        fontFamily: '"Segoe UI","Microsoft YaHei",sans-serif',
      });
      root.appendChild(trigger);

      const panel = document.createElement('div');
      Object.assign(panel.style, {
        width: '100%',
        background: '#ffffff',
        padding: '10px',
        display: 'none',
      });

      const panelHeader = document.createElement('div');
      Object.assign(panelHeader.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
      });

      const title = document.createElement('div');
      title.textContent = '检测到新复制内容，是否保存到 Obsidian？';
      title.style.fontWeight = '600';

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.textContent = '×';
      closeButton.title = '收起';
      Object.assign(closeButton.style, {
        all: 'initial',
        border: '1px solid #d0d0d0',
        background: '#fff',
        borderRadius: '6px',
        width: '24px',
        height: '24px',
        lineHeight: '1',
        cursor: 'pointer',
        padding: '0',
        textAlign: 'center',
        color: '#333',
        fontFamily: '"Segoe UI","Microsoft YaHei",sans-serif',
        flex: '0 0 auto',
      });
      panelHeader.appendChild(title);
      panelHeader.appendChild(closeButton);
      panel.appendChild(panelHeader);

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
      panel.appendChild(preview);

      const counter = document.createElement('div');
      counter.textContent = `${text.length} 字符`;
      Object.assign(counter.style, {
        fontSize: '11px',
        color: '#999',
        marginBottom: '8px',
        textAlign: 'right',
      });
      panel.appendChild(counter);

      const folderInput = document.createElement('input');
      folderInput.value = cachedFolder;
      folderInput.placeholder = '输入保存目录';
      Object.assign(folderInput.style, {
        all: 'initial',
        boxSizing: 'border-box',
        width: '100%',
        minHeight: '30px',
        padding: '0 8px',
        border: '1px solid #d0d0d0',
        borderRadius: '6px',
        marginBottom: '8px',
        font: '13px/1.4 "Segoe UI","Microsoft YaHei",sans-serif',
        color: '#222',
        background: '#fff',
      });
      folderInput.addEventListener('input', () => {
        scheduleSaveFolder(folderInput.value);
      });
      panel.appendChild(folderInput);

      const actions = document.createElement('div');
      Object.assign(actions.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
      });

      const skip = document.createElement('button');
      skip.textContent = '忽略';
      Object.assign(skip.style, {
        all: 'initial',
        border: '1px solid #cfcfcf',
        background: '#fff',
        borderRadius: '6px',
        padding: '4px 10px',
        cursor: 'pointer',
        color: '#222',
        font: '13px/1.4 "Segoe UI","Microsoft YaHei",sans-serif',
      });
      skip.addEventListener('click', () => removePrompt());

      const save = document.createElement('button');
      save.textContent = '保存';
      Object.assign(save.style, {
        all: 'initial',
        border: '1px solid #bdbdbd',
        background: '#f0f0f0',
        borderRadius: '6px',
        padding: '4px 10px',
        cursor: 'pointer',
        color: '#222',
        font: '13px/1.4 "Segoe UI","Microsoft YaHei",sans-serif',
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
      panel.appendChild(actions);

      root.appendChild(panel);

      let expanded = false;
      const openPanel = () => {
        if (expanded) return;
        pauseAutoClose();
        expanded = true;
        Object.assign(root.style, {
          width: '360px',
          maxWidth: 'calc(100vw - 24px)',
          borderRadius: '8px',
          border: '1px solid #d0d0d0',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.14)',
        });
        panel.style.display = 'block';
        trigger.style.display = 'none';
      };
      const closePanel = () => {
        if (!expanded) return;
        expanded = false;
        panel.style.display = 'none';
        trigger.style.display = 'flex';
        Object.assign(root.style, {
          width: '34px',
          maxWidth: '',
          borderRadius: '999px',
          border: '1px solid #cfcfcf',
          boxShadow: '0 6px 16px rgba(0, 0, 0, 0.14)',
        });
        autoCloseRemainingMs = 10000;
        scheduleAutoClose();
      };
      const scheduleOpenPanel = () => {
        if (hoverCloseTimer !== null) {
          window.clearTimeout(hoverCloseTimer);
          hoverCloseTimer = null;
        }
        if (hoverOpenTimer !== null) window.clearTimeout(hoverOpenTimer);
        hoverOpenTimer = window.setTimeout(() => {
          hoverOpenTimer = null;
          openPanel();
        }, 120);
      };
      const scheduleClosePanel = () => {
        if (hoverOpenTimer !== null) {
          window.clearTimeout(hoverOpenTimer);
          hoverOpenTimer = null;
        }
        if (hoverCloseTimer !== null) window.clearTimeout(hoverCloseTimer);
        hoverCloseTimer = window.setTimeout(() => {
          hoverCloseTimer = null;
          closePanel();
        }, 220);
      };

      root.addEventListener('mouseenter', scheduleOpenPanel);
      root.addEventListener('mouseleave', scheduleClosePanel);
      closeButton.addEventListener('click', (event) => {
        event.stopPropagation();
        if (hoverCloseTimer !== null) {
          window.clearTimeout(hoverCloseTimer);
          hoverCloseTimer = null;
        }
        closePanel();
      });

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
