/**
 * utils.gs - 工具函數模組
 * 美甲預約系統 - Google Apps Script
 *
 * 包含：日期處理、回應建立器、ID生成等共用工具
 */

// ==================== 日期處理工具 ====================

/**
 * 從 Date 物件提取台北時區的日期字串
 * @param {Date} date - Date 物件
 * @returns {string} - YYYY-MM-DD 格式的日期字串（台北時區）
 */
function getTaipeiDateString(date) {
  const UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
  const taipeiTime = new Date(date.getTime() + UTC_OFFSET_MS);
  return taipeiTime.toISOString().split('T')[0];
}

/**
 * 將「YYYY-MM-DD」日期字串轉換為 Asia/Taipei 時區的 Date 物件
 * @param {string} dateString - YYYY-MM-DD 格式的日期字串
 * @returns {Date} - 對應到該日 00:00 的 Date 物件
 */
function createTaipeiDateFromYMD(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    throw new Error('無法建立日期：dateString 參數缺失或格式錯誤');
  }
  const normalizedIsoString = dateString + 'T00:00:00+08:00';
  return new Date(normalizedIsoString);
}

/**
 * 解析預約日期（支援多種格式）
 * @param {string|Date} dateString - 日期字串或 Date 物件
 * @returns {Date} - 解析後的日期物件
 */
function parseBookingDate(dateString) {
  if (typeof dateString === 'string') {
    // "2024年1月15日" 格式
    if (dateString.includes('年') && dateString.includes('月') && dateString.includes('日')) {
      const match = dateString.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const day = parseInt(match[3]);
        return new Date(year, month, day);
      }
    }

    // "2024-01-15" 或 "2024/01/15" 格式
    if (dateString.includes('-') || dateString.includes('/')) {
      return new Date(dateString);
    }
  }

  if (dateString instanceof Date) {
    return dateString;
  }

  return new Date(dateString);
}

// ==================== 回應建立器 ====================

/**
 * 優化版響應建立器
 * @param {Object} data - 回應資料
 * @param {boolean} includeDebugInfo - 是否包含除錯資訊
 * @returns {Object} - 優化的響應物件
 */
function createOptimizedResponse(data, includeDebugInfo = false) {
  const response = {
    success: true,
    timestamp: Date.now(),
    ...data
  };

  if (includeDebugInfo && LOG_CONFIG.level === 'DEBUG') {
    response.debug = {
      optimization: 'response_streamlined',
      timestamp: new Date().toISOString()
    };
  }

  return response;
}

/**
 * 建立成功回應
 * @param {Object} data - 回應資料
 * @returns {TextOutput} - 格式化的回應
 */
function createSuccessResponse(data) {
  const response = {
    success: true,
    timestamp: new Date().toISOString(),
    ...data
  };

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 建立錯誤回應
 * @param {string} message - 錯誤訊息
 * @returns {TextOutput} - 格式化的錯誤回應
 */
function createErrorResponse(message) {
  const response = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== ID 生成 ====================

/**
 * 生成唯一ID
 * @returns {string} - 唯一ID
 */
function generateId() {
  return 'ID_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
}

// ==================== 工作表操作 ====================

/**
 * 預約紀錄工作表的標題欄位
 */
const BOOKING_SHEET_HEADERS = ['LINE User ID', '客戶姓名', '手機', '預約日期', '預約時間', '服務項目', '卸甲服務', '延甲', '備註', '建立時間', 'Event ID'];

/**
 * 取得指定的工作表
 * @param {string} sheetName - 工作表名稱
 * @returns {Sheet} - 工作表物件
 */
function getSheet(sheetName) {
  const spreadsheet = getCachedSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);

    if (sheetName === CUSTOMER_SHEET_NAME) {
      sheet.getRange(1, 1, 1, 6).setValues([
        ['LINE User ID', '姓名', '手機', '建檔時間', '最後預約時間', '總預約次數']
      ]);
    } else if (sheetName === BOOKING_SHEET_NAME || isBookingSheetName(sheetName)) {
      // 支援主預約工作表和年度預約工作表
      sheet.getRange(1, 1, 1, BOOKING_SHEET_HEADERS.length).setValues([BOOKING_SHEET_HEADERS]);
    }

    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
  }

  return sheet;
}

/**
 * 判斷是否為預約紀錄工作表（包含年度分表）
 * @param {string} sheetName - 工作表名稱
 * @returns {boolean} - 是否為預約紀錄工作表
 */
function isBookingSheetName(sheetName) {
  // 匹配 "預約記錄" 或 "預約記錄2024"、"預約記錄2025" 等格式
  return /^預約記錄\d{4}$/.test(sheetName);
}

/**
 * 根據預約日期取得對應的預約工作表名稱
 * @param {string} dateStr - 預約日期字串（YYYY-MM-DD 格式）
 * @returns {string} - 工作表名稱（例如：預約記錄2026）
 */
function getBookingSheetNameByDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error('無效的日期參數');
  }

  // 從 YYYY-MM-DD 格式提取年份
  const year = dateStr.substring(0, 4);

  if (!/^\d{4}$/.test(year)) {
    throw new Error('無法從日期中提取年份: ' + dateStr);
  }

  return BOOKING_SHEET_NAME + year;
}

