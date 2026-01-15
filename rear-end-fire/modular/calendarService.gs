/**
 * calendarService.gs - 日曆服務模組
 * 美甲預約系統 - Google Apps Script
 *
 * 包含：Advanced Calendar API 服務、日曆活動建立、通知發送
 */

// ==================== Advanced Calendar API 服務 ====================

/**
 * Advanced Calendar API 事件查詢服務
 */
class AdvancedCalendarService {

  /**
   * 智慧分頁查詢事件（主要入口）
   */
  static getEvents(calendarId, startTime, endTime, options = {}) {
    if (ADVANCED_CALENDAR_CONFIG.smartPagination.enabled) {
      return this.getEventsWithSmartPagination(calendarId, startTime, endTime, options);
    } else {
      return this.getEventsDirectly(calendarId, startTime, endTime, options);
    }
  }

  /**
   * 智慧分頁查詢實作
   */
  static getEventsWithSmartPagination(calendarId, startTime, endTime, options = {}) {
    try {
      const startTime_ms = Date.now();
      const queryAnalysis = this.analyzeQueryComplexity(startTime, endTime);

      if (queryAnalysis.shouldUsePagination) {
        return this.executePaginatedQuery(calendarId, startTime, endTime, options, queryAnalysis);
      } else {
        return this.getEventsDirectly(calendarId, startTime, endTime, options);
      }

    } catch (error) {
      Logger.error('智慧分頁查詢失敗，降級到直接查詢', error, 'calendar');
      return this.getEventsDirectly(calendarId, startTime, endTime, options);
    }
  }

