/**
 * cacheService.gs - 快取服務模組
 * 美甲預約系統 - Google Apps Script
 *
 * 包含：配置快取、試算表快取、客戶索引快取、預約索引快取
 */

// ==================== 快取變數宣告 ====================

// PropertiesService 配置快取
let PROPERTIES_CONFIG_CACHE = null;
let CONFIG_CACHE_TIMESTAMP = null;

// 試算表快取
let SPREADSHEET_CACHE = null;
let SPREADSHEET_CACHE_TIME = null;

// 客戶資料快取
let customerDataCache = null;
let cacheTimestamp = null;

// 客戶索引快取
let customerIndexMap = null;
let indexCacheTime = null;

// 預約記錄索引快取
let bookingIndexMap = null;
let bookingCacheTime = null;

// 快取效能監控
let CACHE_STATS = {
  hits: 0,
  misses: 0,
  totalReads: 0,
  lastUpdate: null,
  errors: 0
};

// ==================== PropertiesService 配置快取 ====================

/**
 * 取得快取的系統配置
 * @returns {Object} - 系統配置物件
 */
function getCachedConfig() {
  const now = Date.now();
  CACHE_STATS.totalReads++;

  if (PROPERTIES_CONFIG_CACHE &&
      CONFIG_CACHE_TIMESTAMP &&
      (now - CONFIG_CACHE_TIMESTAMP < CONFIG_CACHE_DURATION)) {
    CACHE_STATS.hits++;
    Logger.debug('使用快取的系統配置', null, 'cache');
    return PROPERTIES_CONFIG_CACHE;
  }

  CACHE_STATS.misses++;
  const configStartTime = Date.now();
  Logger.debug('重新讀取系統配置（快取過期）', null, 'cache');

  try {
    const properties = PropertiesService.getScriptProperties();

    PROPERTIES_CONFIG_CACHE = {
      apiKey: properties.getProperty('CALENDAR_API_KEY'),
      calendarId: properties.getProperty('GOOGLE_CALENDAR_ID'),
      timeSlotsCalendarId: properties.getProperty('GOOGLE_TIMESLOTS_CALENDAR_ID'),
      notificationEmail: properties.getProperty('NOTIFICATION_EMAIL'),
      lineToken: properties.getProperty('LINE_CHANNEL_ACCESS_TOKEN'),

      hasApiKey: function() { return !!this.apiKey && this.apiKey !== 'YOUR_GOOGLE_CALENDAR_API_KEY'; },
      hasCalendarAccess: function() { return !!this.calendarId && this.calendarId !== 'YOUR_CALENDAR_ID@gmail.com'; },
      hasLineIntegration: function() { return !!this.lineToken; },

      cacheInfo: {
        timestamp: now,
        expiresAt: now + CONFIG_CACHE_DURATION,
        source: 'PropertiesService'
      }
    };

    CONFIG_CACHE_TIMESTAMP = now;
    CACHE_STATS.lastUpdate = now;

    Logger.performance('系統配置快取重建完成', configStartTime, 'cache');
    return PROPERTIES_CONFIG_CACHE;

  } catch (error) {
    CACHE_STATS.errors++;
    Logger.error('讀取系統配置失敗', error, 'cache');

    return {
      apiKey: null,
      calendarId: null,
      timeSlotsCalendarId: null,
      notificationEmail: null,
      lineToken: null,
      hasApiKey: function() { return false; },
      hasCalendarAccess: function() { return false; },
      hasLineIntegration: function() { return false; },
      cacheInfo: { timestamp: now, error: error.message, source: 'PropertiesService' }
    };
  }
}

/**
 * 清理配置快取
 */
function clearConfigCache() {
  Logger.log('清理系統配置快取', null, 'cache');
  PROPERTIES_CONFIG_CACHE = null;
  CONFIG_CACHE_TIMESTAMP = null;
  CACHE_STATS.hits = 0;
  CACHE_STATS.misses = 0;
  CACHE_STATS.totalReads = 0;
  CACHE_STATS.lastUpdate = Date.now();
}

