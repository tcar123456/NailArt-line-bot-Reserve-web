/**
 * config.gs - 系統配置模組
 * 美甲預約系統 - Google Apps Script
 *
 * 包含：所有系統常數、配置物件、快取設定
 */

// ==================== 工作表名稱常數 ====================
const CUSTOMER_SHEET_NAME = '客戶資料';
const BOOKING_SHEET_NAME = '預約記錄';

// ==================== 系統設定常數 ====================
const SYSTEM_CONFIG = {
  // 手機號碼驗證規則
  PHONE_REGEX: /^09\d{8}$|^\d{10}$/,

  // 快取設定
  CACHE_DURATION: 5 * 60 * 1000, // 5分鐘

  // 時區設定
  TIMEZONE: 'Asia/Taipei',

  // 時間格式驗證（支援動態時段）
  TIME_FORMAT_REGEX: /^([01]?\d|2[0-3]):[0-5]\d$/
};

// ==================== Advanced Calendar API 配置 ====================
const ADVANCED_CALENDAR_CONFIG = {
  // 啟用 Advanced Calendar API
  enabled: true,

  // API 版本
  version: 'v3',

  // 查詢選項
  queryOptions: {
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 2500
  },

  // 效能優化選項
  performance: {
    enableBatchRequests: true,
    parallelQueries: true,
    cacheResults: false
  },

  // 智慧分頁配置
  smartPagination: {
    enabled: true,
    pageSize: {
      base: 100,
      min: 50,
      max: 300,
      adaptive: true
    },
    performance: {
      targetResponseTime: 2000,
      adjustmentFactor: 0.8,
      monitoringEnabled: true
    },
    estimation: {
      dailyEventsAverage: 15,
      bufferMultiplier: 1.2,
      maxEstimationDays: 90
    },
    retry: {
      maxAttempts: 3,
      backoffMultiplier: 1.5,
      initialDelay: 1000
    }
  }
};

// ==================== Google 日曆設定 ====================
const CALENDAR_CONFIG = {
  // 從快取讀取預約日曆ID
  get calendarId() {
    const calendarId = getConfigValue('GOOGLE_CALENDAR_ID');
    if (!calendarId) {
      throw new Error('請在專案設定中設定 GOOGLE_CALENDAR_ID 指令碼屬性');
    }
    return calendarId;
  },

  // 從快取讀取時段日曆ID
  get timeSlotsCalendarId() {
    const calendarId = getConfigValue('GOOGLE_TIMESLOTS_CALENDAR_ID');
    if (!calendarId) {
      return this.calendarId;
    }
    return calendarId;
  },

  // 預設服務時長（小時）
  defaultDuration: 1,

  // 營業時間配置
  businessHours: {
    start: '08:00',
    end: '22:00'
  },

  // 查詢範圍優化設定
  optimization: {
    enableBusinessHoursFilter: true
  }
};

// ==================== 通知設定 ====================
const NOTIFICATION_CONFIG = {
  // 是否啟用通知
  enabled: true,

  // 從快取讀取通知接收者Email
  get recipientEmail() {
    const email = getConfigValue('NOTIFICATION_EMAIL');
    if (!email) {
      throw new Error('請在專案設定中設定 NOTIFICATION_EMAIL 指令碼屬性');
    }
    return email;
  },

  // 通知寄件者名稱
  senderName: '美甲預約系統'
};

// ==================== LINE Bot 設定 ====================
const LINE_CONFIG = {
  // LINE Bot Channel Access Token - 從快取讀取
  get channelAccessToken() {
    return getConfigValue('LINE_CHANNEL_ACCESS_TOKEN');
  },

  // LINE Messaging API URL
  messagingApiUrl: 'https://api.line.me/v2/bot/message/push',

  // 是否啟用 LINE 訊息發送
  enabled: true
};

// ==================== 日誌配置 ====================
const LOG_CONFIG = {
  // 日誌等級設定
  level: 'PRODUCTION', // 'DEBUG', 'PRODUCTION', 'SILENT'

  // 效能監控開關
  enablePerformanceLog: false,
  enableDetailedLog: false,
  enableApiLog: true,

  // 分類過濾器
  categories: {
    auth: false,
    booking: true,
    calendar: false,
    cache: false,
    error: true
  }
};

// ==================== 快取時間常數 ====================
const CONFIG_CACHE_DURATION = 5 * 60 * 1000; // 5分鐘
const SPREADSHEET_CACHE_DURATION = 60 * 1000; // 1分鐘