  /**
   * 分析查詢複雜度
   */
  static analyzeQueryComplexity(startTime, endTime) {
    const config = ADVANCED_CALENDAR_CONFIG.smartPagination;
    const queryDays = Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24));
    const estimatedEvents = queryDays * config.estimation.dailyEventsAverage * config.estimation.bufferMultiplier;

    const shouldUsePagination = (
      queryDays > 30 ||
      estimatedEvents > 200 ||
      queryDays > config.estimation.maxEstimationDays / 3
    );

    const suggestedPageSize = this.calculateOptimalPageSize(estimatedEvents, queryDays);

    return {
      queryDays: queryDays,
      estimatedEvents: Math.round(estimatedEvents),
      shouldUsePagination: shouldUsePagination,
      suggestedPageSize: suggestedPageSize,
      complexity: queryDays > 60 ? 'high' : queryDays > 30 ? 'medium' : 'low'
    };
  }

  /**
   * 計算最佳分頁大小
   */
  static calculateOptimalPageSize(estimatedEvents, queryDays) {
    const config = ADVANCED_CALENDAR_CONFIG.smartPagination.pageSize;
    let pageSize = config.base;

    if (estimatedEvents < 100) {
      pageSize = Math.min(config.max, estimatedEvents + 20);
    } else if (estimatedEvents < 300) {
      pageSize = config.base * 1.5;
    }

    if (queryDays > 60) {
      pageSize = Math.max(config.min, pageSize * 0.7);
    } else if (queryDays < 7) {
      pageSize = Math.min(config.max, pageSize * 1.3);
    }

    return Math.max(config.min, Math.min(config.max, Math.round(pageSize)));
  }

  /**
   * 執行分頁查詢
   */
  static executePaginatedQuery(calendarId, startTime, endTime, options, queryAnalysis) {
    const allEvents = [];
    let pageToken = null;
    let pageCount = 0;
    let currentPageSize = queryAnalysis.suggestedPageSize;

    do {
      pageCount++;

      try {
        const pageOptions = Object.assign({},
          ADVANCED_CALENDAR_CONFIG.queryOptions,
          options,
          {
            maxResults: currentPageSize,
            pageToken: pageToken,
            timeMin: startTime.toISOString(),
            timeMax: endTime.toISOString(),
            timeZone: SYSTEM_CONFIG.TIMEZONE
          }
        );

        const response = Calendar.Events.list(calendarId, pageOptions);
        const pageEvents = this.convertToCompatibleEvents(response.items || []);

        for (var i = 0; i < pageEvents.length; i++) {
          allEvents.push(pageEvents[i]);
        }

        pageToken = response.nextPageToken;

        if (pageCount > 20) {
          console.warn('分頁數量過多，停止載入以避免超時');
          break;
        }

      } catch (error) {
        console.error(`第 ${pageCount} 頁載入失敗:`, error);
        break;
      }

    } while (pageToken);

    return allEvents;
  }

  /**
   * 傳統直接查詢
   */
  static getEventsDirectly(calendarId, startTime, endTime, options = {}) {
    try {
      const queryOptions = Object.assign({},
        ADVANCED_CALENDAR_CONFIG.queryOptions,
        {
          timeMin: startTime.toISOString(),
          timeMax: endTime.toISOString(),
          timeZone: SYSTEM_CONFIG.TIMEZONE
        },
        options
      );

      const response = Calendar.Events.list(calendarId, queryOptions);
      return this.convertToCompatibleEvents(response.items || []);

    } catch (error) {
      console.error('Advanced Calendar API 查詢失敗:', error);
      return this.fallbackToCalendarApp(calendarId, startTime, endTime);
    }
  }

  /**
   * 將 Advanced API 的事件格式轉換為相容格式
   */
  static convertToCompatibleEvents(apiEvents) {
    return apiEvents.map(apiEvent => {
      return {
        getId: () => apiEvent.id,
        getTitle: () => apiEvent.summary || '',
        getDescription: () => apiEvent.description || '',
        getLocation: () => apiEvent.location || '',
        getStartTime: () => {
          if (apiEvent.start.dateTime) {
            return new Date(apiEvent.start.dateTime);
          } else if (apiEvent.start.date) {
            return new Date(apiEvent.start.date + 'T00:00:00');
          }
          return new Date();
        },
        getEndTime: () => {
          if (apiEvent.end.dateTime) {
            return new Date(apiEvent.end.dateTime);
          } else if (apiEvent.end.date) {
            return new Date(apiEvent.end.date + 'T23:59:59');
          }
          return new Date();
        },
        isAllDayEvent: () => !apiEvent.start.dateTime && apiEvent.start.date,
        _originalApiEvent: apiEvent
      };
    });
  }

  /**
   * 備援方案：使用傳統 CalendarApp
   */
  static fallbackToCalendarApp(calendarId, startTime, endTime) {
    try {
      const calendar = CalendarApp.getCalendarById(calendarId);
      if (!calendar) {
        console.warn('找不到指定的日曆:', calendarId);
        return [];
      }
      return calendar.getEvents(startTime, endTime);
    } catch (error) {
      console.error('傳統 CalendarApp 查詢也失敗:', error);
      return [];
    }
  }

  /**
   * 取得效能統計物件
   */
  static getPerformanceStats() {
    if (!this._performanceStats) {
      this._performanceStats = {
        queries: [],
        maxRecords: 100,
        record: function(queryInfo) {
          this.queries.push(Object.assign({}, queryInfo, { timestamp: new Date().toISOString() }));
          if (this.queries.length > this.maxRecords) {
            this.queries = this.queries.slice(-this.maxRecords);
          }
        },
        getSummary: function() {
          if (this.queries.length === 0) return { message: '暫無效能數據' };
          const recentQueries = this.queries.slice(-20);
          const loadTimes = recentQueries.map(q => q.totalLoadTime || 0);
          const sumLoadTimes = loadTimes.reduce((a, b) => a + b, 0);
          return {
            totalQueries: this.queries.length,
            averageLoadTime: Math.round(sumLoadTimes / loadTimes.length)
          };
        },
        reset: function() {
          this.queries = [];
        }
      };
    }
    return this._performanceStats;
  }

  static get performanceStats() {
    return this.getPerformanceStats();
  }
}

// ==================== 日曆活動建立 ====================

/**
 * 建立 Google 日曆活動
 * @param {Object} bookingData - 預約資料
 * @returns {Object} - 建立結果
 */
function createCalendarEvent(bookingData) {
  console.log('開始建立日曆活動');

  try {
    if (CALENDAR_CONFIG.calendarId === 'YOUR_CALENDAR_ID@gmail.com') {
      return { success: false, message: '日曆ID尚未設定', skipped: true };
    }

    const calendar = CalendarApp.getCalendarById(CALENDAR_CONFIG.calendarId);
    if (!calendar) {
      throw new Error(`找不到日曆ID: ${CALENDAR_CONFIG.calendarId}`);
    }

    // 驗證時間格式
    if (!SYSTEM_CONFIG.TIME_FORMAT_REGEX.test(bookingData.time)) {
      throw new Error(`無效的時間格式: ${bookingData.time}`);
    }

    // 建立開始與結束時間
    const startIso = bookingData.isoStart && /[\+\-]\d{2}:?\d{2}$/.test(bookingData.isoStart)
      ? bookingData.isoStart
      : `${bookingData.date}T${bookingData.time}:00+08:00`;
    const startTime = new Date(startIso);
    const endTime = new Date(startTime.getTime() + CALENDAR_CONFIG.defaultDuration * 60 * 60 * 1000);

    // 建立活動
    const title = `${bookingData.customerName} - 美甲預約`;
    const description = createEventDescription(bookingData);

    const event = calendar.createEvent(title, startTime, endTime, {
      description: description,
      location: ''
    });

    // 處理 Event ID
    let eventId = event.getId();
    if (eventId.includes('@google.com')) {
      eventId = eventId.split('@')[0];
    }

    return {
      success: true,
      eventId: eventId,
      title: title,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      calendarName: calendar.getName(),
      message: '日曆活動建立成功'
    };

  } catch (error) {
    console.error('建立Google日曆活動失敗:', error.message);
    return {
      success: false,
      error: error.message,
      message: '日曆活動建立失敗'
    };
  }
}