/**
 * 取得所有預約紀錄工作表名稱
 * @returns {Array<string>} - 所有預約紀錄工作表名稱陣列
 */
function getAllBookingSheetNames() {
  const spreadsheet = getCachedSpreadsheet();
  const sheets = spreadsheet.getSheets();
  const bookingSheetNames = [];

  for (const sheet of sheets) {
    const name = sheet.getName();
    // 匹配年度預約工作表（預約記錄2024、預約記錄2025 等）
    if (isBookingSheetName(name)) {
      bookingSheetNames.push(name);
    }
  }

  // 按年份排序（新的在前）
  bookingSheetNames.sort((a, b) => {
    const yearA = parseInt(a.replace(BOOKING_SHEET_NAME, ''));
    const yearB = parseInt(b.replace(BOOKING_SHEET_NAME, ''));
    return yearB - yearA;
  });

  return bookingSheetNames;
}

// ==================== 查詢範圍優化 ====================

/**
 * 取得優化的查詢時間範圍（營業時間範圍優化）
 * @param {string} queryDateStr - 查詢日期字串 (YYYY-MM-DD)
 * @returns {Object} - 優化的時間範圍 { startTime, endTime, reason }
 */
function getOptimizedQueryRange(queryDateStr) {
  const config = CALENDAR_CONFIG;

  if (!config.optimization.enableBusinessHoursFilter) {
    return {
      startTime: new Date(queryDateStr + 'T00:00:00+08:00'),
      endTime: new Date(queryDateStr + 'T23:59:59+08:00'),
      reason: 'optimization_disabled'
    };
  }

  try {
    const [startHour, startMinute] = config.businessHours.start.split(':').map(Number);
    const [endHour, endMinute] = config.businessHours.end.split(':').map(Number);

    const businessStartTime = new Date(queryDateStr + 'T' +
      String(startHour).padStart(2, '0') + ':' +
      String(startMinute).padStart(2, '0') + ':00+08:00');

    const businessEndTime = new Date(queryDateStr + 'T' +
      String(endHour).padStart(2, '0') + ':' +
      String(endMinute).padStart(2, '0') + ':59+08:00');

    const dayStart = new Date(queryDateStr + 'T00:00:00+08:00');
    const dayEnd = new Date(queryDateStr + 'T23:59:59+08:00');

    const optimizedStart = businessStartTime < dayStart ? dayStart : businessStartTime;
    const optimizedEnd = businessEndTime > dayEnd ? dayEnd : businessEndTime;

    const originalRange = dayEnd - dayStart;
    const optimizedRange = optimizedEnd - optimizedStart;
    const savingsPercent = Math.round((1 - optimizedRange / originalRange) * 100);

    return {
      startTime: optimizedStart,
      endTime: optimizedEnd,
      reason: 'business_hours_optimized',
      savings: savingsPercent
    };

  } catch (error) {
    console.error('查詢範圍優化失敗，使用原始全天範圍:', error);
    return {
      startTime: new Date(queryDateStr + 'T00:00:00+08:00'),
      endTime: new Date(queryDateStr + 'T23:59:59+08:00'),
      reason: 'optimization_failed',
      error: error.message
    };
  }
}

/**
 * 取得優化的批量查詢範圍
 * @param {string} startDateStr - 開始日期字串 (YYYY-MM-DD)
 * @param {string} endDateStr - 結束日期字串 (YYYY-MM-DD)
 * @returns {Object} - 優化的查詢範圍
 */
function getOptimizedQueryRangeBatch(startDateStr, endDateStr) {
  try {
    const startDate = new Date(startDateStr + 'T00:00:00+08:00');
    const endDate = new Date(endDateStr + 'T23:59:59+08:00');

    const businessHours = CALENDAR_CONFIG.businessHours;
    const [startHour, startMinute] = businessHours.start.split(':').map(Number);
    const [endHour, endMinute] = businessHours.end.split(':').map(Number);

    const batchStartTime = new Date(startDate);
    batchStartTime.setHours(startHour, startMinute, 0, 0);

    const batchEndTime = new Date(endDate);
    batchEndTime.setHours(endHour, endMinute, 0, 0);

    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const businessHoursPerDay = endHour - startHour;
    const totalBusinessHours = totalDays * businessHoursPerDay;
    const totalPossibleHours = totalDays * 24;
    const savings = Math.round((1 - totalBusinessHours / totalPossibleHours) * 100);

    return {
      startTime: batchStartTime,
      endTime: batchEndTime,
      reason: `批量查詢營業時間優化 (${totalDays}天)`,
      savings: savings
    };

  } catch (error) {
    console.error('批量查詢範圍優化失敗:', error);
    return {
      startTime: new Date(startDateStr + 'T00:00:00+08:00'),
      endTime: new Date(endDateStr + 'T23:59:59+08:00'),
      reason: '優化失敗，使用全天範圍',
      savings: 0
    };
  }
}
