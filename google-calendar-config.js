/**
 * Google Calendar 配置檔案
 * 請在這裡設定您的Google Calendar API Key和日曆ID
 */

// Google Calendar API 配置
const GOOGLE_CALENDAR_CONFIG = {
    // 🔄 配置載入模式設定
    configMode: {
        // 可選模式：'local' | 'backend' | 'hybrid'
        // local: 使用本地配置檔案（現有方式）
        // backend: 從後端 API 載入配置（包含敏感資訊）
        // hybrid: 先嘗試後端，失敗時使用本地配置
        mode: 'backend', // 🔐 使用後端模式，完全移除前端敏感資訊
        
        // 後端 API 設定
        backendConfig: {
            // 後端憑證 API URL（包含敏感資訊）
            credentialsApiUrl: 'getGoogleCalendarCredentials', // 新的憑證 API
            // 後端配置 API URL（不包含敏感資訊，作為備援）
            configApiUrl: 'getCalendarConfig', // 原有的配置 API
            timeout: 5000, // 5秒超時
            retryCount: 2 // 重試次數
        }
    },
    
    // 本地配置（當後端不可用時的備援配置）
    // ⚠️ 敏感資訊已移至後端，此配置僅作為備援使用
    localConfig: {
        // Google Calendar API Key - 已移至後端
        // 🔐 敏感資訊已移至後端 Google Apps Script Properties
        apiKey: '', // 已移至後端
        
        // 日曆ID配置 - 已移至後端
        // 🔐 敏感資訊已移至後端 Google Apps Script Properties
        calendarIds: [], // 已移至後端
        
        // 預約寫入專用日曆ID - 已移至後端
        // 🔐 敏感資訊已移至後端 Google Apps Script Properties
        bookingCalendarId: '' // 已移至後端
    },
    
    // 向後相容：保留原有屬性（敏感資訊已移至後端）
    // 🔐 敏感資訊已移至後端，此處僅保留結構
    apiKey: '', // 已移至後端
    calendarIds: [], // 已移至後端
    bookingCalendarId: '', // 已移至後端
    
    // 動態時段生成設定
    dynamicTimeSlots: {
        enabled: true, // 啟用動態時段生成
        scanFromCalendar: true, // 從日曆掃描可預約時段
        // 預約限制設定
        bookingAdvanceHours: 3, // 需要提前3小時預約
        // 時段顯示設定
        periodLabels: {
            morning: '上午',    // 6:00-11:59
            afternoon: '下午',  // 12:00-17:59
            evening: '晚上'     // 18:00-23:59
        }
    },
    
    // 快取設定
    cache: {
        expiry: 5 * 60 * 1000 // 5分鐘快取時間
    }
};

// 將配置暴露為全域變數供其他腳本使用
window.GOOGLE_CALENDAR_CONFIG = GOOGLE_CALENDAR_CONFIG;

/**
 * 從後端載入配置（包含敏感資訊）
 * @returns {Promise<Object|null>} - 後端配置或 null（如果失敗）
 */
async function loadConfigFromBackend() {
    if (!window.ApiService) {
        console.warn('⚠️ ApiService 未載入，無法從後端載入配置');
        return null;
    }
    
    try {
        console.log('🔄 嘗試從後端載入 Google Calendar 憑證...');
        
        // 優先使用憑證 API（包含敏感資訊）
        const result = await window.ApiService.getGoogleCalendarCredentials();
        
        if (result.success && result.credentials) {
            console.log('✅ 後端憑證載入成功');
            return result.credentials;
        } else {
            console.warn('⚠️ 後端憑證回應無效:', result);
            
            // 如果憑證 API 失敗，嘗試使用舊的配置 API
            console.log('🔄 嘗試使用舊的配置 API 作為備援...');
            const fallbackResult = await window.ApiService.sendRequest({
                action: GOOGLE_CALENDAR_CONFIG.configMode.backendConfig.configApiUrl
            });
            
            if (fallbackResult.success && fallbackResult.config) {
                console.log('✅ 後端配置載入成功（無敏感資訊）');
                return fallbackResult.config;
            } else {
                console.warn('⚠️ 後端配置回應無效:', fallbackResult);
                return null;
            }
        }
        
    } catch (error) {
        console.warn('⚠️ 從後端載入配置失敗:', error.message);
        return null;
    }
}

/**
 * 智慧配置載入器
 * @returns {Promise<Object>} - 最終使用的配置
 */