/**
 * 建立活動說明內容
 */
function createEventDescription(bookingData) {
  const parts = [];

  if (bookingData.phone) parts.push(`手機: ${bookingData.phone}`);
  if (bookingData.services) parts.push(`服務項目: ${bookingData.services}`);
  if (bookingData.removal) parts.push(`卸甲服務: ${bookingData.removal}`);
  if (bookingData.quantity) parts.push(`延甲: ${bookingData.quantity}`);
  if (bookingData.remarks) parts.push(`備註: ${bookingData.remarks}`);

  parts.push('');
  parts.push('--- 系統資訊 ---');
  parts.push(`建立時間: ${new Date().toLocaleString('zh-TW', { timeZone: SYSTEM_CONFIG.TIMEZONE })}`);
  parts.push('此活動由美甲預約系統自動建立');

  return parts.join('\n');
}

// ==================== 通知發送 ====================

/**
 * 發送預約通知
 */
function sendBookingNotification(bookingData, calendarResult) {
  console.log('準備發送預約通知...');

  if (!NOTIFICATION_CONFIG.enabled) {
    return { success: true, skipped: true, message: '通知功能已停用' };
  }

  if (!NOTIFICATION_CONFIG.recipientEmail || NOTIFICATION_CONFIG.recipientEmail === 'your-email@gmail.com') {
    return { success: false, error: '通知接收者Email尚未設定' };
  }

  try {
    const emailResult = sendEmailNotification(bookingData, calendarResult);
    return { success: true, email: emailResult, message: '通知發送完成' };
  } catch (error) {
    console.error('發送通知時發生錯誤:', error);
    return { success: false, error: error.message, message: '通知發送失敗' };
  }
}

/**
 * 發送 Email 通知
 */
function sendEmailNotification(bookingData, calendarResult) {
  // 格式化日期
  let displayDate = bookingData.date;
  if (displayDate) {
    try {
      const dateObj = new Date(displayDate);
      if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const weekday = weekdays[dateObj.getDay()];
        displayDate = `${year}年${month}月${day}日（${weekday}）`;
      }
    } catch (e) {
      // 保持原格式
    }
  }

  const subject = `新預約通知 - ${bookingData.customerName} (${displayDate} ${bookingData.time})`;
  const emailBody = createEmailBody(bookingData, calendarResult);

  GmailApp.sendEmail(
    NOTIFICATION_CONFIG.recipientEmail,
    subject,
    '',
    { htmlBody: emailBody, name: NOTIFICATION_CONFIG.senderName }
  );

  return { success: true, recipient: NOTIFICATION_CONFIG.recipientEmail, subject: subject };
}

/**
 * 建立 Email 內容
 */
