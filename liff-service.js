/**
 * LIFF 服務模組 - 高效能版本
 * 統一管理 LINE LIFF 初始化和用戶資料
 * @version 2.1.0 - 載入速度優化版
 */

// 配置常數 - 優化版
const LIFF_CONFIG = {
    // LIFF ID 配置 - 可根據不同頁面使用不同的 LIFF ID
    LIFF_IDS: {
        DEFAULT: "2007660224-8ENjnxAV",
        BOOKING: "2007660224-obaBJ3Qx"
    },
    
    // 重試配置 - 優化載入速度
    RETRY: {
        MAX_ATTEMPTS: 2,        // 減少重試次數
        BASE_DELAY: 300,        // 減少基礎延遲
        MAX_DELAY: 2000,        // 減少最大延遲
        TIMEOUT: 5000           // 減少超時時間
    },
    
    // 日誌配置 - 生產環境優化
    LOG: {
        ENABLED: false,         // 生產環境關閉日誌
        LEVEL: 'ERROR'          // 只記錄錯誤
    },
    
    // 快取配置 - 更積極的快取
    CACHE: {
        USER_PROFILE_TTL: 30000, // 5鐘（增加快取時間）
        ENABLED: true,
        PRELOAD: true           // 啟用預載
    },
    
    // 效能優化配置
    PERFORMANCE: {
        PRELOAD_PROFILE: true,  // 預載用戶資料
        LAZY_NETWORK_CHECK: true, // 延遲網路檢查
        SKIP_REDUNDANT_CHECKS: true // 跳過冗餘檢查
    }
};

/**
 * 輕量級日誌工具 - 高效能版本
 */
class Logger {
    static levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    
    static log(level, message, data = null) {
        if (!LIFF_CONFIG.LOG.ENABLED || this.levels[level] < this.levels[LIFF_CONFIG.LOG.LEVEL]) return;
        
        if (data) {
            console[level.toLowerCase()](`[LIFF-${level}]:`, message, data);
        } else {
            console[level.toLowerCase()](`[LIFF-${level}]:`, message);
        }
    }
    
    static error(message, data) { this.log('ERROR', message, data); }
    static warn(message, data) { this.log('WARN', message, data); }
}

/**
 * 高效能網路工具
 */
class NetworkUtils {
    static _isOnlineCache = null;
    static _cacheTime = 0;
    static CACHE_DURATION = 1000; // 1秒快取
    
    static isOnline() {
        // 使用快取避免頻繁檢查
        const now = Date.now();
        if (LIFF_CONFIG.PERFORMANCE.SKIP_REDUNDANT_CHECKS && 
            this._isOnlineCache !== null && 
            (now - this._cacheTime) < this.CACHE_DURATION) {
            return this._isOnlineCache;
        }
        
        this._isOnlineCache = navigator.onLine;
        this._cacheTime = now;
        return this._isOnlineCache;
    }
    
    static async waitForOnline(timeout = 3000) { // 減少等待時間
        if (this.isOnline()) return true;
        
        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                window.removeEventListener('online', onlineHandler);
                resolve(false);
            }, timeout);
            
            const onlineHandler = () => {
                clearTimeout(timeoutId);
                window.removeEventListener('online', onlineHandler);
                this._isOnlineCache = true; // 更新快取
                resolve(true);
            };
            
            window.addEventListener('online', onlineHandler);
        });
    }
}

/**
 * 高效能快取管理
 */
class CacheManager {
    static cache = new Map();
    static initialized = false;
    
    static init() {
        if (this.initialized) return;
        
        // 從 localStorage 載入持久快取
        try {
            const stored = localStorage.getItem('liff_cache');
            if (stored) {
                const data = JSON.parse(stored);
                for (const [key, item] of Object.entries(data)) {
                    if (Date.now() < item.expiry) {
                        this.cache.set(key, item);
                    }
                }
            }
        } catch (e) {
            // 忽略快取載入錯誤
        }
        
        this.initialized = true;
    }
    
    static set(key, value, ttl = LIFF_CONFIG.CACHE.USER_PROFILE_TTL) {
        if (!LIFF_CONFIG.CACHE.ENABLED) return;
        
        const expiry = Date.now() + ttl;
        const item = { value, expiry };
        this.cache.set(key, item);
        
        // 異步儲存到 localStorage
        if (key === 'userProfile') {
            setTimeout(() => this._persistCache(), 0);
        }
    }
    
    static get(key) {
        if (!LIFF_CONFIG.CACHE.ENABLED) return null;
        
        this.init(); // 延遲初始化
        
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    }
    
    static _persistCache() {
        try {
            const data = {};
            for (const [key, item] of this.cache.entries()) {
                if (Date.now() < item.expiry) {
                    data[key] = item;
                }
            }
            localStorage.setItem('liff_cache', JSON.stringify(data));
        } catch (e) {
            // 忽略儲存錯誤
        }
    }
    
    static clear(key = null) {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
            localStorage.removeItem('liff_cache');
        }
    }
}

/**
 * 高效能 LIFF 服務
 */
class LiffService {
    constructor() {
        this.isInitialized = false;
        this.lineUserId = null;
        this.userProfile = null;
        this.liffId = LIFF_CONFIG.LIFF_IDS.DEFAULT;
        this.initPromise = null;
        this.eventListeners = new Map();
        
        // 預載快取
        if (LIFF_CONFIG.CACHE.PRELOAD) {
            this._preloadFromCache();
        }
    }