async function loadSmartConfig() {
    const mode = GOOGLE_CALENDAR_CONFIG.configMode.mode;
    let backendConfig = null;
    let finalConfig = null;
    
    console.log(`🔧 配置載入模式: ${mode}`);
    
    switch (mode) {
        case 'backend':
            // 僅使用後端配置（包含敏感資訊）
            backendConfig = await loadConfigFromBackend();
            if (!backendConfig) {
                throw new Error('後端配置載入失敗，且未設定備援方案');
            }
            // 檢查是否包含敏感資訊
            if (backendConfig.apiKey && backendConfig.calendarId) {
                finalConfig = backendConfig;
                console.log('📡 使用後端配置（包含敏感資訊）');
            } else {
                // 如果後端沒有敏感資訊，合併本地敏感資訊
                finalConfig = mergeConfigs(GOOGLE_CALENDAR_CONFIG.localConfig, backendConfig);
                console.log('📡 使用後端配置（合併本地敏感資訊）');
            }
            break;
            
        case 'hybrid':
            // 先嘗試後端，失敗時使用本地配置
            backendConfig = await loadConfigFromBackend();
            if (backendConfig) {
                finalConfig = mergeConfigs(GOOGLE_CALENDAR_CONFIG.localConfig, backendConfig);
                console.log('🔄 使用混合配置（後端 + 本地敏感資訊）');
            } else {
                console.log('🔄 後端配置失敗，使用本地配置作為備援');
                finalConfig = GOOGLE_CALENDAR_CONFIG.localConfig;
            }
            break;
            
        case 'local':
        default:
            // 使用本地配置
            console.log('📁 使用本地配置');
            finalConfig = GOOGLE_CALENDAR_CONFIG.localConfig;
            break;
    }
    
    return finalConfig;
}

/**
 * 合併本地和後端配置
 * @param {Object} localConfig - 本地配置（包含敏感資訊）
 * @param {Object} backendConfig - 後端配置（可能包含敏感資訊）
 * @returns {Object} - 合併後的配置
 */
function mergeConfigs(localConfig, backendConfig) {
    // 優先使用後端的敏感資訊，如果沒有則使用本地的
    const mergedConfig = {
        // 敏感資訊（優先使用後端）
        apiKey: backendConfig.apiKey || localConfig.apiKey,
        calendarIds: backendConfig.calendarIds || [backendConfig.timeSlotsCalendarId] || localConfig.calendarIds,
        bookingCalendarId: backendConfig.calendarId || localConfig.bookingCalendarId,
        
        // 業務邏輯配置（優先使用後端）
        timezone: backendConfig.timezone || localConfig.timezone,
        businessHours: backendConfig.businessHours || localConfig.businessHours,
        defaultDuration: backendConfig.defaultDuration || localConfig.defaultDuration,
        bookingAdvanceHours: backendConfig.bookingAdvanceHours || 3,
        
        // 功能開關（優先使用後端設定）
        notificationEnabled: backendConfig.notificationEnabled !== undefined ? backendConfig.notificationEnabled : true,
        lineMessagingEnabled: backendConfig.lineMessagingEnabled !== undefined ? backendConfig.lineMessagingEnabled : true,
        
        // 元資訊
        configSource: backendConfig.apiKey ? 'backend' : 'hybrid',
        backendApiVersion: backendConfig.apiVersion,
        lastUpdated: backendConfig.lastUpdated || new Date().toISOString()
    };
    
    console.log('🔗 配置合併完成:', {
        apiKeySource: backendConfig.apiKey ? '後端' : '本地',
        calendarIdsSource: backendConfig.timeSlotsCalendarId ? '後端' : '本地',
        bookingCalendarSource: backendConfig.calendarId ? '後端' : '本地',
        businessConfigSource: '後端',
        hasBackendAccess: backendConfig.hasCalendarAccess
    });
    
    return mergedConfig;
}

// 自動初始化後端配置服務
document.addEventListener('DOMContentLoaded', () => {
    // 等待相關服務載入
    setTimeout(async () => {
        if (!window.ApiService) {
            console.warn('⚠️ ApiService 未載入，無法初始化後端配置');
            return;
        }
        
        try {
            // 智慧載入配置
            const config = await loadSmartConfig();
            
            if (config.apiKey && config.apiKey !== 'YOUR_GOOGLE_CALENDAR_API_KEY' && config.apiKey !== '') {
                console.log('✅ 後端配置已載入');
                console.log(`📖 API Key: ${config.apiKey ? '已設定' : '未設定'}`);
                console.log(`📖 讀取日曆數量: ${config.calendarIds?.length || 0}`);
                console.log(`✍️ 預約日曆ID: ${config.bookingCalendarId ? '已設定' : '未設定'}`);
                
                // 儲存最終配置供其他模組使用
                window.GOOGLE_CALENDAR_FINAL_CONFIG = config;
                
                // 🔔 通知其他模組配置已載入完成
                window.dispatchEvent(new CustomEvent('googleCalendarConfigLoaded', {
                    detail: { config }
                }));
                
                // 🔄 向後相容：如果 googleCalendarService 存在，也設定它
        if (window.googleCalendarService) {
                window.googleCalendarService.setConfig(
                        config.apiKey, 
                        config.calendarIds,
                        config.bookingCalendarId
                );
                    console.log('🔄 向後相容：已同步設定 googleCalendarService');
                }
                
            } else {
                console.warn('⚠️ 後端配置中缺少 API Key');
            }
            
        } catch (error) {
            console.error('❌ 後端配置載入失敗:', error);
            console.error('請檢查後端 Google Apps Script 的 Properties 設定');
        }
        
    }, 300); // 增加延遲確保所有服務已載入
});

// 匯出配置供其他模組使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GOOGLE_CALENDAR_CONFIG;
} 