// ==UserScript==
// @name         snapdom test
// @namespace    http://tampermonkey.net/
// @version      2026-01-05
// @description  ʕ•ᴥ•ʔ Capture page DOM snapshot using snapdom
// @author       canvascat@qq.cn
// @match        https://*.antgroup.com/*
// @match        https://*.pro.ant.design/*
// @match        https://*.shadcn.com/*
// @match        https://localhost:*/*
// @icon         https://snapdom.dev/assets/favicon/favicon.ico
// @grant        GM_registerMenuCommand
// @require      https://unpkg.com/@zumer/snapdom/dist/snapdom.js
// @license      AGPL-3.0
// ==/UserScript==

(function () {
  'use strict';

  const prefix = `snapdom-${Date.now().toString(36)}`;
  const toastId = `${prefix}-toast`;
  const toastStylesId = `${toastId}-styles`;
  const highlightBoxId = `${prefix}-highlight-box`;

  // Wait for snapdom library to load
  function waitForSnapdom() {
    return new Promise((resolve) => {
      if (window.snapdom) {
        resolve(window.snapdom);
        return;
      }
      const checkInterval = setInterval(() => {
        if (window.snapdom) {
          clearInterval(checkInterval);
          resolve(window.snapdom);
        }
      }, 100);
    });
  }

  // Create Toast notification (Sonner style)
  function showToast(message, type = 'info', duration = 3000) {
    // Remove existing toast
    const existingToast = document.getElementById(toastId);
    if (existingToast) {
      existingToast.remove();
    }

    // Create toast container
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.dataset.capture = "exclude";

    // Set icon and color based on type (Sonner style)
    const config = {
      success: {
        icon: '✓',
        accentColor: '#10b981',
        iconBg: 'rgba(16, 185, 129, 0.1)',
        iconColor: '#10b981'
      },
      error: {
        icon: '✕',
        accentColor: '#ef4444',
        iconBg: 'rgba(239, 68, 68, 0.1)',
        iconColor: '#ef4444'
      },
      loading: {
        icon: '⟳',
        accentColor: '#3b82f6',
        iconBg: 'rgba(59, 130, 246, 0.1)',
        iconColor: '#3b82f6'
      },
      info: {
        icon: 'ℹ',
        accentColor: '#6366f1',
        iconBg: 'rgba(99, 102, 241, 0.1)',
        iconColor: '#6366f1'
      }
    };

    const style = config[type] || config.info;

    // Add animation styles (if not already added)
    if (!document.getElementById(toastStylesId)) {
      const styleSheet = document.createElement('style');
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
    const content = document.createElement('div');
    content.dataset.capture = "exclude";
    content.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
    `;

    // Icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'toast-icon-container';
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

    const icon = document.createElement('span');
    icon.className = type === 'loading' ? 'toast-icon loading' : 'toast-icon';
    icon.textContent = style.icon;
    icon.style.cssText = `
      display: inline-block;
      ${type === 'loading' ? 'font-size: 16px;' : ''}
    `;
    iconContainer.appendChild(icon);

    // Text content
    const messageEl = document.createElement('div');
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
    const accentBar = document.createElement('div');
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
    if (type !== 'loading' && duration > 0) {
      setTimeout(() => {
        toast.classList.add('toast-exit');
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
   * Show download dialog using native <dialog> element
   * @param {string} defaultFilename - Default filename
   * @param {string} defaultFormat - Default format
   * @param {Function} onExpand - Callback when expand button is clicked
   * @param {Function} onShrink - Callback when shrink button is clicked
   * @param {boolean} canExpand - Whether expand button should be enabled
   * @param {boolean} canShrink - Whether shrink button should be enabled
   * @returns {Promise<{filename: string, format: string} | null>} Returns user input or null if cancelled
   */
  function showDownloadDialog(defaultFilename, defaultFormat = 'svg', onExpand = null, onShrink = null, canExpand = false, canShrink = false) {
    return new Promise((resolve) => {
      const dialogId = `${prefix}-download-dialog`;
      
      // Remove existing dialog
      const existingDialog = document.getElementById(dialogId);
      if (existingDialog) {
        existingDialog.remove();
      }

      // Add dialog styles if not already added
      if (!document.getElementById(`${dialogId}-styles`)) {
        const styleSheet = document.createElement('style');
        styleSheet.dataset.capture = "exclude";
        styleSheet.id = `${dialogId}-styles`;
        styleSheet.textContent = `
          #${dialogId} {
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
          #${dialogId}::backdrop {
            background: transparent;
          }
          #${dialogId} .dialog-content {
            padding: 24px;
          }
          #${dialogId} h3 {
            margin: 0 0 20px 0;
            font-size: 18px;
            font-weight: 600;
            color: #09090b;
          }
          #${dialogId} .form-group {
            margin-bottom: 16px;
          }
          #${dialogId} .form-group:last-of-type {
            margin-bottom: 24px;
          }
          #${dialogId} label {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: 500;
            color: #09090b;
          }
          #${dialogId} input,
          #${dialogId} select {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid rgba(0, 0, 0, 0.2);
            border-radius: 6px;
            font-size: 14px;
            font-family: inherit;
            box-sizing: border-box;
            transition: border-color 0.2s;
          }
          #${dialogId} input:focus,
          #${dialogId} select:focus {
            outline: none;
            border-color: #3b82f6;
          }
          #${dialogId} select {
            background: white;
            cursor: pointer;
          }
          #${dialogId} .button-group {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            flex-wrap: wrap;
          }
          #${dialogId} button {
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            font-family: inherit;
          }
          #${dialogId} button[type="button"] {
            border: 1px solid rgba(0, 0, 0, 0.2);
            background: white;
            color: #09090b;
          }
          #${dialogId} button[type="button"]:hover {
            background: #f5f5f5;
          }
          #${dialogId} button.expand-button,
          #${dialogId} button.shrink-button {
            border: 1px solid #3b82f6;
            background: white;
            color: #3b82f6;
          }
          #${dialogId} button.expand-button:hover,
          #${dialogId} button.shrink-button:hover {
            background: #eff6ff;
          }
          #${dialogId} button.expand-button:disabled,
          #${dialogId} button.shrink-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          #${dialogId} button.expand-button:disabled:hover,
          #${dialogId} button.shrink-button:disabled:hover {
            background: white;
          }
          #${dialogId} button[type="submit"] {
            border: none;
            background: #3b82f6;
            color: white;
          }
          #${dialogId} button[type="submit"]:hover {
            background: #2563eb;
          }
          #${dialogId} .loading-overlay {
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
          #${dialogId} .loading-overlay.active {
            opacity: 1;
            pointer-events: auto;
          }
          #${dialogId} .loading-overlay .loading-text {
            font-size: 14px;
            color: #3b82f6;
            font-weight: 500;
          }
          #${dialogId} .dialog-content {
            position: relative;
          }
        `;
        document.head.appendChild(styleSheet);
      }

      // Create dialog element
      const dialog = document.createElement('dialog');
      dialog.id = dialogId;
      dialog.dataset.capture = "exclude";

      // Create form for dialog
      const form = document.createElement('form');
      form.method = 'dialog';

      // Create content wrapper
      const content = document.createElement('div');
      content.className = 'dialog-content';

      // Create loading overlay
      const loadingOverlay = document.createElement('div');
      loadingOverlay.className = 'loading-overlay';
      const loadingText = document.createElement('div');
      loadingText.className = 'loading-text';
      loadingText.textContent = '处理中...';
      loadingOverlay.appendChild(loadingText);

      // Title
      const title = document.createElement('h3');
      title.textContent = '下载设置';

      // Filename input group
      const filenameGroup = document.createElement('div');
      filenameGroup.className = 'form-group';

      const filenameLabel = document.createElement('label');
      filenameLabel.textContent = '文件名';
      filenameLabel.setAttribute('for', `${dialogId}-filename`);

      const filenameInput = document.createElement('input');
      filenameInput.type = 'text';
      filenameInput.id = `${dialogId}-filename`;
      filenameInput.name = 'filename';
      filenameInput.value = defaultFilename;
      filenameInput.autofocus = true;

      filenameGroup.appendChild(filenameLabel);
      filenameGroup.appendChild(filenameInput);

      // Format select group
      const formatGroup = document.createElement('div');
      formatGroup.className = 'form-group';

      const formatLabel = document.createElement('label');
      formatLabel.textContent = '格式';
      formatLabel.setAttribute('for', `${dialogId}-format`);

      const formatSelect = document.createElement('select');
      formatSelect.id = `${dialogId}-format`;
      formatSelect.name = 'format';

      const formats = ['svg', 'png', 'jpg', 'webp'];
      formats.forEach(format => {
        const option = document.createElement('option');
        option.value = format;
        option.textContent = format.toUpperCase();
        if (format === defaultFormat) {
          option.selected = true;
        }
        formatSelect.appendChild(option);
      });

      formatGroup.appendChild(formatLabel);
      formatGroup.appendChild(formatSelect);

      // Buttons
      const buttonGroup = document.createElement('div');
      buttonGroup.className = 'button-group';

      // Expand button
      if (onExpand) {
        const expandButton = document.createElement('button');
        expandButton.type = 'button';
        expandButton.textContent = '扩大';
        expandButton.className = 'expand-button';
        expandButton.disabled = !canExpand;
        expandButton.addEventListener('click', async () => {
          if (!canExpand) return;
          
          // Show loading overlay
          loadingOverlay.classList.add('active');
          expandButton.disabled = true;
          if (onShrink) {
            const shrinkBtn = buttonGroup.querySelector('.shrink-button');
            if (shrinkBtn) shrinkBtn.disabled = true;
          }
          
          try {
            // Call expand callback to update highlight box and re-capture
            // onExpand returns a promise that we need to wait for
            const expandPromise = onExpand();
            if (expandPromise) {
              await expandPromise;
            }
            
            // Get current filename and format from inputs before closing
            const currentFilename = filenameInput.value.trim() || defaultFilename;
            const currentFormat = formatSelect.value;
            
            // Close dialog and resolve after operation completes
            dialog.close();
            dialog.remove();
            resolve({ action: 'expand', filename: currentFilename, format: currentFormat });
          } catch {
            // Hide loading overlay on error
            loadingOverlay.classList.remove('active');
            expandButton.disabled = !canExpand;
            if (onShrink) {
              const shrinkBtn = buttonGroup.querySelector('.shrink-button');
              if (shrinkBtn) shrinkBtn.disabled = !canShrink;
            }
          }
        });
        buttonGroup.appendChild(expandButton);
      }

      // Shrink button
      if (onShrink) {
        const shrinkButton = document.createElement('button');
        shrinkButton.type = 'button';
        shrinkButton.textContent = '缩小';
        shrinkButton.className = 'shrink-button';
        shrinkButton.disabled = !canShrink;
        shrinkButton.addEventListener('click', async () => {
          if (!canShrink) return;
          
          // Show loading overlay
          loadingOverlay.classList.add('active');
          shrinkButton.disabled = true;
          if (onExpand) {
            const expandBtn = buttonGroup.querySelector('.expand-button');
            if (expandBtn) expandBtn.disabled = true;
          }
          
          try {
            // Call shrink callback to restore previous element and re-capture
            // onShrink returns a promise that we need to wait for
            const shrinkPromise = onShrink();
            if (shrinkPromise) {
              await shrinkPromise;
            }
            
            // Get current filename and format from inputs before closing
            const currentFilename = filenameInput.value.trim() || defaultFilename;
            const currentFormat = formatSelect.value;
            
            // Close dialog and resolve after operation completes
            dialog.close();
            dialog.remove();
            resolve({ action: 'shrink', filename: currentFilename, format: currentFormat });
          } catch {
            // Hide loading overlay on error
            loadingOverlay.classList.remove('active');
            shrinkButton.disabled = !canShrink;
            if (onExpand) {
              const expandBtn = buttonGroup.querySelector('.expand-button');
              if (expandBtn) expandBtn.disabled = !canExpand;
            }
          }
        });
        buttonGroup.appendChild(shrinkButton);
      }

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.textContent = '取消';
      cancelButton.value = 'cancel';
      cancelButton.addEventListener('click', () => {
        dialog.close();
        dialog.remove();
        resolve(null);
      });

      const confirmButton = document.createElement('button');
      confirmButton.type = 'submit';
      confirmButton.textContent = '确认';
      confirmButton.value = 'confirm';

      buttonGroup.appendChild(cancelButton);
      buttonGroup.appendChild(confirmButton);

      // Handle form submission
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const filename = formData.get('filename').trim() || defaultFilename;
        const format = formData.get('format');
        dialog.close();
        dialog.remove();
        resolve({ filename, format });
      });

      // Handle cancel event (ESC key or backdrop click)
      dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        dialog.close();
        dialog.remove();
        resolve(null);
      });

      // Assemble dialog
      content.appendChild(title);
      content.appendChild(filenameGroup);
      content.appendChild(formatGroup);
      content.appendChild(buttonGroup);
      content.appendChild(loadingOverlay); // Add loading overlay
      form.appendChild(content);
      dialog.appendChild(form);

      // Add to page
      document.body.appendChild(dialog);

      // Disable body scroll when dialog is shown
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${scrollY}px`;

      // Show modal dialog
      dialog.showModal();

      // Select filename text
      setTimeout(() => {
        filenameInput.select();
      }, 100);

      // Restore scroll when dialog is closed
      const restoreScroll = () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.width = '';
        document.body.style.top = '';
        window.scrollTo(0, scrollY);
      };

      // Override resolve to restore scroll
      const originalResolve = resolve;
      resolve = (value) => {
        restoreScroll();
        originalResolve(value);
      };

      // Also restore scroll on cancel
      dialog.addEventListener('cancel', () => {
        restoreScroll();
      });
    });
  }

  /**
   * Execute screenshot function
   * @param {'svg' | 'png' | 'jpg' | 'webp'} format
   * @param {HTMLElement} targetElement - Optional, specify element to capture, defaults to entire page
   */
  async function takeScreenshot(targetElement = null) {
    // Initialize element history stack (for shrink functionality)
    const elementHistory = targetElement ? [targetElement] : [];
    
    // Determine element to capture
    let elementToCapture = targetElement || document.documentElement;
    
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
      if (window.innerWidth !== initialWidth || window.innerHeight !== initialHeight) {
        cancelledByResize = true;
        window.removeEventListener('resize', handleResize);
        hideHighlightBox();
        showToast('窗口尺寸已变化，截图已取消', 'error');
      }
    };
    window.addEventListener('resize', handleResize);

    // Show loading toast
    const loadingToast = showToast('Capturing screenshot...', 'loading', 0);

    try {
      // Check if cancelled by resize before proceeding
      if (cancelledByResize) {
        window.removeEventListener('resize', handleResize);
        return;
      }

      const snapdom = await waitForSnapdom();
      if (!snapdom) {
        throw new Error('snapdom library not loaded');
      }

      // Check if cancelled by resize before executing screenshot
      if (cancelledByResize) {
        window.removeEventListener('resize', handleResize);
        if (loadingToast && loadingToast.parentNode) {
          loadingToast.remove();
        }
        return;
      }

      // Execute screenshot
      let result = await snapdom(elementToCapture);

      // Check again after screenshot
      if (cancelledByResize) {
        window.removeEventListener('resize', handleResize);
        if (loadingToast && loadingToast.parentNode) {
          loadingToast.remove();
        }
        return;
      }

      // Generate filename helper function
      const generateFilename = (element) => {
        let filename = `${location.host.split('.')[0]}_${location.pathname}_${new Date().toLocaleTimeString().split(' ')[0].replace(/:/g, '')}`;
        if (element && element !== document.documentElement) {
          const tagName = element.tagName.toLowerCase();
          const className = element.className ? element.className.split(' ')[0] : '';
          filename += `_${tagName}${className ? '_' + className : ''}`;
        }
        return filename.replace(/[^a-zA-Z0-9_]/g, '');
      };

      let filename = generateFilename(elementToCapture);

      // Remove loading toast before showing dialog
      if (loadingToast && loadingToast.parentNode) {
        loadingToast.remove();
      }

      // Define expand callback - move to parent element
      let expandPromise = null;
      const onExpand = () => {
        // Check if cancelled by resize
        if (cancelledByResize) {
          return null;
        }

        // If already at document.documentElement, cannot expand further
        if (elementToCapture === document.documentElement) {
          return null;
        }
        
        // Get parent element (can be document.documentElement)
        const parent = elementToCapture.parentElement;
        if (!parent) {
          // No parent, cannot expand
          return null;
        }
        
        // Push current element to history
        elementHistory.push(elementToCapture);
        
        // Update to parent element (can be document.documentElement)
        elementToCapture = parent;
        updateHighlightBox(elementToCapture);
        
        // Show loading toast
        const expandToast = showToast('Expanding capture area...', 'loading', 0);
        
        // Create and return promise for expand operation
        expandPromise = (async () => {
          try {
            // Check again before re-capture
            if (cancelledByResize) {
              if (expandToast && expandToast.parentNode) {
                expandToast.remove();
              }
              return;
            }

            // Re-capture with parent element
            result = await snapdom(elementToCapture);
            
            // Check after re-capture
            if (cancelledByResize) {
              if (expandToast && expandToast.parentNode) {
                expandToast.remove();
              }
              return;
            }
            
            // Remove loading toast
            if (expandToast && expandToast.parentNode) {
              expandToast.remove();
            }
          } catch (error) {
            console.error('Expand capture failed:', error);
            if (expandToast && expandToast.parentNode) {
              expandToast.remove();
            }
            showToast(`Expand failed: ${error.message}`, 'error');
            throw error;
          }
        })();
        
        return expandPromise;
      };

      // Define shrink callback - restore previous element from history
      let shrinkPromise = null;
      const onShrink = () => {
        // Check if cancelled by resize
        if (cancelledByResize) {
          return null;
        }

        // Check if we have history to restore
        if (elementHistory.length === 0) {
          return null;
        }
        
        // Pop previous element from history
        elementToCapture = elementHistory.pop();
        updateHighlightBox(elementToCapture);
        
        // Show loading toast
        const shrinkToast = showToast('Shrinking capture area...', 'loading', 0);
        
        // Create and return promise for shrink operation
        shrinkPromise = (async () => {
          try {
            // Check again before re-capture
            if (cancelledByResize) {
              if (shrinkToast && shrinkToast.parentNode) {
                shrinkToast.remove();
              }
              return;
            }

            // Re-capture with previous element
            result = await snapdom(elementToCapture);
            
            // Check after re-capture
            if (cancelledByResize) {
              if (shrinkToast && shrinkToast.parentNode) {
                shrinkToast.remove();
              }
              return;
            }
            
            // Remove loading toast
            if (shrinkToast && shrinkToast.parentNode) {
              shrinkToast.remove();
            }
          } catch (error) {
            console.error('Shrink capture failed:', error);
            if (shrinkToast && shrinkToast.parentNode) {
              shrinkToast.remove();
            }
            showToast(`Shrink failed: ${error.message}`, 'error');
            throw error;
          }
        })();
        
        return shrinkPromise;
      };

      // Check if expand/shrink buttons should be enabled
      // Can expand if not already at document.documentElement and has a parent
      const canExpand = elementToCapture !== document.documentElement && elementToCapture.parentElement !== null;
      const canShrink = elementHistory.length > 0;

      // Show download dialog with expand/shrink options
      let dialogResult = await showDownloadDialog(filename, 'svg', onExpand, onShrink, canExpand, canShrink);
      
      // Save user's input for filename and format (will be preserved during expand/shrink)
      let currentFilename = dialogResult && dialogResult.filename ? dialogResult.filename : filename;
      let currentFormat = dialogResult && dialogResult.format ? dialogResult.format : 'svg';
      
      // Handle expand/shrink actions - wait for operation to complete, then re-show dialog
      while (dialogResult && (dialogResult.action === 'expand' || dialogResult.action === 'shrink')) {
        const promise = dialogResult.action === 'expand' ? expandPromise : shrinkPromise;
        
        if (promise) {
          try {
            // Wait for operation to complete
            await promise;
            
            // Update saved filename and format from dialog result (preserve user's input)
            if (dialogResult.filename) {
              currentFilename = dialogResult.filename;
            }
            if (dialogResult.format) {
              currentFormat = dialogResult.format;
            }
            
            // Update button states
            const newCanExpand = elementToCapture !== document.documentElement && elementToCapture.parentElement !== null;
            const newCanShrink = elementHistory.length > 0;
            
            // Reset promises for next operation
            expandPromise = null;
            shrinkPromise = null;
            
            // Show dialog again with updated states, but preserve user's filename and format
            dialogResult = await showDownloadDialog(currentFilename, currentFormat, onExpand, onShrink, newCanExpand, newCanShrink);
            
            // Update saved values if user changed them (but not during expand/shrink)
            if (dialogResult && !dialogResult.action) {
              if (dialogResult.filename) {
                currentFilename = dialogResult.filename;
              }
              if (dialogResult.format) {
                currentFormat = dialogResult.format;
              }
            }
          } catch {
            // If operation failed, break the loop
            break;
          }
        } else {
          // No promise created (operation was not possible), break the loop
          break;
        }
      }
      
      // Remove resize listener before showing dialog (dialog will handle its own scroll)
      window.removeEventListener('resize', handleResize);

      // If user cancelled, hide highlight box and return early
      if (!dialogResult) {
        hideHighlightBox();
        return;
      }

      // Use values from dialog
      const finalFilename = dialogResult.filename;
      const finalFormat = dialogResult.format;

      // Re-add resize listener during download
      window.addEventListener('resize', handleResize);

      // Show loading toast again
      const downloadToast = showToast('Downloading...', 'loading', 0);

      await result.download({ format: finalFormat, filename: finalFilename });

      // Remove resize listener after download
      window.removeEventListener('resize', handleResize);

      // Remove loading toast
      if (downloadToast && downloadToast.parentNode) {
        downloadToast.remove();
      }

      // Hide highlight box after successful download
      hideHighlightBox();

      // Show success toast
      showToast('Screenshot saved! File downloaded', 'success');
    } catch (error) {
      console.error('Screenshot failed:', error);

      // Remove resize listener on error
      window.removeEventListener('resize', handleResize);

      // Remove loading toast
      if (loadingToast && loadingToast.parentNode) {
        loadingToast.remove();
      }

      // Hide highlight box on error
      hideHighlightBox();

      // Show error toast
      showToast(`Screenshot failed: ${error.message}`, 'error');
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

    highlightBox = document.createElement('div');
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
    highlightBox.style.display = 'block';
  }

  /**
   * Hide highlight box
   */
  function hideHighlightBox() {
    if (highlightBox) {
      highlightBox.style.display = 'none';
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
      highlightBox.style.pointerEvents = 'none';
    }

    const element = document.elementFromPoint(e.clientX, e.clientY);

    // If clicking on highlight box or toast, return null
    if (!element ||
      element.id === highlightBoxId ||
      element.id === toastId ||
      element.closest(`#${highlightBoxId}`) ||
      element.closest(`#${toastId}`)) {
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
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleMouseClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', handleScroll, true);

      // Restore cursor style
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Capture selected element (highlight box will be hidden after capture completes/cancels)
      await takeScreenshot(element);
    }
  }

  /**
   * Handle keyboard events (ESC to exit selection mode)
   */
  function handleKeyDown(e) {
    if (!isElementSelectMode) return;

    if (e.key === 'Escape') {
      exitElementSelectMode();
      showToast('Element selection cancelled', 'info');
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
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleMouseClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleScroll, true);

    // Change cursor style
    document.body.style.cursor = 'crosshair';
    document.body.style.userSelect = 'none';

    showToast('Select an element to capture, press ESC to cancel', 'info', 5000);
  }

  /**
   * Exit element selection mode
   */
  function exitElementSelectMode() {
    if (!isElementSelectMode) return;

    isElementSelectMode = false;
    currentHoveredElement = null;

    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleMouseClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('scroll', handleScroll, true);

    // Restore cursor style
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Hide highlight box
    hideHighlightBox();
  }

  // Register Tampermonkey menu commands
  if (typeof GM_registerMenuCommand !== 'undefined') {
    // Register screenshot menu items
    GM_registerMenuCommand('📸 Capture Screenshot', () => takeScreenshot(), 's');
    // Register element selection screenshot menu item
    GM_registerMenuCommand('🎯 Select Element to Capture', () => enterElementSelectMode(), 'e');
  }
})();