/**
 * 取得快取效能統計
 * @returns {Object} - 快取統計資訊
 */
function getConfigCacheStats() {
  const hitRate = CACHE_STATS.totalReads > 0 ?
    Math.round((CACHE_STATS.hits / CACHE_STATS.totalReads) * 100) : 0;

  return {
    performance: {
      hitRate: `${hitRate}%`,
      hits: CACHE_STATS.hits,
      misses: CACHE_STATS.misses,
      totalReads: CACHE_STATS.totalReads,
      errors: CACHE_STATS.errors
    },
    cache: {
      isActive: !!PROPERTIES_CONFIG_CACHE,
      lastUpdate: CACHE_STATS.lastUpdate ? new Date(CACHE_STATS.lastUpdate).toLocaleString('zh-TW') : '未建立',
      expiresAt: CONFIG_CACHE_TIMESTAMP ? new Date(CONFIG_CACHE_TIMESTAMP + CONFIG_CACHE_DURATION).toLocaleString('zh-TW') : '未建立'
    }
  };
}

/**
 * 安全的配置存取介面
 * @param {string} configKey - 配置鍵值
 * @param {*} defaultValue - 預設值
 * @returns {*} - 配置值
 */
function getConfigValue(configKey, defaultValue = null) {
  try {
    const config = getCachedConfig();

    const keyMapping = {
      'CALENDAR_API_KEY': 'apiKey',
      'GOOGLE_CALENDAR_ID': 'calendarId',
      'GOOGLE_TIMESLOTS_CALENDAR_ID': 'timeSlotsCalendarId',
      'NOTIFICATION_EMAIL': 'notificationEmail',
      'LINE_CHANNEL_ACCESS_TOKEN': 'lineToken'
    };

    const mappedKey = keyMapping[configKey] || configKey;
    const value = config[mappedKey];

    return value !== null && value !== undefined ? value : defaultValue;

  } catch (error) {
    Logger.error(`取得配置 ${configKey} 失敗`, error, 'cache');
    return defaultValue;
  }
}

/**
 * 批次更新配置
 * @param {Object} configUpdates - 配置更新物件
 * @returns {boolean} - 更新是否成功
 */
function updateConfigurations(configUpdates) {
  try {
    Logger.log('批次更新系統配置', { keys: Object.keys(configUpdates) }, 'cache');

    const properties = PropertiesService.getScriptProperties();
    properties.setProperties(configUpdates);

    clearConfigCache();

    Logger.log('系統配置更新成功', null, 'cache');
    return true;

  } catch (error) {
    Logger.error('系統配置更新失敗', error, 'cache');
    return false;
  }
}

// ==================== 試算表快取 ====================

/**
 * 取得快取的試算表實例
 * @returns {Spreadsheet} - Google Sheets試算表物件
 */
function getCachedSpreadsheet() {
  const now = Date.now();

  if (SPREADSHEET_CACHE &&
      SPREADSHEET_CACHE_TIME &&
      (now - SPREADSHEET_CACHE_TIME < SPREADSHEET_CACHE_DURATION)) {
    Logger.debug('使用快取的試算表實例', null, 'cache');
    return SPREADSHEET_CACHE;
  }

  Logger.debug('重新取得試算表實例', null, 'cache');
  const spreadsheetStartTime = Date.now();

  SPREADSHEET_CACHE = SpreadsheetApp.getActiveSpreadsheet();
  SPREADSHEET_CACHE_TIME = now;

  Logger.performance('試算表快取重建完成', spreadsheetStartTime, 'cache');
  return SPREADSHEET_CACHE;
}

/**
 * 清理試算表快取
 */
function clearSpreadsheetCache() {
  Logger.log('清理試算表快取', null, 'cache');
  SPREADSHEET_CACHE = null;
  SPREADSHEET_CACHE_TIME = null;
}

// ==================== 客戶資料快取 ====================

/**
 * 取得客戶資料（含快取機制）
 * @returns {Array} - 客戶資料陣列
 */