function createEmailBody(bookingData, calendarResult) {
  let displayDate = bookingData.date;
  if (displayDate) {
    try {
      const dateObj = new Date(displayDate);
      if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const weekday = weekdays[dateObj.getDay()];
        displayDate = `${year}年${month}月${day}日（${weekday}）`;
      }
    } catch (e) {}
  }

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ff69b4; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
        .info-row { margin: 10px 0; padding: 10px; background: white; border-radius: 5px; }
        .label { font-weight: bold; color: #ff69b4; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>新預約通知</h1>
        </div>
        <div class="content">
            <div class="info-row"><span class="label">客戶：</span>${bookingData.customerName || '未提供'}</div>
            <div class="info-row"><span class="label">電話：</span>${bookingData.phone}</div>
            <div class="info-row"><span class="label">日期：</span>${displayDate}</div>
            <div class="info-row"><span class="label">時間：</span>${bookingData.time}</div>
            <div class="info-row"><span class="label">服務：</span>${bookingData.services}</div>
            ${bookingData.removal ? `<div class="info-row"><span class="label">卸甲：</span>${bookingData.removal}</div>` : ''}
            <div class="info-row"><span class="label">延甲：</span>${bookingData.quantity || '無'}</div>
            ${bookingData.remarks ? `<div class="info-row"><span class="label">備註：</span>${bookingData.remarks}</div>` : ''}
        </div>
    </div>
</body>
</html>
  `;
}

// ==================== 日曆同步功能 ====================

/**
 * 同步 Google 日曆的刪除事件到試算表
 */
function syncCalendarDeletions() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    console.warn('上一次同步尚未結束，跳過本次執行');
    return;
  }

  console.log('開始執行日曆同步...');

  try {
    const props = PropertiesService.getScriptProperties();
    const calendarId = props.getProperty('GOOGLE_CALENDAR_ID');

    if (!calendarId || calendarId.includes('YOUR_')) {
      console.warn('日曆 ID 尚未設定正確，跳過同步');
      return;
    }

    let syncToken = props.getProperty('CALENDAR_SYNC_TOKEN');
    let pageToken = null;
    let events = [];

    do {
      const options = {
        maxResults: 100,
        showDeleted: true,
        singleEvents: true,
        pageToken: pageToken
      };

      if (syncToken) {
        options.syncToken = syncToken;
      } else {
        const past30Days = new Date();
        past30Days.setDate(past30Days.getDate() - 30);
        options.timeMin = past30Days.toISOString();
      }

      let response;
      try {
        response = Calendar.Events.list(calendarId, options);
      } catch (e) {
        if (e.message.includes('Sync token is no longer valid') || e.message.includes('410')) {
          props.deleteProperty('CALENDAR_SYNC_TOKEN');
          lock.releaseLock();
          syncCalendarDeletions();
          return;
        }
        throw e;
      }

      if (response.items && response.items.length > 0) {
        events = events.concat(response.items);
      }

      pageToken = response.nextPageToken;

      if (response.nextSyncToken) {
        props.setProperty('CALENDAR_SYNC_TOKEN', response.nextSyncToken);
      }

    } while (pageToken);

    if (events.length > 0) {
      processCalendarChanges(events);
    } else {
      console.log('日曆無變更');
    }

  } catch (error) {
    console.error('同步日曆失敗:', error);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 處理日曆變更事件（支援多年度工作表）
 */
function processCalendarChanges(events) {
  const deletedEventIds = events
    .filter(event => event.status === 'cancelled')
    .map(event => event.id);

  if (deletedEventIds.length === 0) {
    console.log('未發現刪除項目');
    return;
  }

  console.log(`偵測到 ${deletedEventIds.length} 筆刪除事件`);

  // 取得所有年度預約工作表
  const bookingSheetNames = getAllBookingSheetNames();
  console.log('將搜尋的工作表:', bookingSheetNames);

  let totalDeletedCount = 0;

  // 遍歷每個年度工作表
  for (const sheetName of bookingSheetNames) {
    try {
      const bookingSheet = getSheet(sheetName);
      const lastRow = bookingSheet.getLastRow();

      if (lastRow <= 1) {
        console.log(`工作表 ${sheetName} 無資料，略過`);
        continue;
      }

      const eventIdRange = bookingSheet.getRange(2, 11, lastRow - 1, 1);
      const eventIdsInSheet = eventIdRange.getValues().flat().map(id => String(id));

      const rowsToDelete = [];

      deletedEventIds.forEach(deletedId => {
        const targetId = String(deletedId);
        for (let i = 0; i < eventIdsInSheet.length; i++) {
          let sheetId = String(eventIdsInSheet[i]);
          if (sheetId.includes('@google.com')) {
            sheetId = sheetId.split('@')[0];
          }
          if (sheetId === targetId) {
            rowsToDelete.push(i + 2);
          }
        }
      });

      if (rowsToDelete.length === 0) {
        continue;
      }

      // 從後往前刪除，避免列號偏移
      const uniqueRows = [...new Set(rowsToDelete)].sort((a, b) => b - a);

      uniqueRows.forEach(row => {
        try {
          bookingSheet.deleteRow(row);
          totalDeletedCount++;
        } catch (e) {
          console.error(`刪除 ${sheetName} 第 ${row} 列失敗:`, e);
        }
      });

      console.log(`工作表 ${sheetName} 刪除了 ${uniqueRows.length} 筆記錄`);

    } catch (error) {
      console.error(`處理工作表 ${sheetName} 時發生錯誤:`, error);
    }
  }

  if (totalDeletedCount > 0) {
    clearBookingCache();
    console.log(`同步完成！共刪除 ${totalDeletedCount} 筆預約資料`);
  } else {
    console.log('試算表中無對應的預約資料');
  }
}