    _preloadFromCache() {
        const cachedProfile = CacheManager.get('userProfile');
        if (cachedProfile) {
            this.userProfile = cachedProfile;
            this.lineUserId = cachedProfile.userId;
        }
    }

    _emit(event, data = null) {
        const listeners = this.eventListeners.get(event) || [];
        listeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                Logger.error(`事件監聽器錯誤 (${event}):`, error);
            }
        });
    }

    on(event, listener) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(listener);
    }

    off(event, listener) {
        const listeners = this.eventListeners.get(event) || [];
        const index = listeners.indexOf(listener);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }

    async init(customLiffId = null) {
        if (customLiffId) {
            this.liffId = customLiffId;
        }
        
        if (this.isInitialized) {
            return true;
        }

        if (this.initPromise) {
            return await this.initPromise;
        }

        this.initPromise = this._performInit();
        return await this.initPromise;
    }

    async _performInit() {
        try {
            // 快速檢查 LIFF SDK 可用性
            if (typeof liff === 'undefined' || typeof liff.init !== 'function') {
                Logger.error('LIFF SDK 不可用');
                return false;
            }

            // 延遲網路檢查以提升載入速度
            if (!LIFF_CONFIG.PERFORMANCE.LAZY_NETWORK_CHECK || NetworkUtils.isOnline()) {
                await this._initWithRetry();
            } else {
                Logger.warn('無網路連線，延遲初始化');
                const networkReady = await NetworkUtils.waitForOnline(3000);
                if (!networkReady) {
                    throw new Error('網路連線超時');
                }
                await this._initWithRetry();
            }
            
            this.isInitialized = true;
            this._emit('liffInitialized');
            
            if (liff.isLoggedIn()) {
                // 優先使用快取的用戶資料
                if (this.lineUserId && this.userProfile) {
                    this._emit('userLoggedIn', { userId: this.lineUserId, profile: this.userProfile });
                } else {
                    await this.loadUserProfile();
                    if (!this.lineUserId) {
                        throw new Error('無法取得LINE User ID');
                    }
                    this._emit('userLoggedIn', { userId: this.lineUserId, profile: this.userProfile });
                }
            } else {
                this._emit('userNotLoggedIn');
                liff.login();
                return false;
            }
            
            return true;
            
        } catch (error) {
            Logger.error('LIFF初始化失敗:', error);
            this.initPromise = null;
            this._emit('liffInitError', error);
            throw error;
        }
    }

    async _initWithRetry(maxRetries = LIFF_CONFIG.RETRY.MAX_ATTEMPTS, baseDelay = LIFF_CONFIG.RETRY.BASE_DELAY) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const initPromise = liff.init({ liffId: this.liffId });
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('LIFF初始化超時')), LIFF_CONFIG.RETRY.TIMEOUT);
                });
                
                await Promise.race([initPromise, timeoutPromise]);
                return;
                
            } catch (error) {
                lastError = error;
                
                if (attempt === maxRetries) break;
                
                // 快速重試，不等待網路
                const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), LIFF_CONFIG.RETRY.MAX_DELAY);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError || new Error('LIFF初始化失敗');
    }

    async loadUserProfile(useCache = true) {
        try {
            if (!this.isInitialized || !liff.isLoggedIn()) {
                return null;
            }

            if (useCache && this.userProfile && this.lineUserId) {
                return this.userProfile;
            }

            if (useCache) {
                const cachedProfile = CacheManager.get('userProfile');
                if (cachedProfile) {
                    this.userProfile = cachedProfile;
                    this.lineUserId = cachedProfile.userId;
                    return cachedProfile;
                }
            }

            this.userProfile = await liff.getProfile();
            this.lineUserId = this.userProfile.userId;
            
            if (useCache) {
                CacheManager.set('userProfile', this.userProfile);
            }
            
            this._emit('profileLoaded', this.userProfile);
            return this.userProfile;
            
        } catch (error) {
            Logger.error('載入用戶資料失敗:', error);
            this._emit('profileLoadError', error);
            return null;
        }
    }

    getUserId() {
        return this.lineUserId;
    }

    getUserProfile() {
        return this.userProfile;
    }

    isLiffEnvironment() {
        return typeof liff !== 'undefined' && this.isInitialized;
    }

    isLoggedIn() {
        return this.isInitialized && liff.isLoggedIn();
    }

    setLiffId(newLiffId) {
        if (typeof newLiffId !== 'string' || !newLiffId.trim()) {
            throw new Error('無效的 LIFF ID');
        }
        this.liffId = newLiffId;
    }

    reset() {
        this.isInitialized = false;
        this.lineUserId = null;
        this.userProfile = null;
        this.initPromise = null;
        CacheManager.clear();
        this._emit('liffReset');
    }

    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isLoggedIn: this.isLoggedIn(),
            hasUserId: !!this.lineUserId,
            hasProfile: !!this.userProfile,
            liffId: this.liffId,
            isOnline: NetworkUtils.isOnline()
        };
    }
}

// 建立全域的LIFF服務實例
window.liffService = new LiffService();

// === 高效能便利函數 ===

async function initLiff(liffId = null) {
    try {
        return await window.liffService.init(liffId);
    } catch (error) {
        Logger.error('initLiff失敗:', error);
        return false;
    }
}

function getLineUserId() {
    return window.liffService.getUserId();
}

function getUserProfile() {
    return window.liffService.getUserProfile();
}

function isLiffReady() {
    return window.liffService.isLoggedIn();
}

function getLiffStatus() {
    return window.liffService.getStatus();
}

// 匯出配置
window.LIFF_CONFIG = LIFF_CONFIG; 