function getCachedCustomerData() {
  const now = new Date().getTime();

  if (customerDataCache && cacheTimestamp && (now - cacheTimestamp < SYSTEM_CONFIG.CACHE_DURATION)) {
    console.log('使用快取的客戶資料');
    return customerDataCache;
  }

  console.log('重新讀取客戶資料');
  const sheet = getSheet(CUSTOMER_SHEET_NAME);
  customerDataCache = sheet.getDataRange().getValues();
  cacheTimestamp = now;

  return customerDataCache;
}

/**
 * 清除客戶資料快取
 */
function clearCustomerCache() {
  console.log('清理客戶快取（觸發索引重建）');
  customerDataCache = null;
  cacheTimestamp = null;
  customerIndexMap = null;
  indexCacheTime = null;
}

// ==================== 客戶索引快取 ====================

/**
 * 建立客戶索引
 */
function buildCustomerIndex() {
  const indexStartTime = Date.now();
  Logger.debug('建立客戶索引（適用於250人規模）', null, 'cache');

  const sheet = getSheet(CUSTOMER_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const indexMap = new Map();

  for (let i = 1; i < data.length; i++) {
    const lineUserId = data[i][0];
    const phone = data[i][2];

    if (lineUserId) {
      indexMap.set(lineUserId.toString().trim(), {
        rowIndex: i + 1,
        customerData: {
          lineUserId: data[i][0],
          name: data[i][1],
          phone: data[i][2],
          createdAt: data[i][3],
          lastBooking: data[i][4],
          totalBookings: data[i][5]
        }
      });
    }

    if (phone) {
      indexMap.set(`phone_${phone.toString().trim()}`, {
        rowIndex: i + 1,
        customerData: {
          lineUserId: data[i][0],
          name: data[i][1],
          phone: data[i][2],
          createdAt: data[i][3],
          lastBooking: data[i][4],
          totalBookings: data[i][5]
        }
      });
    }
  }

  customerIndexMap = indexMap;
  indexCacheTime = Date.now();

  Logger.performance('客戶索引建立完成', indexStartTime, 'cache');
  return indexMap;
}

/**
 * 根據 LINE User ID 尋找客戶
 * @param {string} lineUserId - LINE User ID
 * @returns {number} - 客戶所在的行號，不存在則返回 -1
 */
function findCustomerByLineUserId(lineUserId) {
  if (!lineUserId) return -1;

  const now = Date.now();

  if (!customerIndexMap ||
      !indexCacheTime ||
      (now - indexCacheTime > SYSTEM_CONFIG.CACHE_DURATION)) {
    buildCustomerIndex();
  }

  const result = customerIndexMap.get(lineUserId.toString().trim());
  return result ? result.rowIndex : -1;
}

/**
 * 根據手機號碼尋找客戶
 * @param {string} phone - 手機號碼
 * @returns {number} - 客戶所在的行號，不存在則返回 -1
 */
function findCustomerByPhone(phone) {
  if (!phone) return -1;

  const now = Date.now();

  if (!customerIndexMap ||
      !indexCacheTime ||
      (now - indexCacheTime > SYSTEM_CONFIG.CACHE_DURATION)) {
    buildCustomerIndex();
  }

  const phoneKey = `phone_${phone.toString().trim()}`;
  const result = customerIndexMap.get(phoneKey);
  return result ? result.rowIndex : -1;
}

// ==================== 預約記錄索引快取 ====================

/**
 * 建立預約記錄索引（支援多年度工作表）
 */
function buildBookingIndex() {
  console.log('建立預約記錄索引（支援多年度工作表）...');

  const indexMap = new Map();
  let totalRecords = 0;

  // 取得所有年度預約工作表
  const bookingSheetNames = getAllBookingSheetNames();
  console.log('找到的預約工作表:', bookingSheetNames);

  // 從每個年度工作表讀取資料
  for (const sheetName of bookingSheetNames) {
    try {
      const bookingSheet = getSheet(sheetName);
      const data = bookingSheet.getDataRange().getValues();

      console.log(`讀取工作表 ${sheetName}，共 ${data.length - 1} 筆記錄`);

      for (let i = 1; i < data.length; i++) {
        const lineUserId = data[i][0];

        if (lineUserId) {
          if (!indexMap.has(lineUserId)) {
            indexMap.set(lineUserId, []);
          }

          const booking = {
            lineUserId: data[i][0],
            customerName: data[i][1],
            phone: data[i][2],
            date: data[i][3],
            time: data[i][4],
            services: data[i][5] || '',
            removal: data[i][6] || '',
            quantity: data[i][7] || '',
            remarks: data[i][8] || '',
            createdAt: data[i][9],
            eventId: data[i][10] || '',
            sheetName: sheetName  // 記錄來源工作表
          };

          if (booking.date instanceof Date) {
            booking.date = Utilities.formatDate(
              booking.date,
              SYSTEM_CONFIG.TIMEZONE || 'Asia/Taipei',
              'yyyy-MM-dd'
            );
          }

          indexMap.get(lineUserId).push(booking);
          totalRecords++;
        }
      }
    } catch (error) {
      console.error(`讀取工作表 ${sheetName} 時發生錯誤:`, error);
    }
  }

  bookingIndexMap = indexMap;
  bookingCacheTime = Date.now();

  console.log(`預約記錄索引建立完成，共 ${totalRecords} 筆記錄，覆蓋 ${indexMap.size} 位客戶`);
  return indexMap;
}

/**
 * 清理預約記錄快取
 */
function clearBookingCache() {
  console.log('清理預約記錄快取');
  bookingIndexMap = null;
  bookingCacheTime = null;
}

/**
 * 取得客戶的預約記錄（從索引）
 * @param {string} lineUserId - LINE User ID
 * @returns {Array} - 預約記錄陣列
 */
function getBookingsFromIndex(lineUserId) {
  const now = Date.now();

  if (!bookingIndexMap ||
      !bookingCacheTime ||
      (now - bookingCacheTime > SYSTEM_CONFIG.CACHE_DURATION)) {
    buildBookingIndex();
  }

  return bookingIndexMap.get(lineUserId) || [];
}

// ==================== 系統監控工具 ====================

/**
 * 取得系統配置優化報告
 * @returns {Object} - 優化報告
 */
function getPropertiesOptimizationReport() {
  console.log('=== PropertiesService 優化狀態報告 ===');

  const report = {
    cacheStatus: getConfigCacheStats(),
    currentConfig: {},
    systemHealth: {},
    recommendations: []
  };

  try {
    const config = getCachedConfig();
    report.currentConfig = {
      hasApiKey: config.hasApiKey(),
      hasCalendarAccess: config.hasCalendarAccess(),
      hasLineIntegration: config.hasLineIntegration(),
      cacheActive: !!config.cacheInfo,
      lastUpdate: config.cacheInfo?.timestamp ? new Date(config.cacheInfo.timestamp).toLocaleString('zh-TW') : '未知'
    };
  } catch (error) {
    report.currentConfig = { error: error.message };
  }

  report.systemHealth = {
    configurationComplete: report.currentConfig.hasApiKey && report.currentConfig.hasCalendarAccess,
    cacheEffective: parseInt(report.cacheStatus.performance.hitRate) > 70,
    errorFree: report.cacheStatus.performance.errors === 0
  };

  const healthChecks = Object.values(report.systemHealth).filter(v => typeof v === 'boolean');
  const passedChecks = healthChecks.filter(v => v === true).length;
  const healthPercentage = Math.round((passedChecks / healthChecks.length) * 100);

  if (healthPercentage >= 80) {
    report.systemHealth.overallScore = `優秀 (${healthPercentage}%)`;
  } else if (healthPercentage >= 60) {
    report.systemHealth.overallScore = `良好 (${healthPercentage}%)`;
  } else {
    report.systemHealth.overallScore = `需要改善 (${healthPercentage}%)`;
  }

  console.log('=== 報告完成 ===');
  return report;
}
