/**
 * main.gs - 主入口模組
 * 美甲預約系統 - Google Apps Script
 *
 * 包含：doGet, doPost, handleRequest, 首頁API, 配置API
 */

// ==================== HTTP 請求入口 ====================

/**
 * 處理 GET 請求的主要函數
 * @param {Object} e - 請求事件物件
 * @returns {Object} - 回應結果
 */
function doGet(e) {
  return handleRequest(e);
}

/**
 * 處理 POST 請求的主要函數
 * @param {Object} e - 請求事件物件
 * @returns {Object} - 回應結果
 */
function doPost(e) {
  return handleRequest(e);
}

// ==================== 統一請求處理 ====================

/**
 * 共用的請求處理函數，支援 JSONP 和 CORS
 * @param {Object} e - 請求事件物件
 * @returns {Object} - 回應結果
 */
function handleRequest(e) {
  // 支援 JSONP 回調
  const callback = e.parameter.callback;

  try {
    let action, data;

    if (e.postData) {
      // POST 請求：從請求內容解析
      const requestData = JSON.parse(e.postData.contents);
      action = requestData.action;
      data = requestData;
    } else {
      // GET 請求：從參數取得
      action = e.parameter.action;
      data = e.parameter;

      // 修復 JSONP 陣列參數問題
      // 當使用 JSONP 時，陣列參數可能會被轉換為字串，需要重新解析
      if (action === 'checkTimeSlotAvailability' && data.timeSlots) {
        try {
          // 如果 timeSlots 是字串，嘗試解析為陣列
          if (typeof data.timeSlots === 'string') {
            data.timeSlots = JSON.parse(data.timeSlots);
            console.log('JSONP 陣列參數解析:', {
              original: e.parameter.timeSlots,
              parsed: data.timeSlots,
              isArray: Array.isArray(data.timeSlots)
            });
          }
        } catch (parseError) {
          console.error('解析 timeSlots 參數失敗:', parseError);
          // 如果解析失敗，保持原值
        }
      }
    }

    console.log('收到請求:', action, data);

    // ==================== CSRF Token 驗證 ====================

    // 定義需要 CSRF Token 保護的操作
    const csrfProtectedActions = ['saveCustomer', 'saveBooking', 'updateBookingStatus', 'deleteBooking'];

    if (csrfProtectedActions.includes(action)) {
      // 檢查是否包含 CSRF Token
      const csrfToken = data.csrfToken;

      if (!csrfToken) {
        console.warn('CSRF Token 缺失: ' + action);

        const errorResult = JSON.stringify({
          success: false,
          error: 'CSRF_TOKEN_MISSING',
          message: '安全驗證失敗：缺少 CSRF Token',
          timestamp: new Date().toISOString()
        });

        // 返回 CSRF 錯誤
        if (callback) {
          return ContentService
            .createTextOutput(callback + "(" + errorResult + ")")
            .setMimeType(ContentService.MimeType.JAVASCRIPT);
        } else {
          return ContentService
            .createTextOutput(errorResult)
            .setMimeType(ContentService.MimeType.JSON);
        }
      }

      // 驗證 CSRF Token 格式（基本檢查）
      // 注意：完整的 Token 驗證應該包括：
      // 1. Token 格式檢查（包含隨機值和時間戳記）
      // 2. Token 時效性檢查
      // 3. Token 使用次數限制（防止重放攻擊）

      // 基本格式驗證：檢查 Token 是否包含 "_" 分隔符
      if (!csrfToken.includes('_') || csrfToken.length < 20) {
        console.warn('CSRF Token 格式錯誤: ' + action, {
          tokenLength: csrfToken.length
        });

        const errorResult = JSON.stringify({
          success: false,
          error: 'CSRF_TOKEN_INVALID',
          message: '安全驗證失敗：CSRF Token 格式錯誤',
          timestamp: new Date().toISOString()
        });

        // 返回 CSRF 錯誤
        if (callback) {
          return ContentService
            .createTextOutput(callback + "(" + errorResult + ")")
            .setMimeType(ContentService.MimeType.JAVASCRIPT);
        } else {
          return ContentService
            .createTextOutput(errorResult)
            .setMimeType(ContentService.MimeType.JSON);
        }
      }

      // CSRF Token 驗證通過
      console.log('CSRF Token 驗證通過 - ' + action, {
        tokenLength: csrfToken.length
      });
    }

    // ==================== 處理請求 ====================

    let result;

    // 根據動作類型處理不同請求
    switch (action) {
      case 'ping':
        result = {
          success: true,
          message: 'API 連接正常 (Advanced Calendar API 已啟用)',
          advancedCalendarApi: ADVANCED_CALENDAR_CONFIG.enabled,
          timestamp: new Date().toISOString(),
          environment: 'Google Apps Script'
        };
        break;

      case 'saveCustomer':
        result = handleSaveCustomer(data.customer || data);
        break;

      case 'saveBooking':
        result = handleSaveBooking(data.booking || data);
        break;

      case 'getCustomer':
        result = handleGetCustomer(data.phone);
        break;

      case 'updateBookingStatus':
        result = handleUpdateBookingStatus(data.bookingId, data.status);
        break;

      case 'verifyCustomerByLineId':
        result = handleVerifyCustomerByLineId(data.lineUserId);
        break;

      case 'getCustomerByLineId':
        result = handleGetCustomerByLineId(data.lineUserId);
        break;

      case 'getCustomerBookings':
        result = handleGetCustomerBookings(data.lineUserId);
        break;

      case 'getCalendarConfig':
        result = handleGetCalendarConfig();
        break;

      case 'getAvailableTimeSlots':
        result = handleGetAvailableTimeSlots(data.date);
        break;

      case 'getBatchAvailableTimeSlots':
        result = handleGetBatchAvailableTimeSlots(data.startDate, data.endDate);
        break;

      case 'checkTimeSlotAvailability':
        result = handleCheckTimeSlotAvailability(data.date, data.timeSlots);
        break;

      case 'getGoogleCalendarCredentials':
        result = handleGetGoogleCalendarCredentials();
        break;

      case 'handleBatchCheckTimeSlotAvailability':
        result = handleBatchCheckTimeSlotAvailability(data.startDate, data.endDate);
        break;

      case 'getSystemCalendarInfo':
        result = handleGetSystemCalendarInfo();
        break;

      case 'getHomepageData':
        result = handleGetHomepageData(data);
        break;

      // ==================== 後台管理 API ====================

      case 'updateAdminSettings':
        result = handleUpdateAdminSettings(data);
        break;

      case 'getAdminSettings':
        result = handleGetAdminSettings(data);
        break;

      default:
        if (!action) {
          result = {
            success: false,
            error: 'No action specified',
            message: '美甲預約系統 API - 請指定動作類型',
            timestamp: new Date().toISOString()
          };
        } else {
          result = {
            success: false,
            error: 'Unknown action',
            message: '未知的動作類型: ' + action,
            timestamp: new Date().toISOString()
          };
        }
    }

    // 準備回應
    const jsonResult = JSON.stringify(result);

    // 如果有回調名稱，使用 JSONP 格式回應
    if (callback) {
      return ContentService
        .createTextOutput(callback + "(" + jsonResult + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService
        .createTextOutput(jsonResult)
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    console.error('處理請求時發生錯誤:', error);

    const errorResult = JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    // 如果有回調名稱，使用 JSONP 格式回應
    if (callback) {
      return ContentService
        .createTextOutput(callback + "(" + errorResult + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService
        .createTextOutput(errorResult)
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
}

// ==================== 首頁專用 API ====================

/**
 * 首頁專用 API - 一次取得所有必要資料
 * 優化效能：減少多次 API 呼叫
 * @param {Object} data - 請求資料
 * @returns {Object} - 首頁所需的所有資料
 */
function handleGetHomepageData(data) {
  const performanceStart = Date.now();
  Logger.api('首頁專用API調用開始', {
    lineUserId: data.lineUserId ? data.lineUserId.substring(0, 8) + '...' : 'none',
    includeTimeSlots: data.includeTimeSlots,
    timeSlotDate: data.timeSlotDate
  }, 'homepage');

  try {
    // 參數驗證
    if (!data || typeof data !== 'object') {
      throw new Error('缺少請求參數');
    }

    if (!data.lineUserId) {
      throw new Error('缺少 LINE User ID 參數');
    }

    // 第一步：使用快取取得所有系統配置（避免重複的PropertiesService調用）
    const configStartTime = Date.now();
    const config = getCachedConfig();
    Logger.performance('配置載入完成', configStartTime, 'homepage');

    // 第二步：驗證客戶身份（使用已優化的索引查詢）
    const customerStartTime = Date.now();
    const customerStatus = handleVerifyCustomerByLineId(data.lineUserId);
    Logger.performance('客戶驗證完成', customerStartTime, 'homepage');

    // 第三步：準備首頁所需的最小配置資料（精簡版）
    const homepageConfig = {
      // 基本系統配置
      timezone: SYSTEM_CONFIG.TIMEZONE,
      businessHours: CALENDAR_CONFIG.businessHours,
      defaultDuration: CALENDAR_CONFIG.defaultDuration,

      // 功能開關狀態
      hasCalendarAccess: config.hasCalendarAccess(),
      hasApiKey: config.hasApiKey(),
      hasLineIntegration: config.hasLineIntegration(),

      // 簡化的驗證規則（避免複雜物件序列化）
      timeFormatRegex: SYSTEM_CONFIG.TIME_FORMAT_REGEX.source,
      bookingAdvanceHours: 3,

      // API版本資訊
      apiVersion: '2.0.0',
      optimization: 'homepage_lightweight_api'
    };

    // 第四步：根據客戶狀態決定回傳的資料
    var responseData = {
      success: true,
      config: homepageConfig,
      customer: customerStatus,
      timestamp: Date.now() // 使用數字格式減少序列化時間
    };

    // 第五步：如果客戶已建檔且系統配置完整，提供Google Calendar憑證
    if (customerStatus && customerStatus.success && customerStatus.exists && config.hasApiKey() && config.hasCalendarAccess()) {
      responseData.credentials = {
        apiKey: config.apiKey,
        calendarId: config.calendarId,
        timeSlotsCalendarId: config.timeSlotsCalendarId || config.calendarId,
        ready: true
      };
      Logger.debug('已提供Calendar憑證給已建檔客戶', null, 'homepage');
    } else {
      responseData.credentials = {
        ready: false,
        reason: (!customerStatus || !customerStatus.exists) ? 'customer_not_registered' : 'config_incomplete'
      };
      Logger.debug('未提供Calendar憑證', { reason: responseData.credentials.reason }, 'homepage');
    }

    // 第六步：可選的當日時段資料（如果明確要求且客戶已建檔）
    var timeSlotsStartTime;
    if (data.includeTimeSlots && data.timeSlotDate && customerStatus && customerStatus.exists) {
      timeSlotsStartTime = Date.now();
      try {
        Logger.debug('載入當日時段資料', { date: data.timeSlotDate }, 'homepage');
        const timeSlots = handleGetAvailableTimeSlots(data.timeSlotDate);
        responseData.timeSlots = {
          date: data.timeSlotDate,
          slots: timeSlots.success ? timeSlots.availableSlots : [],
          totalCount: timeSlots.success ? timeSlots.totalSlots : 0,
          loaded: timeSlots.success
        };
        Logger.performance('時段資料載入完成', timeSlotsStartTime, 'homepage');
      } catch (timeSlotsError) {
        Logger.warn('時段查詢失敗，但不影響主要功能', timeSlotsError, 'homepage');
        responseData.timeSlots = {
          date: data.timeSlotDate,
          slots: [],
          totalCount: 0,
          loaded: false,
          error: timeSlotsError.message
        };
      }
    }

    // 第七步：計算效能統計
    const totalProcessingTime = Date.now() - performanceStart;

    // 開發環境或明確要求時提供詳細效能資訊
    if (data.includeDebugInfo || LOG_CONFIG.level === 'DEBUG') {
      responseData.debug = {
        processingTime: totalProcessingTime,
        breakdown: {
          config: Date.now() - configStartTime,
          customer: Date.now() - customerStartTime,
          timeSlots: data.includeTimeSlots ? (Date.now() - (timeSlotsStartTime || Date.now())) : 0
        },
        optimization: {
          apiCallsAvoided: data.includeTimeSlots ? 4 : 3,
          estimatedSavingsRange: data.includeTimeSlots ? '600-900ms' : '400-700ms',
          cacheHits: {
            config: !!PROPERTIES_CONFIG_CACHE,
            customer: !!customerIndexMap,
            spreadsheet: !!SPREADSHEET_CACHE
          }
        },
        system: {
          customerScale: '250人美甲店',
          targetLoadTime: '<2秒'
        }
      };
    }

    Logger.performance('首頁API處理完成', performanceStart, 'homepage');
    Logger.log('首頁API成功：客戶' + (customerStatus && customerStatus.exists ? '已建檔' : '未建檔') + '，耗時' + totalProcessingTime + 'ms', null, 'homepage');

    return responseData;

  } catch (error) {
    const errorProcessingTime = Date.now() - performanceStart;
    Logger.error('首頁API處理失敗', error, 'homepage');

    return {
      success: false,
      error: error.message,
      message: '首頁資料載入失敗，請重新整理頁面',
      timestamp: Date.now(),
      debug: data.includeDebugInfo ? {
        processingTime: errorProcessingTime,
        errorType: error.name || 'Unknown'
      } : undefined
    };
  }
}

// ==================== 配置 API ====================

/**
 * 處理取得日曆配置請求
 * @returns {Object} - 配置資料
 */
function handleGetCalendarConfig() {
  try {
    console.log('處理日曆配置請求');

    // 使用快取的配置，避免重複讀取PropertiesService
    const cachedConfig = getCachedConfig();
    const calendarId = cachedConfig.calendarId;

    // 準備安全的配置回應（移除敏感資訊）
    const config = {
      // 基本配置
      timezone: SYSTEM_CONFIG.TIMEZONE,
      businessHours: CALENDAR_CONFIG.businessHours,
      defaultDuration: CALENDAR_CONFIG.defaultDuration,

      // 時間驗證規則
      timeFormatRegex: SYSTEM_CONFIG.TIME_FORMAT_REGEX.source, // 轉為字串格式
      bookingAdvanceHours: 3, // 預約需提前的小時數

      // 功能開關
      notificationEnabled: NOTIFICATION_CONFIG.enabled,
      lineMessagingEnabled: LINE_CONFIG.enabled,

      // 系統資訊
      hasCalendarAccess: !!calendarId, // 不暴露實際 ID，只回傳是否有設定
      apiVersion: '1.0.0',
      lastUpdated: new Date().toISOString()
    };

    console.log('日曆配置回應已準備:', Object.keys(config));

    return {
      success: true,
      config: config,
      message: '日曆配置取得成功',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('取得日曆配置時發生錯誤:', error);
    return {
      success: false,
      error: error.message,
      message: '取得日曆配置失敗',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 處理取得系統日曆資訊請求
 * 用於確認當前系統使用的日曆ID配置
 * @returns {Object} - 系統日曆資訊
 */
function handleGetSystemCalendarInfo() {
  try {
    console.log('處理系統日曆資訊請求');

    // 使用快取的配置，避免重複讀取PropertiesService
    const cachedConfig = getCachedConfig();
    const timeSlotsCalendarId = cachedConfig.timeSlotsCalendarId;
    const bookingCalendarId = cachedConfig.calendarId;

    // 準備日曆資訊回應
    const calendarInfo = {
      // 日曆ID配置
      timeSlotsCalendarId: timeSlotsCalendarId,
      bookingCalendarId: bookingCalendarId,

      // 配置狀態
      hasTimeSlotsCalendar: !!timeSlotsCalendarId,
      hasBookingCalendar: !!bookingCalendarId,

      // 系統邏輯說明
      logic: {
        timeSlotGeneration: 'GOOGLE_TIMESLOTS_CALENDAR_ID 用於掃描可預約時段',
        conflictCheck: 'GOOGLE_CALENDAR_ID 用於檢查預約衝突',
        bookingStorage: 'GOOGLE_CALENDAR_ID 用於儲存新預約'
      },

      // 檢查結果
      configurationComplete: !!timeSlotsCalendarId && !!bookingCalendarId,

      // 系統資訊
      timestamp: new Date().toISOString(),
      source: 'Google Apps Script Properties'
    };

    console.log('系統日曆資訊已準備:', {
      hasTimeSlotsCalendar: calendarInfo.hasTimeSlotsCalendar,
      hasBookingCalendar: calendarInfo.hasBookingCalendar,
      configurationComplete: calendarInfo.configurationComplete
    });

    return {
      success: true,
      calendarInfo: calendarInfo,
      message: '系統日曆資訊取得成功',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('取得系統日曆資訊時發生錯誤:', error);
    return {
      success: false,
      error: error.message,
      message: '取得系統日曆資訊失敗',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 處理取得 Google Calendar 憑證請求
 * 注意：此函數回傳敏感資訊，僅供前端使用
 * @returns {Object} - Google Calendar 憑證和配置
 */
function handleGetGoogleCalendarCredentials() {
  try {
    console.log('處理 Google Calendar 憑證請求');

    // 使用快取的配置，避免重複讀取PropertiesService
    const cachedConfig = getCachedConfig();
    const apiKey = cachedConfig.apiKey;
    const calendarId = cachedConfig.calendarId;
    const timeSlotsCalendarId = cachedConfig.timeSlotsCalendarId;

    // 檢查必要的憑證是否存在
    if (!apiKey) {
      return {
        success: false,
        error: '未設定 Google API Key',
        message: '請在指令碼屬性中設定 CALENDAR_API_KEY',
        timestamp: new Date().toISOString()
      };
    }

    if (!calendarId) {
      return {
        success: false,
        error: '未設定 Google Calendar ID',
        message: '請在指令碼屬性中設定 GOOGLE_CALENDAR_ID',
        timestamp: new Date().toISOString()
      };
    }

    // 準備憑證回應
    const credentials = {
      // Google Calendar API 憑證
      apiKey: apiKey,
      calendarId: calendarId,
      timeSlotsCalendarId: timeSlotsCalendarId || calendarId, // 如果沒有時段日曆，使用預約日曆

      // 基本配置
      timezone: SYSTEM_CONFIG.TIMEZONE,
      businessHours: CALENDAR_CONFIG.businessHours,
      defaultDuration: CALENDAR_CONFIG.defaultDuration,

      // 時間驗證規則
      timeFormatRegex: SYSTEM_CONFIG.TIME_FORMAT_REGEX.source,
      bookingAdvanceHours: 3,

      // 功能開關
      notificationEnabled: NOTIFICATION_CONFIG.enabled,
      lineMessagingEnabled: LINE_CONFIG.enabled,

      // 系統資訊
      apiVersion: '1.0.0',
      lastUpdated: new Date().toISOString()
    };

    console.log('Google Calendar 憑證回應已準備（包含敏感資訊）');

    return {
      success: true,
      credentials: credentials,
      message: 'Google Calendar 憑證取得成功',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('取得 Google Calendar 憑證時發生錯誤:', error);
    return {
      success: false,
      error: error.message,
      message: '取得 Google Calendar 憑證失敗',
      timestamp: new Date().toISOString()
    };
  }
}
