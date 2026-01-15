/**
 * logger.gs - 日誌管理模組
 * 美甲預約系統 - Google Apps Script
 *
 * 包含：日誌分級管理、效能監控、日誌配置工具
 */

/**
 * 優化版日誌管理器
 * 取代所有 console.log，提供分級和分類控制
 */
class OptimizedLogger {
  static log(message, data = null, category = 'general') {
    if (LOG_CONFIG.level === 'SILENT') return;
    if (LOG_CONFIG.categories[category] === false) return;
    if (LOG_CONFIG.level === 'PRODUCTION' && category === 'debug') return;

    if (data) {
      console.log(`[${category.toUpperCase()}] ${message}`, data);
    } else {
      console.log(`[${category.toUpperCase()}] ${message}`);
    }
  }

  static error(message, error = null, category = 'error') {
    if (LOG_CONFIG.level === 'SILENT') return;

    if (error) {
      console.error(`[ERROR-${category.toUpperCase()}] ${message}`, error);
    } else {
      console.error(`[ERROR-${category.toUpperCase()}] ${message}`);
    }
  }

  static warn(message, data = null, category = 'warning') {
    if (LOG_CONFIG.level === 'SILENT') return;

    if (data) {
      console.warn(`[WARN-${category.toUpperCase()}] ${message}`, data);
    } else {
      console.warn(`[WARN-${category.toUpperCase()}] ${message}`);
    }
  }

  static debug(message, data = null, category = 'debug') {
    if (LOG_CONFIG.level !== 'DEBUG') return;

    if (data) {
      console.log(`[DEBUG-${category.toUpperCase()}] ${message}`, data);
    } else {
      console.log(`[DEBUG-${category.toUpperCase()}] ${message}`);
    }
  }

  static performance(message, startTime, category = 'performance') {
    if (!LOG_CONFIG.enablePerformanceLog) return;
    if (LOG_CONFIG.level === 'SILENT') return;

    const duration = Date.now() - startTime;
    console.log(`[PERF-${category.toUpperCase()}] ${message}: ${duration}ms`);
  }

  static api(message, data = null, category = 'api') {
    if (!LOG_CONFIG.enableApiLog) return;
    if (LOG_CONFIG.level === 'SILENT') return;

    if (data) {
      console.log(`[API-${category.toUpperCase()}] ${message}`, data);
    } else {
      console.log(`[API-${category.toUpperCase()}] ${message}`);
    }
  }

  static setLevel(level) {
    LOG_CONFIG.level = level;
    this.log(`日誌等級已調整為: ${level}`, null, 'system');
  }

  static enableCategory(category, enabled = true) {
    LOG_CONFIG.categories[category] = enabled;
    this.log(`日誌分類 ${category} 已${enabled ? '啟用' : '停用'}`, null, 'system');
  }

  static getConfig() {
    return {
      level: LOG_CONFIG.level,
      categories: LOG_CONFIG.categories,
      estimatedSavedTime: this.calculateSavedTime()
    };
  }

  static calculateSavedTime() {
    const totalLogCount = 130;
    const avgLogTime = 3;

    let enabledLogs = 0;
    if (LOG_CONFIG.level === 'DEBUG') enabledLogs = totalLogCount;
    else if (LOG_CONFIG.level === 'PRODUCTION') enabledLogs = totalLogCount * 0.3;
    else enabledLogs = totalLogCount * 0.1;

    const savedTime = (totalLogCount - enabledLogs) * avgLogTime;
    return Math.round(savedTime);
  }
}

// 建立全域別名
const Logger = OptimizedLogger;

// ==================== 日誌管理工具函數 ====================

/**
 * 動態調整日誌等級
 * @param {string} level - 'DEBUG', 'PRODUCTION', 'SILENT'
 */
function setLogLevel(level) {
  if (!['DEBUG', 'PRODUCTION', 'SILENT'].includes(level)) {
    Logger.error('無效的日誌等級', { provided: level, valid: ['DEBUG', 'PRODUCTION', 'SILENT'] }, 'system');
    return false;
  }

  OptimizedLogger.setLevel(level);
  Logger.log(`日誌等級已調整為: ${level}`, {
    estimatedSavedTime: OptimizedLogger.calculateSavedTime(),
    newLevel: level
  }, 'system');

  return true;
}

/**
 * 啟用/停用特定功能的日誌
 * @param {string} category - 日誌分類
 * @param {boolean} enabled - 是否啟用
 */
function toggleLogCategory(category, enabled) {
  if (!LOG_CONFIG.categories.hasOwnProperty(category)) {
    Logger.error('無效的日誌分類', { provided: category, valid: Object.keys(LOG_CONFIG.categories) }, 'system');
    return false;
  }

  OptimizedLogger.enableCategory(category, enabled);
  return true;
}

/**
 * 美甲店生產環境最佳配置
 */
function setNailArtProductionOptimal() {
  LOG_CONFIG.level = 'PRODUCTION';
  LOG_CONFIG.enablePerformanceLog = false;
  LOG_CONFIG.enableDetailedLog = false;
  LOG_CONFIG.enableApiLog = true;

  LOG_CONFIG.categories.auth = false;
  LOG_CONFIG.categories.booking = true;
  LOG_CONFIG.categories.calendar = false;
  LOG_CONFIG.categories.cache = false;
  LOG_CONFIG.categories.error = true;

  const savedTime = OptimizedLogger.calculateSavedTime();
  Logger.log('美甲店生產環境最佳配置已套用', {
    estimatedSavedTime: savedTime,
    配置: '預約+錯誤日誌，其他關閉',
    適用環境: '250客戶美甲店'
  }, 'system');

  return {
    success: true,
    savedTime: savedTime,
    message: `美甲店最佳配置已套用，預估節省 ${savedTime}ms`
  };
}
