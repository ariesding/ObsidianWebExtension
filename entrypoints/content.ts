export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    const SETTINGS_KEY = 'local:obsidian-ai-clipper-settings';
    const LAST_CLIPBOARD_KEY = 'local:obsidian-ai-clipper-last-clipboard-text';
    const LAST_PROMPTED_KEY = 'local:obsidian-ai-clipper-last-prompted-text';
    const containerId = 'obsidian-ai-clipper-copy-prompt';
    const defaultAutoCloseMs = 10000;
    const hoverExpandDelayMs = 250;
    const collapseDelayMs = 500;

    let lastText = '';
    let lastAt = 0;
    let currentText = '';
    let currentSource: 'selection' | 'clipboard' = 'clipboard';
    let cachedFolder = 'Daily Notes';
    let globalLastClipboard = '';
    let globalLastPrompted = '';

    let mode: 'hidden' | 'peek' | 'expanded' | 'saving' = 'hidden';
    let autoCloseTimer: number | null = null;
    let autoCloseStartedAt = 0;
    let autoCloseRemainingMs = defaultAutoCloseMs;
    let expandTimer: number | null = null;
    let collapseTimer: number | null = null;

    type PromptElements = {
      root: HTMLDivElement;
      peek: HTMLDivElement;
      full: HTMLDivElement;
      countdown: HTMLDivElement;
      preview: HTMLDivElement;
      counter: HTMLDivElement;
      folderInput: HTMLInputElement;
      save: HTMLButtonElement;
      skip: HTMLButtonElement;
    };

    let promptElements: PromptElements | null = null;

    const truncate = (text: string, max = 28) => (text.length > max ? `${text.slice(0, max)}...` : text);

    const setMode = (next: typeof mode) => {
      mode = next;
      if (!promptElements) return;
      promptElements.root.dataset.mode = mode;
      renderMode();
    };

    const clearUiTimers = () => {
      if (expandTimer !== null) window.clearTimeout(expandTimer);
      if (collapseTimer !== null) window.clearTimeout(collapseTimer);
      expandTimer = null;
      collapseTimer = null;
    };

    const removePrompt = () => {
      if (autoCloseTimer !== null) {
        window.clearTimeout(autoCloseTimer);
        autoCloseTimer = null;
      }
      clearUiTimers();
      autoCloseRemainingMs = defaultAutoCloseMs;
      document.getElementById(containerId)?.remove();
      promptElements = null;
      setMode('hidden');
    };

    const scheduleAutoClose = () => {
      if (autoCloseTimer !== null) window.clearTimeout(autoCloseTimer);
      autoCloseStartedAt = Date.now();
      autoCloseTimer = window.setTimeout(removePrompt, autoCloseRemainingMs);
    };

    const pauseAutoClose = () => {
      if (autoCloseTimer === null) return;
      window.clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
      const elapsed = Date.now() - autoCloseStartedAt;
      autoCloseRemainingMs = Math.max(0, autoCloseRemainingMs - elapsed);
    };

    const setCountdown = () => {
      if (!promptElements) return;
      const sec = Math.max(1, Math.ceil(autoCloseRemainingMs / 1000));
      promptElements.countdown.textContent = `${sec}s`;
    };

    const expandPrompt = () => {
      clearUiTimers();
      pauseAutoClose();
      setMode('expanded');
    };

    const collapsePrompt = () => {
      clearUiTimers();
      if (mode === 'saving') return;
      setMode('peek');
      setCountdown();
      scheduleAutoClose();
    };

    const scheduleExpand = () => {
      if (mode !== 'peek') return;
      if (expandTimer !== null) window.clearTimeout(expandTimer);
      expandTimer = window.setTimeout(expandPrompt, hoverExpandDelayMs);
    };

    const scheduleCollapse = () => {
      if (mode !== 'expanded') return;
      if (collapseTimer !== null) window.clearTimeout(collapseTimer);
      collapseTimer = window.setTimeout(collapsePrompt, collapseDelayMs);
    };

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

    const loadLastPrompted = async () => {
      try {
        const raw = await browser.storage.local.get(LAST_PROMPTED_KEY);
        const value = raw?.[LAST_PROMPTED_KEY];
        if (typeof value === 'string') globalLastPrompted = value;
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

    const saveLastPrompted = async (text: string) => {
      globalLastPrompted = text;
      try {
        await browser.storage.local.set({ [LAST_PROMPTED_KEY]: text });
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

    const ensurePrompt = (): PromptElements => {
      if (promptElements) return promptElements;

      const root = document.createElement('div');
      root.id = containerId;
      root.tabIndex = 0;
      Object.assign(root.style, {
        position: 'fixed',
        right: '16px',
        top: '16px',
        zIndex: '2147483647',
        width: '360px',
        maxWidth: 'calc(100vw - 24px)',
        background: '#ffffff',
        border: '1px solid #d0d0d0',
        borderRadius: '10px',
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.16)',
        color: '#222',
        font: '13px/1.4 "Segoe UI","Microsoft YaHei",sans-serif',
        overflow: 'hidden',
        transition: 'all 180ms ease-out',
      });

      const peek = document.createElement('div');
      Object.assign(peek.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '44px',
        height: '44px',
        cursor: 'pointer',
      });
      const icon = document.createElement('div');
      icon.textContent = '●';
      Object.assign(icon.style, { color: '#244532', fontSize: '14px' });
      const countdown = document.createElement('div');
      Object.assign(countdown.style, {
        position: 'absolute',
        right: '3px',
        top: '3px',
        fontSize: '10px',
        color: '#767676',
      });
      peek.append(icon, countdown);

      const full = document.createElement('div');
      Object.assign(full.style, {
        display: 'none',
        borderTop: '1px solid #ededed',
        padding: '10px',
      });

      const title = document.createElement('div');
      title.textContent = '检测到新复制内容，是否保存到 Obsidian？';
      title.style.marginBottom = '8px';
      full.appendChild(title);

      const preview = document.createElement('div');
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
      full.appendChild(preview);

      const counter = document.createElement('div');
      Object.assign(counter.style, {
        fontSize: '11px',
        color: '#999',
        marginBottom: '8px',
        textAlign: 'right',
      });
      full.appendChild(counter);

      const folderInput = document.createElement('input');
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
      full.appendChild(folderInput);

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
      skip.addEventListener('click', removePrompt);
      const save = document.createElement('button');
      save.textContent = '保存';
      Object.assign(save.style, {
        border: '1px solid #bdbdbd',
        background: '#f0f0f0',
        borderRadius: '6px',
        padding: '4px 10px',
        cursor: 'pointer',
      });
      actions.append(skip, save);
      full.appendChild(actions);

      root.append(peek, full);
      document.documentElement.appendChild(root);

      root.addEventListener('mouseenter', scheduleExpand);
      root.addEventListener('mouseleave', scheduleCollapse);
      peek.addEventListener('click', expandPrompt);
      root.addEventListener('focusin', expandPrompt);
      root.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') removePrompt();
        if (event.key === 'Enter' && mode === 'peek') expandPrompt();
      });

      const elements: PromptElements = { root, peek, full, countdown, preview, counter, folderInput, save, skip };
      promptElements = elements;

      save.addEventListener('click', async () => {
        const original = save.textContent;
        setMode('saving');
        save.textContent = '保存中...';
        save.setAttribute('disabled', 'true');
        try {
          await browser.runtime.sendMessage({
            type: 'save-clip',
            targetFolder: elements.folderInput.value.trim(),
            payload: {
              text: currentText,
              source: currentSource,
              pageTitle: document.title,
              pageUrl: location.href,
            },
          });
          save.textContent = '已保存';
          window.setTimeout(removePrompt, 700);
        } catch {
          save.textContent = '失败';
          window.setTimeout(() => {
            setMode('expanded');
            save.textContent = original;
            save.removeAttribute('disabled');
          }, 900);
        }
      });

      return elements;
    };

    const renderMode = () => {
      if (!promptElements) return;
      const expanded = mode === 'expanded' || mode === 'saving';
      promptElements.full.style.display = expanded ? 'block' : 'none';
      promptElements.peek.style.display = expanded ? 'none' : 'flex';
      promptElements.root.style.width = expanded ? '360px' : '44px';
      promptElements.root.style.height = expanded ? 'auto' : '44px';
    };

    const showPrompt = (text: string) => {
      const elements = ensurePrompt();
      elements.peek.title = `有新剪贴内容: ${truncate(text)}`;
      elements.preview.textContent = text;
      elements.counter.textContent = `${text.length} 字符`;
      elements.folderInput.value = cachedFolder;
      autoCloseRemainingMs = defaultAutoCloseMs;
      setMode('peek');
      setCountdown();
      scheduleAutoClose();
      void saveLastPrompted(text);
    };

    const shouldIgnoreText = (text: string): boolean => {
      const next = text.trim();
      if (!next) return true;
      if (next === globalLastClipboard) return true;
      if (next === globalLastPrompted) return true;
      const now = Date.now();
      if (next === lastText && now - lastAt < 1200) return true;
      lastText = next;
      lastAt = now;
      currentText = next;
      void saveLastClipboard(next);
      return false;
    };

    const handleDetectedText = (text: string, source: 'selection' | 'clipboard') => {
      if (shouldIgnoreText(text)) return;
      currentSource = source;
      showPrompt(currentText);
    };

    document.addEventListener('copy', (event) => {
      const copied = event.clipboardData?.getData('text/plain')?.trim() ?? '';
      const selected = window.getSelection()?.toString().trim() ?? '';
      const text = copied || selected;
      handleDetectedText(text, 'selection');
    });

    const init = async () => {
      await Promise.all([loadFolder(), loadLastClipboard(), loadLastPrompted()]);
    };

    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;

      const clipboardChanged = changes[LAST_CLIPBOARD_KEY];
      if (clipboardChanged && typeof clipboardChanged.newValue === 'string') {
        globalLastClipboard = clipboardChanged.newValue;
      }

      const promptedChanged = changes[LAST_PROMPTED_KEY];
      if (promptedChanged && typeof promptedChanged.newValue === 'string') {
        globalLastPrompted = promptedChanged.newValue;
      }
    });

    void init();
  },
});
