// ==UserScript==
// @name         snapdom test
// @namespace    http://tampermonkey.net/
// @version      2026-01-06
// @description  ʕ•ᴥ•ʔ Capture page DOM snapshot using snapdom
// @author       canvascat@qq.cn
// @match        https://*.antgroup.com/*
// @match        https://*.pro.ant.design/*
// @match        https://*.shadcn.com/*
// @match        https://localhost:*/*
// @icon         https://snapdom.dev/assets/favicon/favicon.ico
// @grant        GM_registerMenuCommand
// @require      https://unpkg.com/@zumer/snapdom@dev/dist/snapdom.js
// @license      AGPL-3.0
// ==/UserScript==

(function () {
  "use strict";

  const prefix = `snapdom-${Date.now().toString(36)}`;
  const toastId = `${prefix}-toast`;
  const toastStylesId = `${toastId}-styles`;
  const highlightBoxId = `${prefix}-highlight-box`;

  /**
   * Add style to adopted style sheets
   * @param {string} rule
   */
  function addStyle(rule) {
    const sheet = new CSSStyleSheet();
    sheet.insertRule(rule);
    document.adoptedStyleSheets.push(sheet);
    return sheet;
  }

  /**
   * Remove style from adopted style sheets
   * @param {CSSStyleSheet} sheet
   */
  function removeStyle(sheet) {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== sheet
    );
  }

  /**
   * 计算滚动条宽度
   * @returns {number} 滚动条宽度（像素）
   */
  function getScrollbarWidth() {
    // 创建一个临时的div元素来测量滚动条宽度
    const outer = document.createElement("div");
    outer.style.cssText = `
      position: absolute;
      visibility: hidden;
      overflow: scroll;
      width: 100px;
      height: 100px;
      top: -9999px;
    `;
    document.body.appendChild(outer);

    // 创建内部div
    const inner = document.createElement("div");
    inner.style.width = "100%";
    inner.style.height = "200px"; // 确保内容高度超过外层，触发滚动条
    outer.appendChild(inner);

    // 计算滚动条宽度：外层宽度 - 内层可见宽度
    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

    // 清理临时元素
    document.body.removeChild(outer);

    return scrollbarWidth;
  }

  // Create Toast notification (Sonner style)
  function showToast(message, type = "info", duration = 3000) {
    // Remove existing toast
    const existingToast = document.getElementById(toastId);
    if (existingToast) {
      existingToast.remove();
    }

    // Create toast container
    const toast = document.createElement("div");
    toast.id = toastId;
    toast.dataset.capture = "exclude";

    // Set icon and color based on type (Sonner style)
    const config = {
      success: {
        icon: "✓",
        accentColor: "#10b981",
        iconBg: "rgba(16, 185, 129, 0.1)",
        iconColor: "#10b981",
      },
      error: {
        icon: "✕",
        accentColor: "#ef4444",
        iconBg: "rgba(239, 68, 68, 0.1)",
        iconColor: "#ef4444",
      },
      loading: {
        icon: "⟳",
        accentColor: "#3b82f6",
        iconBg: "rgba(59, 130, 246, 0.1)",
        iconColor: "#3b82f6",
      },
      info: {
        icon: "ℹ",
        accentColor: "#6366f1",
        iconBg: "rgba(99, 102, 241, 0.1)",
        iconColor: "#6366f1",
      },
    };

    const style = config[type] || config.info;

    // Add animation styles (if not already added)
    if (!document.getElementById(toastStylesId)) {
      const styleSheet = document.createElement("style");
      styleSheet.dataset.capture = "exclude";
      styleSheet.id = toastStylesId;
      styleSheet.textContent = `
        @keyframes toast-slide-in {
          from {
            transform: translateX(-50%) translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
        @keyframes toast-slide-out {
          from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
          to {
            transform: translateX(-50%) translateY(-20px);
            opacity: 0;
          }
        }
        @keyframes toast-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        #${toastId} {
          animation: toast-slide-in 0.35s cubic-bezier(0.21, 1.02, 0.73, 1) forwards;
        }
        #${toastId}.toast-exit {
          animation: toast-slide-out 0.2s cubic-bezier(0.06, 0.71, 0.55, 1) forwards;
        }
        #${toastId} .toast-icon.loading {
          animation: toast-spin 1s linear infinite;
        }
      `;
      document.head.appendChild(styleSheet);
    }

    // Set styles (Sonner style)
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000000;
      min-width: 356px;
      max-width: 420px;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      box-shadow: 0 10px 38px -10px rgba(22, 23, 24, 0.35), 0 10px 20px -15px rgba(22, 23, 24, 0.2);
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      pointer-events: auto;
      overflow: hidden;
    `;

    // Create content structure
    const content = document.createElement("div");
    content.dataset.capture = "exclude";
    content.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
    `;

    // Icon container
    const iconContainer = document.createElement("div");
    iconContainer.className = "toast-icon-container";
    iconContainer.style.cssText = `
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      background: ${style.iconBg};
      color: ${style.iconColor};
      font-size: 14px;
      font-weight: 600;
      line-height: 1;
    `;

    const icon = document.createElement("span");
    icon.className = type === "loading" ? "toast-icon loading" : "toast-icon";
    icon.textContent = style.icon;
    icon.style.cssText = `
      display: inline-block;
      ${type === "loading" ? "font-size: 16px;" : ""}
    `;
    iconContainer.appendChild(icon);

    // Text content
    const messageEl = document.createElement("div");
    messageEl.style.cssText = `
      flex: 1;
      font-size: 14px;
      line-height: 1.5;
      color: #09090b;
      font-weight: 400;
      word-break: break-word;
    `;
    messageEl.textContent = message;

    // Left accent bar
    const accentBar = document.createElement("div");
    accentBar.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: ${style.accentColor};
    `;

    // Assemble structure
    content.appendChild(iconContainer);
    content.appendChild(messageEl);
    toast.appendChild(accentBar);
    toast.appendChild(content);

    // Add to page
    document.body.appendChild(toast);

    // Auto remove (loading type doesn't auto-remove)
    if (type !== "loading" && duration > 0) {
      setTimeout(() => {
        toast.classList.add("toast-exit");
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 200);
      }, duration);
    }

    return toast;
  }

  /**
   * 下载对话框类
   * 使用原生 <dialog> 元素实现的下载设置对话框
   */
  class DownloadDialog {
    /** @type {string} 对话框唯一ID */
    dialogId = `${prefix}-download-dialog`;

    /** @type {HTMLDialogElement | null} 对话框元素 */
    dialog = null;

    /** @type {HTMLInputElement | null} 文件名输入框 */
    filenameInput = null;

    /** @type {HTMLSelectElement | null} 格式选择框 */
    formatSelect = null;

    /** @type {HTMLDivElement | null} 按钮组 */
    buttonGroup = null;

    /** @type {HTMLButtonElement | null} 扩大按钮 */
    expandButton = null;

    /** @type {HTMLButtonElement | null} 缩小按钮 */
    shrinkButton = null;

    /** @type {HTMLDivElement | null} 加载遮罩层 */
    loadingOverlay = null;

    /** @type {CSSStyleSheet | null} 滚动锁定样式 */
    lockScrollStyle = null;

    /** @type {Function | null} Promise resolve 函数 */
    _resolve = null;

    /** @type {string} 默认文件名 */
    defaultFilename = "";

    /**
     * 构造函数
     */
    constructor() {
      this._injectStyles();
    }

    /**
     * 注入对话框样式（仅注入一次）
     * @private
     */
    _injectStyles() {
      if (document.getElementById(`${this.dialogId}-styles`)) return;

      const styleSheet = document.createElement("style");
      styleSheet.dataset.capture = "exclude";
      styleSheet.id = `${this.dialogId}-styles`;
      styleSheet.textContent = `
        #${this.dialogId} {
          padding: 0;
          border: none;
          border-radius: 12px;
          box-shadow: 0 20px 60px -10px rgba(0, 0, 0, 0.3);
          min-width: 400px;
          max-width: 500px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          position: fixed;
          top: 20px;
          right: 20px;
          left: auto;
          margin: 0;
          transform: none;
        }
        #${this.dialogId}::backdrop {
          background: transparent;
        }
        #${this.dialogId} .dialog-content {
          padding: 24px;
          position: relative;
        }
        #${this.dialogId} h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: #09090b;
        }
        #${this.dialogId} .form-group {
          margin-bottom: 16px;
        }
        #${this.dialogId} .form-group:last-of-type {
          margin-bottom: 24px;
        }
        #${this.dialogId} label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #09090b;
        }
        #${this.dialogId} input,
        #${this.dialogId} select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid rgba(0, 0, 0, 0.2);
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        #${this.dialogId} input:focus,
        #${this.dialogId} select:focus {
          outline: none;
          border-color: #3b82f6;
        }
        #${this.dialogId} select {
          background: white;
          cursor: pointer;
        }
        #${this.dialogId} .button-group {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        #${this.dialogId} button {
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        #${this.dialogId} button[type="button"] {
          border: 1px solid rgba(0, 0, 0, 0.2);
          background: white;
          color: #09090b;
        }
        #${this.dialogId} button[type="button"]:hover {
          background: #f5f5f5;
        }
        #${this.dialogId} button.expand-button,
        #${this.dialogId} button.shrink-button {
          border: 1px solid #3b82f6;
          background: white;
          color: #3b82f6;
        }
        #${this.dialogId} button.expand-button:hover,
        #${this.dialogId} button.shrink-button:hover {
          background: #eff6ff;
        }
        #${this.dialogId} button.expand-button:disabled,
        #${this.dialogId} button.shrink-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        #${this.dialogId} button.expand-button:disabled:hover,
        #${this.dialogId} button.shrink-button:disabled:hover {
          background: white;
        }
        #${this.dialogId} button[type="submit"] {
          border: none;
          background: #3b82f6;
          color: white;
        }
        #${this.dialogId} button[type="submit"]:hover {
          background: #2563eb;
        }
        #${this.dialogId} .loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          z-index: 1000;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }
        #${this.dialogId} .loading-overlay.active {
          opacity: 1;
          pointer-events: auto;
        }
        #${this.dialogId} .loading-overlay .loading-text {
          font-size: 14px;
          color: #3b82f6;
          font-weight: 500;
        }
      `;
      document.head.appendChild(styleSheet);
    }

    /**
     * 创建对话框DOM结构
     * @private
     * @param {Object} options - 配置选项
     * @param {string} options.filename - 默认文件名
     * @param {string} options.format - 默认格式
     */
    _createDialog(options) {
      const { filename, format } = options;
      this.defaultFilename = filename;

      // 移除已存在的对话框
      const existingDialog = document.getElementById(this.dialogId);
      if (existingDialog) {
        existingDialog.remove();
      }

      // 创建对话框元素
      this.dialog = document.createElement("dialog");
      this.dialog.id = this.dialogId;
      this.dialog.dataset.capture = "exclude";

      // 创建表单
      const form = document.createElement("form");
      form.method = "dialog";

      // 创建内容容器
      const content = document.createElement("div");
      content.className = "dialog-content";

      // 创建加载遮罩层
      this.loadingOverlay = document.createElement("div");
      this.loadingOverlay.className = "loading-overlay";
      const loadingText = document.createElement("div");
      loadingText.className = "loading-text";
      loadingText.textContent = "处理中...";
      this.loadingOverlay.appendChild(loadingText);

      // 标题
      const title = document.createElement("h3");
      title.textContent = "下载设置";

      // 文件名输入组
      const filenameGroup = document.createElement("div");
      filenameGroup.className = "form-group";

      const filenameLabel = document.createElement("label");
      filenameLabel.textContent = "文件名";
      filenameLabel.setAttribute("for", `${this.dialogId}-filename`);

      this.filenameInput = document.createElement("input");
      this.filenameInput.type = "text";
      this.filenameInput.id = `${this.dialogId}-filename`;
      this.filenameInput.name = "filename";
      this.filenameInput.value = filename;
      this.filenameInput.autofocus = true;

      filenameGroup.appendChild(filenameLabel);
      filenameGroup.appendChild(this.filenameInput);

      // 格式选择组
      const formatGroup = document.createElement("div");
      formatGroup.className = "form-group";

      const formatLabel = document.createElement("label");
      formatLabel.textContent = "格式";
      formatLabel.setAttribute("for", `${this.dialogId}-format`);

      this.formatSelect = document.createElement("select");
      this.formatSelect.id = `${this.dialogId}-format`;
      this.formatSelect.name = "format";

      const formats = ["png", "svg", "jpg", "webp"];
      formats.forEach((fmt) => {
        const option = document.createElement("option");
        option.value = fmt;
        option.textContent = fmt.toUpperCase();
        if (fmt === format) {
          option.selected = true;
        }
        this.formatSelect.appendChild(option);
      });

      formatGroup.appendChild(formatLabel);
      formatGroup.appendChild(this.formatSelect);

      // 按钮组
      const buttonGroup = document.createElement("div");
      buttonGroup.className = "button-group";
      this.buttonGroup = buttonGroup;

      // 取消按钮
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.textContent = "取消";
      cancelButton.value = "cancel";
      cancelButton.addEventListener("click", () => this._closeAndResolve(null));

      // 确认按钮
      const confirmButton = document.createElement("button");
      confirmButton.type = "submit";
      confirmButton.textContent = "确认";
      confirmButton.value = "confirm";

      buttonGroup.appendChild(cancelButton);
      buttonGroup.appendChild(confirmButton);

      // 处理表单提交
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const resultFilename =
          formData.get("filename").trim() || this.defaultFilename;
        const resultFormat = formData.get("format");
        this._closeAndResolve({
          filename: resultFilename,
          format: resultFormat,
        });
      });

      // 处理取消事件（ESC键或点击背景）
      this.dialog.addEventListener("cancel", (e) => {
        e.preventDefault();
        this._closeAndResolve(null);
      });

      // 组装对话框
      content.appendChild(title);
      content.appendChild(filenameGroup);
      content.appendChild(formatGroup);
      content.appendChild(buttonGroup);
      content.appendChild(this.loadingOverlay);
      form.appendChild(content);
      this.dialog.appendChild(form);
    }

    patchControllButton() {
      const firstChild = this.buttonGroup.firstChild;
      // 扩大按钮
      this.expandButton = document.createElement("button");
      this.expandButton.type = "button";
      this.expandButton.textContent = "扩大";
      this.expandButton.className = "expand-button";
      this.buttonGroup.insertBefore(this.expandButton, firstChild);

      // 缩小按钮

      this.shrinkButton = document.createElement("button");
      this.shrinkButton.type = "button";
      this.shrinkButton.textContent = "缩小";
      this.shrinkButton.className = "shrink-button";
      this.shrinkButton.disabled = true;
      this.buttonGroup.insertBefore(this.shrinkButton, firstChild);
    }

    /**
     * 关闭对话框并解析结果
     * @private
     * @param {Object | null} result - 结果对象
     */
    _closeAndResolve(result) {
      this._restoreScroll();
      if (this.dialog) {
        this.dialog.close();
        this.dialog.remove();
        this.dialog = null;
      }
      if (this._resolve) {
        this._resolve(result);
        this._resolve = null;
      }
    }

    /**
     * 锁定页面滚动
     * @private
     */
    _lockScroll() {
      const scrollWidth = getScrollbarWidth();
      this.lockScrollStyle = addStyle(`html body {
    overflow-y: hidden;
    width: calc(100% - ${scrollWidth}px);
}`);
    }

    /**
     * 恢复页面滚动
     * @private
     */
    _restoreScroll() {
      if (this.lockScrollStyle) {
        removeStyle(this.lockScrollStyle);
        this.lockScrollStyle = null;
      }
    }

    /**
     * 显示加载遮罩
     */
    showLoading() {
      if (this.loadingOverlay) {
        this.loadingOverlay.classList.add("active");
      }
    }

    /**
     * 隐藏加载遮罩
     */
    hideLoading() {
      if (this.loadingOverlay) {
        this.loadingOverlay.classList.remove("active");
      }
    }

    /**
     * 获取当前文件名
     * @returns {string}
     */
    getFilename() {
      return this.filenameInput
        ? this.filenameInput.value.trim() || this.defaultFilename
        : this.defaultFilename;
    }

    /**
     * 获取当前格式
     * @returns {string}
     */
    getFormat() {
      return this.formatSelect ? this.formatSelect.value : "png";
    }

    /**
     * 显示对话框
     * @param {Object} options - 配置选项
     * @param {string} options.filename - 默认文件名
     * @param {string} [options.format='png'] - 默认格式
     * @returns {Promise<{filename: string, format: string, action?: string} | null>} 返回用户输入或取消时返回null
     */
    show(options) {
      const { filename, format = "png" } = options;

      return new Promise((resolve) => {
        this._resolve = resolve;

        // 创建对话框DOM
        this._createDialog({ filename, format });

        // 添加到页面
        document.body.appendChild(this.dialog);

        // 锁定滚动
        this._lockScroll();

        // 显示模态对话框
        this.dialog.showModal();
      });
    }

    /**
     * 关闭对话框
     */
    close() {
      this._closeAndResolve(null);
    }
  }

  /**
   * Capture element
   * @param {HTMLElement} element
   * @param {Object} options
   * @param {'svg' | 'png' | 'jpg' | 'webp'} options.type
   * @param {string} options.filename
   * @returns {Promise<void>}
   */
  async function capture(element, options) {
    const snapdom = window.snapdom;
    if (!snapdom) {
      throw new Error("snapdom library not loaded");
    }
    await snapdom.download(element, options);
  }

  /**
   * Execute screenshot function
   * @param {HTMLElement} targetElement - Optional, specify element to capture, defaults to document.documentElement
   */
  async function takeScreenshot(targetElement = document.documentElement) {
    // Initialize element history stack (for shrink functionality)
    const elementHistory = targetElement ? [targetElement] : [];

    // Determine element to capture
    let elementToCapture = targetElement;

    // Show highlight box for the element to be captured
    createHighlightBox();
    updateHighlightBox(elementToCapture);

    // Record initial window size
    const initialWidth = window.innerWidth;
    const initialHeight = window.innerHeight;

    // Flag to track if screenshot was cancelled due to window resize
    let cancelledByResize = false;

    // Listen for window resize events during screenshot
    const handleResize = () => {
      if (
        window.innerWidth !== initialWidth ||
        window.innerHeight !== initialHeight
      ) {
        cancelledByResize = true;
        window.removeEventListener("resize", handleResize);
        hideHighlightBox();
        showToast("窗口尺寸已变化，截图已取消", "error");
      }
    };
    window.addEventListener("resize", handleResize);

    // Show loading toast
    const loadingToast = showToast("Capturing screenshot...", "loading", 0);

    try {
      // Check if cancelled by resize before proceeding
      if (cancelledByResize) {
        window.removeEventListener("resize", handleResize);
        return;
      }

      if (!window.snapdom) {
        throw new Error("snapdom library not loaded");
      }

      // Check if cancelled by resize before executing screenshot
      if (cancelledByResize) {
        window.removeEventListener("resize", handleResize);
        if (loadingToast && loadingToast.parentNode) {
          loadingToast.remove();
        }
        return;
      }

      // Check again after screenshot
      if (cancelledByResize) {
        window.removeEventListener("resize", handleResize);
        if (loadingToast && loadingToast.parentNode) {
          loadingToast.remove();
        }
        return;
      }

      // Generate filename helper function
      const generateFilename = (element) => {
        let filename = `${location.hostname.split(".")[0]}_${
          location.pathname
        }_${new Date().toLocaleTimeString().split(" ")[0].replace(/:/g, "")}`;
        if (element && element !== document.documentElement) {
          const tagName = element.tagName.toLowerCase();
          const className = element.className
            ? element.className.split(" ")[0]
            : "";
          filename += `_${tagName}${className ? "_" + className : ""}`;
        }
        return filename.replace(/[^a-zA-Z0-9_]/g, "");
      };

      let filename = generateFilename(elementToCapture);

      // Remove loading toast before showing dialog
      if (loadingToast && loadingToast.parentNode) {
        loadingToast.remove();
      }

      // 创建下载对话框实例
      const downloadDialog = new DownloadDialog();

      // Show download dialog with expand/shrink options
      const dialogResultPromise = downloadDialog.show({
        filename,
        format: "png",
      });
      if (elementToCapture !== document.documentElement) {
        downloadDialog.patchControllButton();
        /** @param {HTMLElement} element */
        function getParentElement(element) {
          let parent = element.parentElement;
          while (parent && parent !== document.documentElement) {
            const nextParent = parent.parentElement;
            if (!nextParent) break;
            const nextParentRect = nextParent.getBoundingClientRect();
            const parentRect = parent.getBoundingClientRect();
            if (
              nextParentRect.width !== parentRect.width ||
              nextParentRect.height !== parentRect.height ||
              nextParentRect.x !== parentRect.x ||
              nextParentRect.y !== parentRect.y
            ) {
              break;
            }
            parent = nextParent;
          }
          return parent;
        }
        const onExpand = () => {
          // Check if cancelled by resize
          if (cancelledByResize) return;
          // Get parent element (can be document.documentElement)
          const parent = getParentElement(elementToCapture);
          if (!parent) {
            // No parent, cannot expand
            return;
          }

          // Push current element to history
          elementHistory.push(elementToCapture);

          // Update to parent element (can be document.documentElement)
          elementToCapture = parent;
          updateHighlightBox(elementToCapture);

          downloadDialog.shrinkButton.disabled = elementHistory.length <= 1;
          downloadDialog.expandButton.disabled =
            !elementHistory.slice(-1)[0]?.parentElement;
        };

        const onShrink = () => {
          // Check if cancelled by resize
          if (cancelledByResize) return;
          // Check if we have history to restore
          if (elementHistory.length <= 1) {
            return;
          }
          // Pop previous element from history
          elementToCapture = elementHistory.pop();
          updateHighlightBox(elementToCapture);
          downloadDialog.shrinkButton.disabled = elementHistory.length <= 1;
          downloadDialog.expandButton.disabled =
            !elementHistory.slice(-1)[0]?.parentElement;
        };
        downloadDialog.expandButton.addEventListener("click", onExpand);
        downloadDialog.shrinkButton.addEventListener("click", onShrink);
      }
      const dialogResult = await dialogResultPromise;

      // Remove resize listener before showing dialog (dialog will handle its own scroll)
      window.removeEventListener("resize", handleResize);

      // If user cancelled, hide highlight box and return early
      if (!dialogResult) {
        hideHighlightBox();
        return;
      }

      // Use values from dialog
      const finalFilename = dialogResult.filename;
      const finalFormat = dialogResult.format;

      // Re-add resize listener during download
      window.addEventListener("resize", handleResize);

      // Show loading toast again
      const downloadToast = showToast("Downloading...", "loading", 0);
      await capture(elementToCapture, {
        type: finalFormat,
        filename: finalFilename,
      });

      // Remove resize listener after download
      window.removeEventListener("resize", handleResize);

      // Remove loading toast
      if (downloadToast && downloadToast.parentNode) {
        downloadToast.remove();
      }

      // Hide highlight box after successful download
      hideHighlightBox();

      // Show success toast
      showToast("Screenshot saved! File downloaded", "success");
    } catch (error) {
      console.error("Screenshot failed:", error);

      // Remove resize listener on error
      window.removeEventListener("resize", handleResize);

      // Remove loading toast
      if (loadingToast && loadingToast.parentNode) {
        loadingToast.remove();
      }

      // Hide highlight box on error
      hideHighlightBox();

      // Show error toast
      showToast(`Screenshot failed: ${error.message}`, "error");
    }
  }

  // Element selection mode related variables
  let isElementSelectMode = false;
  let highlightBox = null;
  let currentHoveredElement = null;

  /**
   * Create highlight box
   */
  function createHighlightBox() {
    if (highlightBox) return highlightBox;

    highlightBox = document.createElement("div");
    highlightBox.dataset.capture = "exclude";
    highlightBox.id = highlightBoxId;
    highlightBox.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 999998;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.1);
      box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.2), 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.1s ease-out;
      box-sizing: border-box;
      display: none;
    `;
    document.body.appendChild(highlightBox);
    return highlightBox;
  }

  /**
   * Update highlight box position
   * @param {HTMLElement} element
   */
  function updateHighlightBox(element) {
    if (!highlightBox || !element) return;

    const rect = element.getBoundingClientRect();

    // Use fixed positioning, directly use getBoundingClientRect values
    highlightBox.style.left = `${rect.left}px`;
    highlightBox.style.top = `${rect.top}px`;
    highlightBox.style.width = `${rect.width}px`;
    highlightBox.style.height = `${rect.height}px`;
    highlightBox.style.display = "block";
  }

  /**
   * Hide highlight box
   */
  function hideHighlightBox() {
    if (highlightBox) {
      highlightBox.style.display = "none";
    }
  }

  /**
   * Remove highlight box
   */
  function removeHighlightBox() {
    if (highlightBox && highlightBox.parentNode) {
      highlightBox.remove();
      highlightBox = null;
    }
  }

  /**
   * Get element under mouse (exclude highlight box and toast)
   * @param {MouseEvent} e
   * @returns {HTMLElement | null}
   */
  function getElementUnderMouse(e) {
    // Temporarily hide highlight box to avoid affecting element detection
    if (highlightBox) {
      highlightBox.style.pointerEvents = "none";
    }

    const element = document.elementFromPoint(e.clientX, e.clientY);

    // If clicking on highlight box or toast, return null
    if (
      !element ||
      element.id === highlightBoxId ||
      element.id === toastId ||
      element.closest(`#${highlightBoxId}`) ||
      element.closest(`#${toastId}`)
    ) {
      return null;
    }

    return element;
  }

  /**
   * Handle mouse move
   */
  function handleMouseMove(e) {
    if (!isElementSelectMode) return;

    const element = getElementUnderMouse(e);

    if (element && element !== currentHoveredElement) {
      currentHoveredElement = element;
      updateHighlightBox(element);
    } else if (!element && currentHoveredElement) {
      // Hide highlight box when mouse leaves element
      currentHoveredElement = null;
      hideHighlightBox();
    }
  }

  /**
   * Handle mouse click
   */
  async function handleMouseClick(e) {
    if (!isElementSelectMode) return;

    e.preventDefault();
    e.stopPropagation();

    const element = getElementUnderMouse(e);

    if (element) {
      // Keep highlight box visible for selected element
      updateHighlightBox(element);

      // Exit selection mode (but keep highlight box visible)
      isElementSelectMode = false;
      currentHoveredElement = null;

      // Remove event listeners
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("click", handleMouseClick, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("scroll", handleScroll, true);

      // Restore cursor style
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      // Capture selected element (highlight box will be hidden after capture completes/cancels)
      await takeScreenshot(element);
    }
  }

  /**
   * Handle keyboard events (ESC to exit selection mode)
   */
  function handleKeyDown(e) {
    if (!isElementSelectMode) return;

    if (e.key === "Escape") {
      exitElementSelectMode();
      showToast("Element selection cancelled", "info");
    }
  }

  /**
   * Handle scroll (update highlight box position)
   */
  function handleScroll() {
    if (!isElementSelectMode || !currentHoveredElement) return;
    updateHighlightBox(currentHoveredElement);
  }

  /**
   * Enter element selection mode
   */
  function enterElementSelectMode() {
    if (isElementSelectMode) return;

    isElementSelectMode = true;
    createHighlightBox();

    // Add event listeners
    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("click", handleMouseClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("scroll", handleScroll, true);

    // Change cursor style
    document.body.style.cursor = "crosshair";
    document.body.style.userSelect = "none";

    showToast(
      "Select an element to capture, press ESC to cancel",
      "info",
      5000
    );
  }

  /**
   * Exit element selection mode
   */
  function exitElementSelectMode() {
    if (!isElementSelectMode) return;

    isElementSelectMode = false;
    currentHoveredElement = null;

    // Remove event listeners
    document.removeEventListener("mousemove", handleMouseMove, true);
    document.removeEventListener("click", handleMouseClick, true);
    document.removeEventListener("keydown", handleKeyDown, true);
    window.removeEventListener("scroll", handleScroll, true);

    // Restore cursor style
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    // Hide highlight box
    hideHighlightBox();
  }

  // Register Tampermonkey menu commands
  if (typeof GM_registerMenuCommand !== "undefined") {
    // Register screenshot menu items
    GM_registerMenuCommand(
      "📸 Capture Screenshot",
      () => takeScreenshot(document.documentElement),
      "s"
    );
    // Register element selection screenshot menu item
    GM_registerMenuCommand(
      "🎯 Select Element to Capture",
      () => enterElementSelectMode(),
      "e"
    );
  }
})();
