// ==UserScript==
// @name         Jira 周报生成器
// @namespace    http://tampermonkey.net/
// @version      1.3.0
// @description  从Jira工作日志生成周报，支持Markdown预览
// @author       canvascat
// @match        https://jira.*
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iIzAwNTJjYyIvPjxyZWN0IHg9IjQiIHk9IjEyIiB3aWR0aD0iNCIgaGVpZ2h0PSI4IiByeD0iMSIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSIxMCIgeT0iOCIgd2lkdGg9IjQiIGhlaWdodD0iMTIiIHJ4PSIxIiBmaWxsPSJ3aGl0ZSIvPjxyZWN0IHg9IjE2IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSIxNiIgcng9IjEiIGZpbGw9IndoaXRlIi8+PC9zdmc+
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @require      https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js
// @license      AGPL-3.0
// ==/UserScript==

(function () {
  "use strict";

  /** @type {string} 脚本前缀，用于生成唯一ID */
  const prefix = `jira-weekly-report-${Date.now().toString(36)}`;

  /**
   * 获取当前登录用户名
   * @returns {string} 用户名
   */
  function getCurrentUsername() {
    // 从页面meta标签获取用户名
    const meta = document.querySelector('meta[name="ajs-remote-user"]');
    if (meta) {
      return meta.getAttribute("content") || "";
    }
    // 备选：从cookie或其他地方获取
    return "";
  }

  /**
   * 格式化日期为 yyyy-MM-dd 格式
   * @param {Date} date - 日期对象
   * @returns {string} 格式化后的日期字符串
   */
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * 格式化日期为中文显示格式 M月d日
   * @param {Date} date - 日期对象
   * @returns {string} 格式化后的日期字符串
   */
  function formatDateCN(date) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  /**
   * 获取指定周的日期范围
   * @param {number} weeksAgo - 几周前 (0=本周, 1=上周, 2=上上周...)
   * @returns {{start: Date, end: Date, weekNumber: number}} 周的起止日期和周数
   */
  function getWeekRange(weeksAgo = 0) {
    const now = new Date();
    const currentDay = now.getDay();
    // 计算本周一的日期 (周日为0，需要特殊处理)
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset - weeksAgo * 7);
    monday.setHours(0, 0, 0, 0);

    // 计算周日的日期
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    // 计算周数
    const startOfYear = new Date(monday.getFullYear(), 0, 1);
    const days = Math.floor(
      (monday.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
    );
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);

    return { start: monday, end: sunday, weekNumber };
  }

  /**
   * 从Jira API获取工作日志数据
   * @param {string} username - 用户名
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @returns {Promise<Array>} 工作日志数据
   */
  async function fetchWorklogs(username, startDate, endDate) {
    // 结束日期需要+1天，因为JQL是不包含结束日期的
    const endDatePlus1 = new Date(endDate);
    endDatePlus1.setDate(endDatePlus1.getDate() + 1);

    const jql = `worklogAuthor in ('${username}') AND worklogDate >= ${formatDate(
      startDate
    )} AND worklogDate < ${formatDate(endDatePlus1)}`;

    const requestBody = {
      fields: [
        "project",
        "key",
        "priority",
        "issuetype",
        "assignee",
        "reporter",
        "timeoriginalestimate",
        "resolution",
        "status",
        "fixVersions",
        "versions",
        "components",
        "labels",
        "summary",
        "worklog",
        "parent",
      ],
      jql: jql,
      startAt: 0,
      maxResults: 600,
      expand: [],
    };

    const response = await fetch("/rest/api/2/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.issues || [];
  }

  /**
   * 处理工作日志数据，生成周报格式
   * @param {Array} issues - Jira问题列表
   * @param {string} username - 用户名
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @returns {Object} 处理后的周报数据
   */
  function processWorklogs(issues, username, startDate, endDate) {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    /** @type {Map<string, {key: string, summary: string, status: string, totalSeconds: number, worklogs: Array}>} */
    const issueMap = new Map();

    /** @type {Set<string>} 记录有工作日志的日期 */
    const workDates = new Set();

    let totalSeconds = 0;

    issues.forEach((issue) => {
      const { key, fields } = issue;
      const { summary, status, worklog } = fields;

      if (!worklog || !worklog.worklogs) return;

      // 筛选当前用户在指定时间范围内的工作日志
      const relevantWorklogs = worklog.worklogs.filter((log) => {
        if (log.author.name !== username) return false;
        const logDate = new Date(log.started).getTime();
        return logDate >= startTime && logDate <= endTime;
      });

      if (relevantWorklogs.length === 0) return;

      // 记录有工作日志的日期
      relevantWorklogs.forEach((log) => {
        const logDate = new Date(log.started);
        workDates.add(formatDate(logDate));
      });

      const issueSeconds = relevantWorklogs.reduce(
        (sum, log) => sum + log.timeSpentSeconds,
        0
      );
      totalSeconds += issueSeconds;

      if (!issueMap.has(key)) {
        issueMap.set(key, {
          key,
          summary,
          status: status?.name || "未知",
          totalSeconds: issueSeconds,
          worklogs: relevantWorklogs,
        });
      } else {
        const existing = issueMap.get(key);
        existing.totalSeconds += issueSeconds;
        existing.worklogs.push(...relevantWorklogs);
      }
    });

    // 将日期排序
    const sortedDates = Array.from(workDates).sort();

    return {
      issues: Array.from(issueMap.values()),
      totalSeconds,
      workDates: sortedDates,
    };
  }

  /**
   * 格式化秒数为可读时间
   * @param {number} seconds - 秒数
   * @returns {string} 格式化后的时间字符串
   */
  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0 && minutes > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (hours > 0) {
      return `${hours}小时`;
    } else if (minutes > 0) {
      return `${minutes}分钟`;
    }
    return "0分钟";
  }

  /**
   * 根据工作日期生成标题日期范围
   * @param {Array<string>} workDates - 有工作日志的日期数组 (yyyy-MM-dd 格式)
   * @returns {string} 日期范围字符串
   */
  function generateDateRangeTitle(workDates) {
    if (workDates.length === 0) return "";
    if (workDates.length === 1) {
      const date = new Date(workDates[0]);
      return formatDateCN(date);
    }

    // 检测是否是连续日期
    const dates = workDates.map((d) => new Date(d));
    const ranges = [];
    let rangeStart = dates[0];
    let rangeEnd = dates[0];

    for (let i = 1; i < dates.length; i++) {
      const prevDate = dates[i - 1];
      const currDate = dates[i];
      const dayDiff =
        (currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000);

      if (dayDiff === 1) {
        // 连续日期，扩展范围
        rangeEnd = currDate;
      } else {
        // 不连续，保存当前范围并开始新范围
        ranges.push({ start: rangeStart, end: rangeEnd });
        rangeStart = currDate;
        rangeEnd = currDate;
      }
    }
    // 保存最后一个范围
    ranges.push({ start: rangeStart, end: rangeEnd });

    // 生成范围字符串
    return ranges
      .map((range) => {
        if (range.start.getTime() === range.end.getTime()) {
          return formatDateCN(range.start);
        }
        return `${formatDateCN(range.start)}-${formatDateCN(range.end)}`;
      })
      .join("、");
  }

  /**
   * 生成周报文本
   * @param {Object} reportData - 周报数据
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @param {number} weekNumber - 周数
   * @returns {string} 周报文本
   */
  function generateReportText(reportData, startDate, endDate, weekNumber) {
    const { issues, totalSeconds, workDates } = reportData;

    // 生成标题：使用实际工作日期范围
    let titleDateRange;
    if (workDates && workDates.length > 0) {
      titleDateRange = generateDateRangeTitle(workDates);
    } else {
      titleDateRange = `${formatDateCN(startDate)} - ${formatDateCN(endDate)}`;
    }

    let report = `## ${titleDateRange}\n\n`;

    if (issues.length === 0) {
      report += `暂无工作日志记录。\n`;
    } else {
      // 按工时降序排序
      issues.sort((a, b) => b.totalSeconds - a.totalSeconds);

      issues.forEach((issue) => {
        const issueLink = `[${issue.key}](${location.origin}/browse/${issue.key})`;
        // 主条目：任务名称和链接
        report += `- **${issue.summary}** ${issueLink}`;
        // 工时信息弱化显示
        report += ` <sub>${formatTime(issue.totalSeconds)}</sub>\n`;

        // 如果有工作记录备注，显示为子列表
        const commentsLogs = issue.worklogs.filter((log) => log.comment);
        if (commentsLogs.length > 0) {
          commentsLogs.forEach((log) => {
            const logDate = new Date(log.started);
            report += `  - ${log.comment}`;
            report += ` <sub>${formatDateCN(logDate)}</sub>\n`;
          });
        }
      });

      // 总工时在末尾显示，弱化处理
      report += `\n<sub>总工时：${formatTime(totalSeconds)}</sub>\n`;
    }

    return report;
  }

  /**
   * 生成多周周报
   * @param {string} username - 用户名
   * @param {number} weeksCount - 周数
   * @param {number} startWeeksAgo - 从几周前开始
   * @returns {Promise<string>} 周报文本
   */
  async function generateMultiWeekReport(username, weeksCount, startWeeksAgo) {
    let fullReport = "";

    for (let i = startWeeksAgo; i < startWeeksAgo + weeksCount; i++) {
      const { start, end, weekNumber } = getWeekRange(i);
      const issues = await fetchWorklogs(username, start, end);
      const reportData = processWorklogs(issues, username, start, end);
      const report = generateReportText(reportData, start, end, weekNumber);

      if (fullReport) {
        fullReport += "\n---\n\n";
      }
      fullReport += report;
    }

    return fullReport;
  }

  /**
   * 创建周报生成对话框
   */
  class WeeklyReportDialog {
    /** @type {string} 对话框唯一ID */
    dialogId = `${prefix}-dialog`;

    /** @type {HTMLDialogElement | null} 对话框元素 */
    dialog = null;

    /** @type {Function | null} Promise resolve 函数 */
    _resolve = null;

    constructor() {
      this._injectStyles();
    }

    /**
     * 注入对话框样式
     * @private
     */
    _injectStyles() {
      if (document.getElementById(`${this.dialogId}-styles`)) return;

      const styleSheet = document.createElement("style");
      styleSheet.id = `${this.dialogId}-styles`;
      styleSheet.textContent = `
        #${this.dialogId} {
          padding: 0;
          border: none;
          border-radius: 12px;
          box-shadow: 0 20px 60px -10px rgba(0, 0, 0, 0.3);
          width: 560px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        #${this.dialogId}::backdrop {
          background: rgba(0, 0, 0, 0.5);
        }
        #${this.dialogId} .dialog-content {
          padding: 24px;
          position: relative;
        }
        #${this.dialogId} .dialog-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        #${this.dialogId} h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #172b4d;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        #${this.dialogId} h3::before {
          content: '📊';
        }
        #${this.dialogId} .close-btn {
          width: 32px;
          height: 32px;
          border: none;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b778c;
          font-size: 20px;
          transition: all 0.2s;
          padding: 0;
        }
        #${this.dialogId} .close-btn:hover {
          background: #f4f5f7;
          color: #172b4d;
        }
        #${this.dialogId} .form-group {
          margin-bottom: 20px;
        }
        #${this.dialogId} label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #172b4d;
        }
        #${this.dialogId} select,
        #${this.dialogId} input[type="number"] {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #dfe1e6;
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          box-sizing: border-box;
          transition: border-color 0.2s;
          background: #fff;
        }
        #${this.dialogId} select:focus,
        #${this.dialogId} input[type="number"]:focus {
          outline: none;
          border-color: #0052cc;
          box-shadow: 0 0 0 2px rgba(0, 82, 204, 0.2);
        }
        #${this.dialogId} .radio-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        #${this.dialogId} .radio-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border: 1px solid #dfe1e6;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        #${this.dialogId} .radio-item:hover {
          border-color: #0052cc;
          background: #f4f5f7;
        }
        #${this.dialogId} .radio-item.selected {
          border-color: #0052cc;
          background: #deebff;
        }
        #${this.dialogId} .radio-item input[type="radio"] {
          margin: 0;
          width: 18px;
          height: 18px;
          accent-color: #0052cc;
        }
        #${this.dialogId} .radio-item .radio-label {
          flex: 1;
        }
        #${this.dialogId} .radio-item .radio-label-title {
          font-weight: 500;
          color: #172b4d;
        }
        #${this.dialogId} .radio-item .radio-label-desc {
          font-size: 12px;
          color: #6b778c;
          margin-top: 2px;
        }
        #${this.dialogId} .custom-weeks {
          display: none;
          margin-top: 12px;
          padding: 12px;
          background: #f4f5f7;
          border-radius: 6px;
        }
        #${this.dialogId} .custom-weeks.visible {
          display: block;
        }
        #${this.dialogId} .custom-weeks-row {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        #${this.dialogId} .custom-weeks-row .form-group {
          flex: 1;
          margin-bottom: 0;
        }
        #${this.dialogId} .button-group {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #dfe1e6;
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
        #${this.dialogId} button.btn-cancel {
          border: 1px solid #dfe1e6;
          background: white;
          color: #172b4d;
        }
        #${this.dialogId} button.btn-cancel:hover {
          background: #f4f5f7;
        }
        #${this.dialogId} button.btn-primary {
          border: none;
          background: #0052cc;
          color: white;
        }
        #${this.dialogId} button.btn-primary:hover {
          background: #0747a6;
        }
        #${this.dialogId} button.btn-primary:disabled {
          background: #dfe1e6;
          cursor: not-allowed;
        }
        #${this.dialogId} .loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.9);
          display: flex;
          flex-direction: column;
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
        #${this.dialogId} .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #dfe1e6;
          border-top-color: #0052cc;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        #${this.dialogId} .loading-text {
          margin-top: 12px;
          font-size: 14px;
          color: #6b778c;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        #${this.dialogId} .result-container {
          display: none;
        }
        #${this.dialogId} .result-container.visible {
          display: block;
        }
        #${this.dialogId} .result-tabs {
          display: flex;
          gap: 0;
          margin-bottom: 12px;
          border-bottom: 1px solid #dfe1e6;
        }
        #${this.dialogId} .result-tab {
          padding: 10px 20px;
          border: none;
          border-radius: 0;
          background: none;
          font-size: 14px;
          font-weight: 500;
          color: #6b778c;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: all 0.2s;
        }
        #${this.dialogId} .result-tab:hover {
          color: #172b4d;
        }
        #${this.dialogId} .result-tab.active {
          color: #0052cc;
          border-bottom-color: #0052cc;
        }
        #${this.dialogId} .result-panels {
          position: relative;
          height: 380px;
        }
        #${this.dialogId} .result-panel {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.15s ease;
        }
        #${this.dialogId} .result-panel.active {
          opacity: 1;
          visibility: visible;
        }
        #${this.dialogId} .result-textarea {
          width: 100%;
          height: 100%;
          padding: 12px;
          border: 1px solid #dfe1e6;
          border-radius: 6px;
          font-size: 13px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          resize: none;
          box-sizing: border-box;
        }
        #${this.dialogId} .result-preview {
          height: 100%;
          padding: 16px 20px;
          border: 1px solid #dfe1e6;
          border-radius: 6px;
          overflow-y: auto;
          background: #fff;
          box-sizing: border-box;
        }
        #${this.dialogId} .result-preview h1,
        #${this.dialogId} .result-preview h2,
        #${this.dialogId} .result-preview h3 {
          margin-top: 0;
          margin-bottom: 16px;
          color: #172b4d;
          font-weight: 600;
          line-height: 1.3;
        }
        #${this.dialogId} .result-preview h2 {
          font-size: 18px;
          padding-bottom: 8px;
          border-bottom: 1px solid #dfe1e6;
        }
        #${this.dialogId} .result-preview ul {
          margin: 0;
          padding-left: 0;
          list-style: none;
        }
        #${this.dialogId} .result-preview > ul > li {
          margin-bottom: 12px;
          padding-left: 20px;
          position: relative;
        }
        #${this.dialogId} .result-preview > ul > li::before {
          content: '•';
          position: absolute;
          left: 4px;
          color: #0052cc;
          font-weight: bold;
        }
        #${this.dialogId} .result-preview ul ul {
          margin-top: 6px;
          padding-left: 16px;
        }
        #${this.dialogId} .result-preview ul ul li {
          margin-bottom: 4px;
          padding-left: 16px;
          position: relative;
          color: #6b778c;
          font-size: 13px;
        }
        #${this.dialogId} .result-preview ul ul li::before {
          content: '○';
          position: absolute;
          left: 0;
          color: #97a0af;
          font-size: 10px;
        }
        #${this.dialogId} .result-preview a {
          color: #0052cc;
          text-decoration: none;
        }
        #${this.dialogId} .result-preview a:hover {
          text-decoration: underline;
        }
        #${this.dialogId} .result-preview sub {
          color: #97a0af;
          font-size: 12px;
        }
        #${this.dialogId} .result-preview strong {
          color: #172b4d;
        }
        #${this.dialogId} .result-preview hr {
          border: none;
          border-top: 1px solid #dfe1e6;
          margin: 20px 0;
        }
        #${this.dialogId} .result-actions {
          display: flex;
          gap: 12px;
          margin-top: 12px;
        }
        /* 全屏模式样式 */
        #${this.dialogId}.fullscreen {
          width: 100vw;
          height: 100vh;
          max-width: 100vw;
          max-height: 100vh;
          border-radius: 0;
        }
        #${this.dialogId}.fullscreen .dialog-content {
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 0;
          overflow: hidden;
        }
        #${this.dialogId}.fullscreen .dialog-header {
          padding: 16px 24px;
          border-bottom: 1px solid #dfe1e6;
          background: #f4f5f7;
          flex-shrink: 0;
        }
        #${this.dialogId}.fullscreen .result-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        #${this.dialogId}.fullscreen .result-tabs {
          padding: 0 24px;
          flex-shrink: 0;
        }
        #${this.dialogId}.fullscreen .result-panels {
          flex: 1;
          height: auto;
          position: relative;
          overflow: hidden;
        }
        #${this.dialogId}.fullscreen .result-panel {
          padding: 24px;
          overflow-y: auto;
        }
        #${this.dialogId}.fullscreen .result-preview {
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
          height: auto;
          border: none;
          padding: 0;
          overflow: visible;
        }
        #${this.dialogId}.fullscreen .result-preview h2 {
          font-size: 22px;
          padding-bottom: 12px;
          border-bottom: 2px solid #dfe1e6;
        }
        #${this.dialogId}.fullscreen .result-preview > ul > li {
          margin-bottom: 14px;
          font-size: 15px;
          line-height: 1.6;
        }
        #${this.dialogId}.fullscreen #source-panel {
          display: flex;
          justify-content: center;
        }
        #${this.dialogId}.fullscreen #source-panel.active {
          display: flex;
        }
        #${this.dialogId}.fullscreen .result-textarea {
          max-width: 800px;
          width: 100%;
          height: calc(100% - 48px);
          margin: 24px 0;
          border: 1px solid #dfe1e6;
          border-radius: 6px;
          padding: 16px;
        }
        #${this.dialogId}.fullscreen .result-actions {
          display: none;
        }
        #${this.dialogId}.fullscreen .fullscreen-header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        #${this.dialogId}.fullscreen .close-btn {
          display: none;
        }
        #${this.dialogId} .fullscreen-header-actions {
          display: none;
        }
        #${this.dialogId} .fullscreen-header-actions button {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        #${this.dialogId} .fullscreen-header-actions .btn-cancel {
          border: 1px solid #dfe1e6;
          background: white;
          color: #172b4d;
        }
        #${this.dialogId} .fullscreen-header-actions .btn-cancel:hover {
          background: #fff;
          border-color: #172b4d;
        }
        #${this.dialogId} .fullscreen-header-actions .btn-primary {
          border: none;
          background: #0052cc;
          color: white;
        }
        #${this.dialogId} .fullscreen-header-actions .btn-primary:hover {
          background: #0747a6;
        }
      `;
      document.head.appendChild(styleSheet);
    }

    /**
     * 创建对话框DOM
     * @private
     */
    _createDialog() {
      const existingDialog = document.getElementById(this.dialogId);
      if (existingDialog) {
        existingDialog.remove();
      }

      this.dialog = document.createElement("dialog");
      this.dialog.id = this.dialogId;

      const content = document.createElement("div");
      content.className = "dialog-content";
      content.innerHTML = `
        <div class="dialog-header">
          <h3>生成周报</h3>
          <div class="fullscreen-header-actions">
            <button type="button" class="btn-cancel" id="header-copy-btn">复制</button>
            <button type="button" class="btn-cancel" id="header-download-btn">下载</button>
            <button type="button" class="btn-primary" id="header-exit-fullscreen-btn">退出全屏</button>
          </div>
          <button type="button" class="close-btn" id="close-btn" title="关闭">×</button>
        </div>

        <div class="form-container">
          <div class="form-group">
            <label>选择周报范围</label>
            <div class="radio-group">
              <div class="radio-item selected" data-value="this-week">
                <input type="radio" name="week-range" value="this-week" checked>
                <div class="radio-label">
                  <div class="radio-label-title">本周</div>
                  <div class="radio-label-desc" id="this-week-desc"></div>
                </div>
              </div>
              <div class="radio-item" data-value="last-week">
                <input type="radio" name="week-range" value="last-week">
                <div class="radio-label">
                  <div class="radio-label-title">上周</div>
                  <div class="radio-label-desc" id="last-week-desc"></div>
                </div>
              </div>
              <div class="radio-item" data-value="custom">
                <input type="radio" name="week-range" value="custom">
                <div class="radio-label">
                  <div class="radio-label-title">自定义</div>
                  <div class="radio-label-desc">选择最近n周的周报</div>
                </div>
              </div>
            </div>
          </div>

          <div class="custom-weeks" id="custom-weeks-container">
            <div class="custom-weeks-row">
              <div class="form-group">
                <label>从几周前开始</label>
                <input type="number" id="start-weeks-ago" value="0" min="0" max="52">
              </div>
              <div class="form-group">
                <label>生成几周</label>
                <input type="number" id="weeks-count" value="4" min="1" max="12">
              </div>
            </div>
          </div>
        </div>

        <div class="result-container" id="result-container">
          <div class="result-tabs">
            <button type="button" class="result-tab active" data-tab="preview">预览</button>
            <button type="button" class="result-tab" data-tab="source">源码</button>
          </div>
          <div class="result-panels">
            <div class="result-panel active" id="preview-panel">
              <div class="result-preview" id="report-preview"></div>
            </div>
            <div class="result-panel" id="source-panel">
              <textarea class="result-textarea" id="report-textarea" readonly></textarea>
            </div>
          </div>
          <div class="result-actions">
            <button type="button" class="btn-primary" id="copy-btn">复制到剪贴板</button>
            <button type="button" class="btn-cancel" id="download-btn">下载为文件</button>
            <button type="button" class="btn-cancel" id="fullscreen-btn">全屏预览</button>
          </div>
        </div>

        <div class="button-group" id="action-buttons">
          <button type="button" class="btn-cancel" id="cancel-btn">取消</button>
          <button type="button" class="btn-primary" id="generate-btn">生成周报</button>
        </div>

        <div class="loading-overlay" id="loading-overlay">
          <div class="loading-spinner"></div>
          <div class="loading-text">正在生成周报...</div>
        </div>
      `;

      this.dialog.appendChild(content);
      document.body.appendChild(this.dialog);

      this._bindEvents();
      this._updateDateDescriptions();
    }

    /**
     * 更新日期描述
     * @private
     */
    _updateDateDescriptions() {
      const thisWeek = getWeekRange(0);
      const lastWeek = getWeekRange(1);

      const thisWeekDesc = document.getElementById("this-week-desc");
      const lastWeekDesc = document.getElementById("last-week-desc");

      if (thisWeekDesc) {
        thisWeekDesc.textContent = `${formatDateCN(
          thisWeek.start
        )} - ${formatDateCN(thisWeek.end)} (第${thisWeek.weekNumber}周)`;
      }
      if (lastWeekDesc) {
        lastWeekDesc.textContent = `${formatDateCN(
          lastWeek.start
        )} - ${formatDateCN(lastWeek.end)} (第${lastWeek.weekNumber}周)`;
      }
    }

    /**
     * 绑定事件
     * @private
     */
    _bindEvents() {
      const radioItems = this.dialog.querySelectorAll(".radio-item");
      const customWeeksContainer = document.getElementById(
        "custom-weeks-container"
      );
      const closeBtn = document.getElementById("close-btn");
      const cancelBtn = document.getElementById("cancel-btn");
      const generateBtn = document.getElementById("generate-btn");
      const copyBtn = document.getElementById("copy-btn");
      const downloadBtn = document.getElementById("download-btn");
      const fullscreenBtn = document.getElementById("fullscreen-btn");
      const headerCopyBtn = document.getElementById("header-copy-btn");
      const headerDownloadBtn = document.getElementById("header-download-btn");
      const headerExitFullscreenBtn = document.getElementById("header-exit-fullscreen-btn");
      const tabs = this.dialog.querySelectorAll(".result-tab");

      // 关闭按钮
      closeBtn.addEventListener("click", () => {
        this.close();
      });

      // 头部操作按钮（全屏模式）
      headerCopyBtn.addEventListener("click", () => {
        const textarea = document.getElementById("report-textarea");
        navigator.clipboard.writeText(textarea.value).then(() => {
          headerCopyBtn.textContent = "已复制!";
          setTimeout(() => {
            headerCopyBtn.textContent = "复制";
          }, 2000);
        });
      });

      headerDownloadBtn.addEventListener("click", () => {
        const textarea = document.getElementById("report-textarea");
        const blob = new Blob([textarea.value], {
          type: "text/markdown;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `周报_${formatDate(new Date())}.md`;
        a.click();
        URL.revokeObjectURL(url);
      });

      headerExitFullscreenBtn.addEventListener("click", () => {
        this._toggleFullscreen();
      });

      // 单选按钮切换
      radioItems.forEach((item) => {
        item.addEventListener("click", () => {
          radioItems.forEach((i) => i.classList.remove("selected"));
          item.classList.add("selected");
          const radio = item.querySelector('input[type="radio"]');
          radio.checked = true;

          // 显示/隐藏自定义选项
          if (item.dataset.value === "custom") {
            customWeeksContainer.classList.add("visible");
          } else {
            customWeeksContainer.classList.remove("visible");
          }
        });
      });

      // 选项卡切换
      tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          const targetTab = tab.dataset.tab;
          // 更新选项卡状态
          tabs.forEach((t) => t.classList.remove("active"));
          tab.classList.add("active");
          // 更新面板显示
          const panels = this.dialog.querySelectorAll(".result-panel");
          panels.forEach((panel) => panel.classList.remove("active"));
          document.getElementById(`${targetTab}-panel`).classList.add("active");
        });
      });

      // 取消按钮
      cancelBtn.addEventListener("click", () => {
        this.close();
      });

      // 生成按钮
      generateBtn.addEventListener("click", () => {
        this._handleGenerate();
      });

      // 复制按钮
      copyBtn.addEventListener("click", () => {
        const textarea = document.getElementById("report-textarea");
        navigator.clipboard.writeText(textarea.value).then(() => {
          copyBtn.textContent = "已复制!";
          setTimeout(() => {
            copyBtn.textContent = "复制到剪贴板";
          }, 2000);
        });
      });

      // 下载按钮
      downloadBtn.addEventListener("click", () => {
        const textarea = document.getElementById("report-textarea");
        const blob = new Blob([textarea.value], {
          type: "text/markdown;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `周报_${formatDate(new Date())}.md`;
        a.click();
        URL.revokeObjectURL(url);
      });

      // 全屏预览按钮
      fullscreenBtn.addEventListener("click", () => {
        this._toggleFullscreen();
      });

      // ESC关闭（全屏模式下先退出全屏）
      this.dialog.addEventListener("cancel", (e) => {
        e.preventDefault();
        if (this.dialog.classList.contains("fullscreen")) {
          this._toggleFullscreen();
        } else {
          this.close();
        }
      });
    }

    /**
     * 渲染Markdown预览
     * @private
     * @param {string} markdown - Markdown文本
     * @returns {string} HTML字符串
     */
    _renderMarkdown(markdown) {
      // 使用 marked 库渲染 Markdown
      if (typeof marked !== "undefined") {
        // 配置 marked
        marked.setOptions({
          breaks: true,
          gfm: true,
        });
        return marked.parse(markdown);
      }
      // 如果 marked 库未加载，使用简单的替换
      return markdown
        .replace(/^## (.+)$/gm, "<h2>$1</h2>")
        .replace(/^- \*\*(.+?)\*\* (.+)$/gm, "<li><strong>$1</strong> $2</li>")
        .replace(/^  - (.+)$/gm, "<li class='sub'>$1</li>")
        .replace(/<sub>(.+?)<\/sub>/g, "<sub>$1</sub>")
        .replace(
          /\[(.+?)\]\((.+?)\)/g,
          '<a href="$2" target="_blank">$1</a>'
        )
        .replace(/\n/g, "<br>");
    }

    /**
     * 处理生成周报
     * @private
     */
    async _handleGenerate() {
      const loadingOverlay = document.getElementById("loading-overlay");
      const resultContainer = document.getElementById("result-container");
      const formContainer = this.dialog.querySelector(".form-container");
      const actionButtons = document.getElementById("action-buttons");
      const reportTextarea = document.getElementById("report-textarea");
      const reportPreview = document.getElementById("report-preview");

      // 获取选择的范围
      const selectedRadio = this.dialog.querySelector(
        'input[name="week-range"]:checked'
      );
      const rangeType = selectedRadio?.value || "this-week";

      // 获取用户名
      const username = getCurrentUsername();
      if (!username) {
        alert("无法获取当前用户名，请确保已登录Jira");
        return;
      }

      // 显示加载状态
      loadingOverlay.classList.add("active");

      try {
        let report = "";

        if (rangeType === "this-week") {
          report = await generateMultiWeekReport(username, 1, 0);
        } else if (rangeType === "last-week") {
          report = await generateMultiWeekReport(username, 1, 1);
        } else {
          const startWeeksAgo =
            parseInt(document.getElementById("start-weeks-ago").value) || 0;
          const weeksCount =
            parseInt(document.getElementById("weeks-count").value) || 4;
          report = await generateMultiWeekReport(
            username,
            weeksCount,
            startWeeksAgo
          );
        }

        // 隐藏加载，显示结果
        loadingOverlay.classList.remove("active");
        formContainer.style.display = "none";
        actionButtons.style.display = "none";
        resultContainer.classList.add("visible");

        // 设置源码
        reportTextarea.value = report;

        // 渲染预览
        reportPreview.innerHTML = this._renderMarkdown(report);
      } catch (error) {
        loadingOverlay.classList.remove("active");
        alert(`生成周报失败: ${error.message}`);
        console.error("生成周报失败:", error);
      }
    }

    /**
     * 切换全屏模式
     * @private
     */
    _toggleFullscreen() {
      const fullscreenBtn = document.getElementById("fullscreen-btn");
      const isFullscreen = this.dialog.classList.toggle("fullscreen");

      if (isFullscreen) {
        fullscreenBtn.textContent = "退出全屏";
      } else {
        fullscreenBtn.textContent = "全屏预览";
      }
    }

    /**
     * 显示对话框
     */
    show() {
      this._createDialog();
      this.dialog.showModal();
      // 禁用页面滚动
      document.body.style.overflow = "hidden";
    }

    /**
     * 关闭对话框
     */
    close() {
      if (this.dialog) {
        this.dialog.close();
        this.dialog.remove();
        this.dialog = null;
        // 恢复页面滚动
        document.body.style.overflow = "";
      }
    }
  }

  /**
   * 创建悬浮按钮
   */
  function createFloatingButton() {
    const buttonId = `${prefix}-floating-btn`;

    // 如果已存在则不重复创建
    if (document.getElementById(buttonId)) return;

    const button = document.createElement("button");
    button.id = buttonId;
    button.innerHTML = "📊";
    button.title = "生成周报";

    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #0052cc 0%, #0747a6 100%);
      color: white;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 82, 204, 0.4);
      transition: all 0.3s ease;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    button.addEventListener("mouseenter", () => {
      button.style.transform = "scale(1.1)";
      button.style.boxShadow = "0 6px 16px rgba(0, 82, 204, 0.5)";
    });

    button.addEventListener("mouseleave", () => {
      button.style.transform = "scale(1)";
      button.style.boxShadow = "0 4px 12px rgba(0, 82, 204, 0.4)";
    });

    button.addEventListener("click", () => {
      const dialog = new WeeklyReportDialog();
      dialog.show();
    });

    document.body.appendChild(button);
  }

  /**
   * 初始化
   */
  function init() {
    // 等待页面加载完成
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", createFloatingButton);
    } else {
      createFloatingButton();
    }

    // 注册油猴菜单命令
    if (typeof GM_registerMenuCommand !== "undefined") {
      GM_registerMenuCommand("📊 生成周报", () => {
        const dialog = new WeeklyReportDialog();
        dialog.show();
      });
    }
  }

  init();
})();
