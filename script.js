/**
 * 🚀 前端日誌管理器
 * 針對 LINE LIFF 環境優化，提供分級日誌控制
 * 
 * 美甲預約系統特色：
 * - LIFF 環境友善：減少不必要的日誌輸出
 * - 客戶體驗優先：生產環境下最小化日誌
 * - 除錯支援：開發時可開啟詳細日誌
 */
const FRONTEND_LOG_CONFIG = {
  // 🎛️ 根據環境自動調整日誌等級
  level: window.location.hostname === 'localhost' ? 'DEBUG' : 'PRODUCTION',
  
  // 📱 LIFF 環境特殊配置
  enableLiffLog: false,        // LIFF 相關日誌（除錯用）
  enablePerformanceLog: true,  // 效能監控（重要）
  enableApiLog: true,          // API 呼叫日誌（重要）
  enableUILog: false,          // UI 操作日誌（除錯用）
  
  // 🎯 功能分類控制
  categories: {
    calendar: false,    // 行事曆操作
    booking: true,      // 預約處理（關鍵）
    auth: false,        // 客戶驗證
    ui: false,          // UI 互動
    error: true,        // 錯誤處理（重要）
    liff: false         // LIFF 相關
  }
};

/**
 * 🚀 前端優化日誌管理器
 */
class FrontendLogger {
  static log(message, data = null, category = 'general') {
    if (FRONTEND_LOG_CONFIG.level === 'SILENT') return;
    
    // 檢查分類過濾器
    if (FRONTEND_LOG_CONFIG.categories[category] === false) return;
    
    // 生產環境只顯示重要日誌
    if (FRONTEND_LOG_CONFIG.level === 'PRODUCTION' && category === 'debug') return;
    
    // 輸出日誌
    if (data) {
      console.log(`[${category.toUpperCase()}] ${message}`, data);
    } else {
      console.log(`[${category.toUpperCase()}] ${message}`);
    }
  }
  
  static error(message, error = null, category = 'error') {
    if (FRONTEND_LOG_CONFIG.level === 'SILENT') return;
    
    if (error) {
      console.error(`[ERROR-${category.toUpperCase()}] ${message}`, error);
    } else {
      console.error(`[ERROR-${category.toUpperCase()}] ${message}`);
    }
  }
  
  static warn(message, data = null, category = 'warning') {
    if (FRONTEND_LOG_CONFIG.level === 'SILENT') return;
    
    if (data) {
      console.warn(`[WARN-${category.toUpperCase()}] ${message}`, data);
    } else {
      console.warn(`[WARN-${category.toUpperCase()}] ${message}`);
    }
  }
  
  static debug(message, data = null, category = 'debug') {
    if (FRONTEND_LOG_CONFIG.level !== 'DEBUG') return;
    
    if (data) {
      console.log(`[DEBUG-${category.toUpperCase()}] ${message}`, data);
    } else {
      console.log(`[DEBUG-${category.toUpperCase()}] ${message}`);
    }
  }
  
  static performance(message, startTime, category = 'performance') {
    if (!FRONTEND_LOG_CONFIG.enablePerformanceLog) return;
    if (FRONTEND_LOG_CONFIG.level === 'SILENT') return;
    
    const duration = Date.now() - startTime;
    console.log(`[PERF-${category.toUpperCase()}] ${message}: ${duration}ms`);
  }
  
  static api(message, data = null, category = 'api') {
    if (!FRONTEND_LOG_CONFIG.enableApiLog) return;
    if (FRONTEND_LOG_CONFIG.level === 'SILENT') return;
    
    if (data) {
      console.log(`[API-${category.toUpperCase()}] ${message}`, data);
    } else {
      console.log(`[API-${category.toUpperCase()}] ${message}`);
    }
  }
  
  static liff(message, data = null, category = 'liff') {
    if (!FRONTEND_LOG_CONFIG.enableLiffLog) return;
    if (FRONTEND_LOG_CONFIG.level === 'SILENT') return;
    
    if (data) {
      console.log(`[LIFF-${category.toUpperCase()}] ${message}`, data);
    } else {
      console.log(`[LIFF-${category.toUpperCase()}] ${message}`);
    }
  }
  
  static ui(message, data = null, category = 'ui') {
    if (!FRONTEND_LOG_CONFIG.enableUILog) return;
    if (FRONTEND_LOG_CONFIG.level === 'SILENT') return;
    
    if (data) {
      console.log(`[UI-${category.toUpperCase()}] ${message}`, data);
    } else {
      console.log(`[UI-${category.toUpperCase()}] ${message}`);
    }
  }
  
  /**
   * 🎛️ 動態調整設定（用於除錯）
   */
  static setLevel(level) {
    FRONTEND_LOG_CONFIG.level = level;
    this.log(`前端日誌等級已調整為: ${level}`, null, 'system');
  }
  
  static enableCategory(category, enabled = true) {
    FRONTEND_LOG_CONFIG.categories[category] = enabled;
    this.log(`前端日誌分類 ${category} 已${enabled ? '啟用' : '停用'}`, null, 'system');
  }
  
  /**
   * 📊 效能統計
   */
  static getPerformanceStats() {
    const totalFrontendLogs = 80; // 估計前端總日誌數
    const avgLogTime = 2; // 前端每個日誌平均耗時
    
    let enabledLogs = 0;
    if (FRONTEND_LOG_CONFIG.level === 'DEBUG') enabledLogs = totalFrontendLogs;
    else if (FRONTEND_LOG_CONFIG.level === 'PRODUCTION') enabledLogs = totalFrontendLogs * 0.25;
    else enabledLogs = totalFrontendLogs * 0.1;
    
    const savedTime = (totalFrontendLogs - enabledLogs) * avgLogTime;
    
    return {
      level: FRONTEND_LOG_CONFIG.level,
      totalLogs: totalFrontendLogs,
      enabledLogs: Math.round(enabledLogs),
      savedTime: Math.round(savedTime),
      categories: FRONTEND_LOG_CONFIG.categories
    };
  }
}

// 🎯 建立全域別名
const FLog = FrontendLogger;

/**
 * 美甲預約行事曆類別（修改版 - 符合用戶需求）
 * 負責處理行事曆顯示、日期選擇、時段預約等功能
 * 
 * 🎯 用戶需求實作邏輯：
 * 1. 進入首頁 → 行事曆的日期預設不可點選 ✅
 * 2. 查詢 Google 日曆 "GOOGLE_TIMESLOTS_CALENDAR_ID" 當月的行程 ✅ 
 * 3. 比對 "GOOGLE_CALENDAR_ID" 日曆同時段是否有行程 ✅
 * 4. 有則根據日曆標題動態生成該時段並且按鈕顯示「已滿」✅
 * 5. 否則根據日曆標題，在對應日期動態生成該時段且按鈕顯示「預約」✅
 * 6. 判斷當日有任何一個時段是可預約就讓日期轉為可以點選 ✅
 * 7. 切換月份後也是一樣的邏輯 ✅
 * 
 * 🔧 實作方式：
 * - loadCalendarData(): 使用 batchCheckTimeSlotAvailability API 查詢兩個日曆並比對
 * - renderCalendar(): 根據 hasAvailableSlots 決定日期是否可點選
 * - ensureCalendarDataLoaded(): 月份切換時執行相同邏輯
 * - bindEvents(): 月份切換事件處理，確保相同邏輯套用
 */
class NailBookingCalendar {
    constructor() {
        // ⚙️ 系統配置常數
        this.CONSTANTS = {
            // 時間相關配置
            CALENDAR_WEEKS: 6,                    // 行事曆顯示週數 (6週 × 7天 = 42格)
            CALENDAR_DAYS: 42,                    // 行事曆總日期格數
            BOOKING_ADVANCE_HOURS: 3,             // 預約提前時間限制（小時）
            MONTHLY_OPENING_DAY: 15,              // 月度開放日期（每月15號）
            MONTHLY_OPENING_HOUR: 18,             // 月度開放時間（晚上6點）
            
            
            // 日期時間常數
            MS_PER_DAY: 24 * 60 * 60 * 1000,     // 一天的毫秒數
            MS_PER_HOUR: 60 * 60 * 1000,         // 一小時的毫秒數
            
            // 月份名稱
            MONTH_NAMES: [
                '一月', '二月', '三月', '四月', '五月', '六月',
                '七月', '八月', '九月', '十月', '十一月', '十二月'
            ],
            
            // 星期名稱
            WEEKDAY_NAMES: ['日', '一', '二', '三', '四', '五', '六']
        };
        
        // 當前顯示的日期（用於行事曆導航）
        this.currentDate = new Date();
        // 使用者選擇的預約日期
        this.selectedDate = null;
        // 使用者選擇的預約時間
        this.selectedTime = null;
        
        // 快取DOM元素
        this.domElements = {
            prevMonth: document.getElementById('prevMonth'),
            nextMonth: document.getElementById('nextMonth'),
            currentMonth: document.getElementById('currentMonth'),
            calendarDays: document.getElementById('calendarDays'),
            timeSlots: document.getElementById('timeSlots'),
            selectedDate: document.getElementById('selectedDate'),
            bookBtns: [], // 動態生成，初始為空
            timeSlotElements: [] // 動態生成，初始為空
        };
        
        // 載入指示器
        this.loadingIndicator = document.getElementById('loadingIndicator');
        
        // 📅 日曆時段資料快取
        this.calendarDataCache = new Map(); // 儲存每個日期的時段資料
        this.calendarLoadingPromise = null; // 批量載入的Promise
        
        // 🔄 請求去重 Map (Promise Deduping)
        // Key: `${year}-${month}` (例如 "2025-08")
        // Value: Promise<void>
        this.pendingMonthRequests = new Map();
        
        // 🚩 資料載入狀態
        this.isDataLoaded = false;
        
        // 初始化行事曆
        this.init();
    }
    
    /**
     * 🚀 效能優化版初始化 (Instant Loading)
     * 
     * 優化策略：
     * 1. **立即渲染**：不等待任何 API，立刻畫出日曆骨架（First Contentful Paint）。
     * 2. **並行處理**：LIFF 初始化與 GAS 資料請求並行執行。
     * 3. **漸進式增強**：資料回來後，再「點亮」可預約的日期。
     */
    async init() {
        // 取得當前年月
        const now = new Date();
        this.currentDate = new Date(now.getFullYear(), now.getMonth(), 1);

        // 1. 立即綁定事件（不依賴資料）
        this.bindEvents();

        // 2. 立即渲染日曆骨架（雖然還沒資料，但先顯示出來）
        // 此時日期會呈現不可點選的載入狀態
        this.showLoadingIndicator('正在同步最新時段...', true); // true 表示不全屏遮擋
        this.renderCalendar(); 
        this.showCalendar(); // 立即顯示 UI

        try {
            const liffInitStartTime = Date.now();
            FLog.liff('LIFF 環境優化載入開始', null, 'liff');
            
            // 3. 背景並行執行：LIFF 初始化 + 資料載入
            // 讓這兩件事同時跑，誰先跑完不重要，重點是資料回來要更新 UI
            
            const initPromises = [];
            
            // 任務 A: LIFF 初始化 (為了之後的預約功能)
            const liffTask = (async () => {
                 FLog.debug('啟動 LIFF 初始化任務...', null, 'liff');
                 
                 // 1. 嘗試獲取 LIFF ID
                 let liffId = "2007660224-8ENjnxAV"; // 預設值
                 if (window.LIFF_CONFIG && window.LIFF_CONFIG.LIFF_IDS) {
                     liffId = window.LIFF_CONFIG.LIFF_IDS.DEFAULT;
                 }
                 
                 // 2. 主動觸發初始化 (如果尚未初始化)
                 // 注意：initLiff 內部會處理重複呼叫，所以這裡可以放心呼叫
                 if (typeof initLiff === 'function') {
                     console.log('🔄 主動呼叫 initLiff...', { liffId });
                     initLiff(liffId).catch(err => console.warn('LIFF 初始化非致命錯誤:', err));
                 }
                 
                 // 3. 等待初始化完成
                 await this.ensureLiffReady();
                 FLog.debug('LIFF 初始化任務完成', null, 'liff');
            })();
            initPromises.push(liffTask);

            // 任務 B: 載入行事曆資料 (為了顯示忙碌狀態)
            // 即使 LIFF 還沒好，我們也可以先嘗試載入資料 (如果後端允許的話)
            // 但考量到後端可能需要 LIFF UserID 來記錄 Log，我們盡量並行
            
            const dataTask = (async () => {
                 FLog.debug('啟動日曆資料載入任務...', null, 'calendar');
                 // 這裡我們初始化 Google Calendar 服務並載入資料
                 await this.initializeGoogleCalendar();
                 await this.loadCurrentMonthDataWithLiff();
                 // 資料載入完成！
                 this.isDataLoaded = true;
                 FLog.debug('日曆資料載入任務完成，準備重繪', null, 'calendar');
                 
                 // 4. 資料回來了！重新渲染日曆，這次會顯示可點選狀態
                 this.renderCalendar();
                 this.hideLoadingIndicator();
                 
                 // 預載下個月
                 this.preloadNextMonthInLiffBackground();
            })();
            initPromises.push(dataTask);

            // 任務 C: 客戶資料預查 (Auth Prefetching)
            // 在首頁就先查好客戶資料，存入 sessionStorage，讓下一頁可以秒開
            const authPrefetchTask = (async () => {
                try {
                    // 等待 LIFF 初始化完成 (需要 UserID)
                    await liffTask; 
                    await this.prefetchCustomerData();
                } catch (e) {
                    console.warn('客戶資料預查非致命錯誤:', e);
                }
            })();
            initPromises.push(authPrefetchTask);

            // 我們不需要 await 所有任務完成才讓使用者操作
            // 使用者現在已經可以看到日曆了 (雖然還不能點)
            // 等 dataTask 完成，日曆就會自動變亮
            
            await Promise.allSettled(initPromises);
            FLog.performance('所有初始化任務完成', liffInitStartTime, 'liff');

        } catch (error) {
            FLog.error('初始化過程發生錯誤', error, 'liff');
            // 只有在真的發生嚴重錯誤導致完全無法運作時才顯示全屏錯誤
            this.showLiffErrorState(error.message);
        }
    }

    /**
     * 🚀 預先擷取客戶資料 (快取接力)
     * 在首頁就開始查客戶資料，並將結果存入 sessionStorage 供下一頁使用
     */
    async prefetchCustomerData() {
        try {
            FLog.debug('啟動客戶資料預先擷取...', null, 'auth');
            
            // 重試機制：嘗試獲取 UserID (最多重試 5 次，每次 500ms)
            let userId = getLineUserId();
            let retryCount = 0;
            const maxRetries = 5;
            
            while (!userId && retryCount < maxRetries) {
                retryCount++;
                // console.log(`⏳ [預查] 等待 UserID... (${retryCount}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 再次嘗試確保 LIFF 狀態
                await this.ensureLiffReady();
                userId = getLineUserId();
            }
            
            if (!userId) {
                console.warn('⚠️ 無法取得 UserID (重試後仍失敗)，跳過預查');
                return;
            }
            
            // 呼叫 API 查詢
            if (window.ApiService) {
                // 檢查是否已有本地快取 (如果有就不需預查)
                const localCache = localStorage.getItem('latestCustomerData');
                if (localCache) {
                    FLog.debug('已有本地快取，跳過預查', null, 'auth');
                    return;
                }

                console.log('📡 [預查] 開始背景查詢客戶資料...');
                const result = await window.ApiService.getCustomerByLineId(userId);
                
                // 將結果寫入 sessionStorage (供下一頁接力)
                // 加入 timestamp 用於判斷時效性
                const prefetchResult = {
                    result: result,
                    timestamp: Date.now(),
                    userId: userId
                };
                
                sessionStorage.setItem('auth_prefetch_result', JSON.stringify(prefetchResult));
                console.log('✅ [預查] 客戶資料預查完成，結果已寫入 SessionStorage', result);
            }
            
        } catch (error) {
            console.warn('客戶資料預查失敗:', error);
        }
    }

    /**
     * 🔐 確保 LIFF 服務已準備就緒
     * 這個方法會檢查 LIFF 是否已初始化並可用
     */
    async ensureLiffReady() {
        console.log('📱 檢查 LIFF 服務狀態...');
        
        return new Promise((resolve, reject) => {
            // 設定超時機制，避免無限等待
            const timeout = setTimeout(() => {
                // 不 reject，而是 resolve false，避免卡死
                console.warn('⚠️ LIFF 服務初始化超時，繼續執行降級模式');
                resolve(false);
            }, 5000); // 縮短為 5 秒
            
            // 檢查 LIFF 是否已經可用
            const checkLiffStatus = () => {
                try {
                    // 優先使用 liffService 的狀態檢查（最安全）
                    if (typeof window.liffService !== 'undefined' && window.liffService.isLoggedIn()) {
                        clearTimeout(timeout);
                        console.log('✅ LIFF 服務已就緒（透過 liffService）');
                        resolve(true);
                        return;
                    }
                    
                    // 備用：使用便利函數檢查
                    if (typeof isLiffReady === 'function' && isLiffReady()) {
                        clearTimeout(timeout);
                        console.log('✅ LIFF 服務已就緒（透過 isLiffReady）');
                        resolve(true);
                        return;
                    }
                    
                    // 最後備用：直接檢查但確保安全
                    if (typeof window.liff !== 'undefined' && 
                        typeof window.liff.isLoggedIn === 'function' && 
                        window.liff._config && // 確保 LIFF 已初始化
                        window.liff.isLoggedIn()) {
                        clearTimeout(timeout);
                        console.log('✅ LIFF 服務已就緒（直接檢查）');
                        resolve(true);
                        return;
                    }
                    
                    // 繼續等待
                    setTimeout(checkLiffStatus, 100);
                    
                } catch (error) {
                    console.warn('🔍 LIFF 狀態檢查中發生錯誤:', error.message);
                    // 即使發生錯誤也繼續檢查，可能是初始化過程中的暫時性錯誤
                    setTimeout(checkLiffStatus, 100);
                }
            };
            
            // 開始檢查
            checkLiffStatus();
        });
    }

    /**
     * 🚨 顯示錯誤狀態
     * 當初始化失敗時顯示友好的錯誤訊息
     */
    showErrorState(errorMessage) {
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #6b5b73;">
                    <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                    <h2 style="margin-bottom: 10px; color: #d32f2f;">載入失敗，請重新嘗試或透過私訊預約</h2>
                    <p style="margin-bottom: 20px; color: #8b7d8b;">${errorMessage}</p>
                    <button onclick="location.reload()" style="
                        background: #c8a8d8; 
                        color: white; 
                        border: none; 
                        padding: 12px 24px; 
                        border-radius: 8px; 
                        cursor: pointer;
                        font-size: 16px;
                    ">重新載入</button>
                </div>
            `;
        }
    }
    
    
    /**
     * 🔄 並行初始化版本：Google日曆服務初始化
     * 返回 Promise 以支援並行執行，並加強錯誤處理
     */
    async initializeGoogleCalendar() {
        return new Promise((resolve, reject) => {
            try {
                console.log('📅 開始初始化 Google Calendar 服務...');
                
                // 設定超時機制
                const timeout = setTimeout(() => {
                    console.warn('⚠️ Google Calendar 服務初始化超時，但不阻斷主流程');
                    resolve(false); // 超時也算成功，避免阻斷主流程
                }, 5000); // 5秒超時
                
                // 檢查後端 API 服務狀態
                const checkResult = this.checkBackendApiServiceAsync();
                
                checkResult.then(success => {
                    clearTimeout(timeout);
                    if (success) {
                        console.log('✅ Google Calendar 服務初始化成功');
                        resolve(true);
                    } else {
                        console.warn('⚠️ Google Calendar 服務初始化部分失敗');
                        resolve(false); // 即使失敗也不阻斷主流程
                    }
                }).catch(error => {
                    clearTimeout(timeout);
                    console.warn('⚠️ Google Calendar 服務初始化失敗:', error.message);
                    resolve(false); // 轉為成功以避免阻斷主流程
                });
                
                // 監聽配置載入完成事件（保留向後相容）
                window.addEventListener('googleCalendarConfigLoaded', (event) => {
                    console.log('🔔 收到 Google Calendar 配置載入完成通知');
                    clearTimeout(timeout);
                    this.checkBackendApiService();
                    resolve(true);
                });
                
            } catch (error) {
                console.error('❌ Google Calendar 服務初始化異常:', error);
                resolve(false); // 即使異常也不阻斷主流程
            }
        });
    }

    /**
     * 🔄 異步版本：檢查後端 API 服務狀態
     * 返回 Promise 以支援並行處理
     */
    async checkBackendApiServiceAsync() {
        try {
            if (window.ApiService) {
                console.log('✅ 後端 API 服務已載入');
                
                // 測試後端連接
                await this.testBackendConnection();
                
                // 如果有最終配置，顯示配置來源
                if (window.GOOGLE_CALENDAR_FINAL_CONFIG) {
                    console.log(`🔗 配置來源: ${window.GOOGLE_CALENDAR_FINAL_CONFIG.configSource || '後端'}`);
                }
                
                return true;
            } else {
                console.warn('⚠️ 後端 API 服務未載入，稍後重試');
                
                // 等待一段時間後重試
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                if (window.ApiService) {
                    console.log('✅ 後端 API 服務重試成功');
                    return true;
                }
                
                return false;
            }
        } catch (error) {
            console.error('❌ 檢查後端 API 服務狀態失敗:', error);
            return false;
        }
    }
    
    /**
     * 檢查後端 API 服務狀態
     */
    checkBackendApiService() {
        try {
            if (window.ApiService) {
                console.log('✅ 後端 API 服務已載入');
                
                // 測試後端連接
                this.testBackendConnection();
                
                // 如果有最終配置，顯示配置來源
                if (window.GOOGLE_CALENDAR_FINAL_CONFIG) {
                    console.log(`🔗 配置來源: ${window.GOOGLE_CALENDAR_FINAL_CONFIG.configSource || '後端'}`);
                }
            } else {
                console.warn('⚠️ 後端 API 服務未載入');
            }
        } catch (error) {
            console.error('❌ 檢查後端 API 服務狀態失敗:', error);
        }
    }
    
    /**
     * 測試後端連接
     */
    async testBackendConnection() {
        try {
            const result = await window.ApiService.sendRequest({ action: 'ping' });
            if (result.success) {
                console.log('✅ 後端連接測試成功');
            } else {
                console.warn('⚠️ 後端連接測試失敗:', result.error);
            }
        } catch (error) {
            console.warn('⚠️ 後端連接測試異常:', error.message);
        }
    }

    /**
     * 🔄 載入日曆資料（修改版 - 使用 LIFF 環境優化）
     * 保留原有邏輯，但使用新的 LIFF 環境載入方法
     */
    async loadCalendarData() {
        try {
            console.log('🔄 使用 LIFF 環境優化載入日曆資料...');
            
            // 直接調用 LIFF 環境的當月資料載入方法
            await this.loadCurrentMonthDataWithLiff();
            
            console.log('✅ 日曆資料載入完成（LIFF 環境優化）');
            
        } catch (error) {
            console.error('載入日曆資料失敗，嘗試錯誤處理:', error);
            
            // 使用 LIFF 環境錯誤處理
            await this.handleLiffDataLoadError(error.message || error.toString());
        }
    }

    /**
     * 🔄 確保日曆資料已載入（修改版 - LIFF 環境優化）
     * 檢查當前顯示月份的資料是否已載入，如果沒有則使用 LIFF 環境優化載入
     */
    async ensureCalendarDataLoaded() {
        if (!window.ApiService) {
            console.warn('無法檢查日曆資料：後端API服務未載入');
            return;
        }

        try {
            // 檢查當前月份是否有資料
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth();
            
            console.log(`🔍 檢查月份 ${year}-${month + 1} 的資料是否已載入...`);
            
            // 檢查當月第一天和最後一天
            const monthStart = new Date(year, month, 1);
            const monthEnd = new Date(year, month + 1, 0);
            
            // 檢查是否有該月份的資料
            let hasMonthData = true;
            for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
                const dateStr = this.formatDateToString(d);
                if (!this.calendarDataCache.has(dateStr)) {
                    hasMonthData = false;
                    break;
                }
            }
            
            if (hasMonthData) {
                console.log(`✅ 月份 ${year}-${month + 1} 的資料已在快取中`);
                this.isDataLoaded = true; // 確保標記為已載入
                return;
            }
            
            console.log(`🔄 載入月份 ${year}-${month + 1} 的資料...`);
            console.log(`📋 執行邏輯：查詢 GOOGLE_TIMESLOTS_CALENDAR_ID 獲取時段 → 檢查 GOOGLE_CALENDAR_ID 預約狀態 → 決定日期可選性`);
            
            // 避免重複載入
            if (this.calendarLoadingPromise) {
                console.log('⏳ 日曆資料載入中，等待完成...');
                await this.calendarLoadingPromise;
                return;
            }
            
            // 暫時標記為未載入，讓 renderCalendar 可以顯示 Loading 狀態
            this.isDataLoaded = false;
            
            // 🔄 使用 LIFF 環境優化的載入方法
            this.calendarLoadingPromise = this.loadMonthDataWithLiff(year, month);
            await this.calendarLoadingPromise;
            
            this.isDataLoaded = true; // 載入完成
            console.log(`✅ 月份 ${year}-${month + 1} 資料載入完成（LIFF 環境優化）`);

        } catch (error) {
            console.error('確保日曆資料載入時發生錯誤:', error);
            
            // 使用 LIFF 環境錯誤處理
            await this.handleLiffDataLoadError(error.message || error.toString());
        } finally {
            this.calendarLoadingPromise = null;
        }
    }

    /**
     * 🔄 載入指定月份資料（LIFF 環境優化版本）
     * 載入指定年月的資料，支援月份切換時使用
     * 🚀 優化：實作 Promise 共用機制，避免重複請求
     */
    async loadMonthDataWithLiff(year, month) {
        // 1. 建立請求 Key
        const requestKey = `${year}-${month}`;
        
        // 2. 檢查是否已有正在進行的請求 (Promise Deduping)
        if (this.pendingMonthRequests.has(requestKey)) {
            console.log(`⚡ [快取命中] 月份 ${requestKey} 已有正在進行的請求，直接共用 Promise`);
            return this.pendingMonthRequests.get(requestKey);
        }

        // 3. 建立新的請求 Promise
        const requestPromise = (async () => {
            try {
                console.log(`🔄 LIFF 環境載入指定月份資料: ${year}-${month + 1}`);
                
                // 🔐 確保有 LIFF 用戶資訊
                const liffProfile = await this.getLiffUserProfile();
                
                if (!liffProfile) {
                    console.warn('⚠️ 無法取得 LIFF 用戶資訊，使用一般載入方式');
                } else {
                    console.log('👤 LIFF 用戶資訊已取得，開始載入指定月份資料...');
                }
                
                // 計算指定月份的日期範圍
                const monthStart = new Date(year, month, 1);
                const monthEnd = new Date(year, month + 1, 0);
                
                const startDate = this.formatDateToString(monthStart);
                const endDate = this.formatDateToString(monthEnd);
                
                console.log('📞 LIFF 環境呼叫後端 API：batchCheckTimeSlotAvailability');
                console.log('📅 查詢範圍：', { startDate, endDate });
                
                // 🔄 使用 LIFF 用戶資訊呼叫 API（如果有的話）
                const result = await window.ApiService.batchCheckTimeSlotAvailability(startDate, endDate);
                
                if (!result.success) {
                    throw new Error(`載入月份資料失敗: ${result.error}`);
                }
                
                // 🚀 優化：清理舊月份的快取（保留最近2個月的資料）
                this.cleanupOldCacheData();
                
                console.log('✅ 指定月份資料 API 回應成功，開始處理資料...');
                console.log('📊 回應資料結構：', Object.keys(result.data || {}));
                
                // 🔍 處理資料並加入快取
                this.processCalendarData(result.data);
                
                console.log(`✅ 月份 ${year}-${month + 1} 資料載入完成，快取 ${Object.keys(result.data || {}).length} 天的資料`);
                console.log('🎯 日期可選性邏輯：只有 hasAvailableSlots=true 的日期才可點選');

            } catch (error) {
                console.error(`載入月份 ${year}-${month + 1} 資料失敗:`, error);
                throw error;
            } finally {
                // 4. 清理請求追蹤 (無論成功失敗)
                // 這樣下次再請求時，會重新發起 API 呼叫 (如果是失敗重試的話)
                if (this.pendingMonthRequests.get(requestKey) === requestPromise) {
                    this.pendingMonthRequests.delete(requestKey);
                }
            }
        })();

        // 5. 儲存 Promise 到 Map
        this.pendingMonthRequests.set(requestKey, requestPromise);
        
        return requestPromise;
    }

    /**
     * 🕐 根據時間字串取得時段標籤（輔助方法）
     * @param {string} timeStr - 時間字串 (如 "09:00")
     * @returns {string} - 時段標籤 ("上午"/"下午"/"晚上")
     */
    getTimePeriodForTime(timeStr) {
        const [hours] = timeStr.split(':').map(Number);
        
        if (hours >= 6 && hours < 12) {
            return '上午';
        } else if (hours >= 12 && hours < 18) {
            return '下午';
        } else {
            return '晚上';
        }
    }

    /**
     * 格式化日期為字串 (YYYY-MM-DD)
     * @param {Date} date - 日期物件
     * @returns {string} - 格式化後的日期字串
     */
    formatDateToString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 清理舊月份的快取資料（按需載入優化）
     * 只保留最近2個月的資料，避免記憶體過度使用
     */
    cleanupOldCacheData() {
        try {
            const currentYear = this.currentDate.getFullYear();
            const currentMonth = this.currentDate.getMonth();
            
            // 計算要保留的月份範圍（當前月份和上個月）
            const keepMonths = new Set();
            
            // 當前月份
            keepMonths.add(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`);
            
            // 上個月
            const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            keepMonths.add(`${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`);
            
            // 下個月
            const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
            const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
            keepMonths.add(`${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`);
            
            // 清理不在保留範圍內的快取
            const keysToDelete = [];
            for (const dateStr of this.calendarDataCache.keys()) {
                const monthKey = dateStr.substring(0, 7); // 取得 YYYY-MM 部分
                if (!keepMonths.has(monthKey)) {
                    keysToDelete.push(dateStr);
                }
            }
            
            // 刪除舊資料
            for (const key of keysToDelete) {
                this.calendarDataCache.delete(key);
            }
            
            if (keysToDelete.length > 0) {
                console.log(`🧹 清理了 ${keysToDelete.length} 天的舊快取資料`);
            }
            
        } catch (error) {
            console.error('清理快取資料時發生錯誤:', error);
        }
    }

    /**
     * 🎛️ 綁定事件處理器（優化版 - 使用事件委派）
     * 處理月份切換和時段預約的使用者互動
     */
    bindEvents() {
        // 🎯 事件委派：日期格子點擊處理
        this.domElements.calendarDays.addEventListener('click', (e) => {
            const dayElement = e.target.closest('.day');
            
            if (!dayElement) {
                return;
            }
            
            // 🔒 檢查是否可點選 (如果資料還沒載入完，即使是當月日期也不會有 clickable class)
            if (!dayElement.classList.contains('clickable')) {
                // 如果是資料載入中，可以給個提示
                if (!this.isDataLoaded) {
                    FLog.debug('資料載入中，暫時不可點選', null, 'calendar');
                } else {
                    FLog.debug('點擊了不可選取的日期', null, 'calendar');
                }
                return;
            }
            
            const year = parseInt(dayElement.dataset.year, 10);
            const month = parseInt(dayElement.dataset.month, 10);
            const day = parseInt(dayElement.dataset.day, 10);
            
            const selectedDate = new Date(year, month, day);
            
            this.selectDate(selectedDate, dayElement);
        });
        
        // 🔄 上一個月按鈕事件
        this.domElements.prevMonth.addEventListener('click', async () => {
            if (this.canNavigateToPreviousMonth()) {
                try {
                    console.log('🔄 切換到上一個月...');
                    
                    this.hideCalendar();
                    this.resetSelection();
                    
                    // 切換月份
                    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                    const targetMonth = this.currentDate.getFullYear() + '年' + this.CONSTANTS.MONTH_NAMES[this.currentDate.getMonth()];
                    
                    // 顯示載入提示，但不阻塞操作
                    this.showLoadingIndicator(`正在同步${targetMonth}資料...`, true);
                    this.isDataLoaded = false;
                    
                    // 立即渲染骨架
                    this.renderCalendar();
                    this.showCalendar();
                    
                    // 在背景載入資料
                    await this.ensureCalendarDataLoaded();
                    
                    // 資料載入完成，重繪
                    this.renderCalendar();
                    this.updateNavigationButtons();
                    this.hideLoadingIndicator();
                    
                } catch (error) {
                    console.error('❌ 切換上一個月時發生錯誤:', error);
                    this.hideLoadingIndicator();
                    this.showCalendar();
                    alert('載入月份資料時發生錯誤，請重試');
                }
            }
        });
        
        // 🔄 下一個月按鈕事件
        this.domElements.nextMonth.addEventListener('click', async () => {
            if (this.canNavigateToNextMonth()) {
                try {
                    console.log('🔄 切換到下一個月...');
                    
                    this.hideCalendar();
                    this.resetSelection();
                    
                    // 切換月份
                    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                    const targetMonth = this.currentDate.getFullYear() + '年' + this.CONSTANTS.MONTH_NAMES[this.currentDate.getMonth()];
                    
                    // 顯示載入提示
                    this.showLoadingIndicator(`正在同步${targetMonth}資料...`, true);
                    this.isDataLoaded = false;

                    // 立即渲染骨架
                    this.renderCalendar();
                    this.showCalendar();
                    
                    // 背景載入資料
                    await this.ensureCalendarDataLoaded();
                    
                    // 重繪
                    this.renderCalendar();
                    this.updateNavigationButtons();
                    this.hideLoadingIndicator();
                    
                } catch (error) {
                    console.error('❌ 切換下一個月時發生錯誤:', error);
                    this.hideLoadingIndicator();
                    this.showCalendar();
                    alert('載入月份資料時發生錯誤，請重試');
                }
            }
        });

        // 🎯 事件委派：時段預約按鈕點擊處理
        this.domElements.timeSlots.addEventListener('click', async (e) => {
            // 🔍 檢查點擊的是否為預約按鈕
            if (e.target.classList.contains('book-btn')) {
                e.stopPropagation(); // 防止事件繼續冒泡
                
                // 📋 取得時段容器和可用性狀態
                const timeSlot = e.target.closest('.time-slot');
                const isAvailable = !timeSlot.classList.contains('booked');
                
                // ✅ 只有可預約的時段才能預約
                if (isAvailable && !e.target.disabled) {
                    // 從按鈕的 data-time 屬性取得時段資訊
                    this.selectedTime = e.target.dataset.time;
                    
                    FLog.debug('⏰ 時段點擊事件', {
                        時段: this.selectedTime,
                        狀態: '可預約'
                    }, 'booking');
                    
                    // 🔐 儲存預約資訊時改採用 await，確保加密寫入流程完成後再進行頁面跳轉
                    await this.saveBookingInfo();
                    
                    // 跳轉到服務選擇頁面
                    window.location.href = 'service-selection.html';
                }
            }
        });
    }
    
    /**
     * 🎨 渲染行事曆（優化版）
     * 支援「無資料預渲染」與「資料後補」模式
     */
    renderCalendar() {
        const renderStartTime = performance.now();
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // 更新標題
        this.domElements.currentMonth.textContent = 
            `${year}年 ${this.CONSTANTS.MONTH_NAMES[month]}`;
        
        const firstDay = new Date(year, month, 1);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        // 清空
        this.domElements.calendarDays.innerHTML = '';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();
        
        const fragment = document.createDocumentFragment();
        
        let availableDatesCount = 0;
        let totalCurrentMonthDates = 0;
        
        // 判斷資料是否準備就緒
        const isDataReady = this.isDataLoaded;

        if (!isDataReady) {
            console.log('🎨 渲染模式：骨架預載 (資料尚未就緒)');
        }

        for (let i = 0; i < this.CONSTANTS.CALENDAR_DAYS; i++) {
            const date = new Date(startDate.getTime() + i * this.CONSTANTS.MS_PER_DAY);
            const dateTime = date.getTime();
            
            const dayElement = document.createElement('div');
            dayElement.className = 'day';
            dayElement.textContent = date.getDate();
            
            // 判斷是否為當月
            const isCurrentMonth = date.getMonth() === month;
            
            if (!isCurrentMonth) {
                dayElement.classList.add('other-month');
            } else if (dateTime < todayTime) {
                dayElement.classList.add('past');
                totalCurrentMonthDates++;
            } else {
                // 未來或今天的日期
                totalCurrentMonthDates++;
                
                if (!isDataReady) {
                    // ⏳ 資料還沒來，顯示為不可點選，但不是 past
                    // 可以加個特定的 class 讓它看起來像是在等待中 (例如稍微透明)
                    dayElement.style.opacity = '0.5';
                    dayElement.style.cursor = 'wait';
                } else {
                    // ✅ 資料已就緒，檢查是否有空位
                    const dateStr = this.formatDateToString(date);
                    const dateData = this.calendarDataCache.get(dateStr);
                    const hasAvailableSlots = dateData && dateData.hasAvailableSlots;
                    
                    if (hasAvailableSlots) {
                        // 有空位 -> 點亮
                        if (dateTime === todayTime) {
                            dayElement.classList.add('today');
                        }
                        dayElement.classList.add('clickable');
                        dayElement.style.cursor = 'pointer';
                        
                        // 綁定資料供事件委派使用
                        dayElement.dataset.date = dateStr;
                        dayElement.dataset.year = date.getFullYear();
                        dayElement.dataset.month = date.getMonth();
                        dayElement.dataset.day = date.getDate();
                        
                        availableDatesCount++;
                    } else {
                        // 沒空位 -> 反灰
                        dayElement.classList.add('past');
                    }
                }
            }
            
            fragment.appendChild(dayElement);
        }
        
        this.domElements.calendarDays.appendChild(fragment);
        
        const renderDuration = performance.now() - renderStartTime;
        console.log(`🎨 渲染完成 (${isDataReady ? '完整模式' : '骨架模式'}), 耗時: ${renderDuration.toFixed(2)}ms`);
        
        this.updateNavigationButtons();
    }
    
    /**
     * 🔍 檢查是否可以導航到上一個月
     */
    canNavigateToPreviousMonth() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const displayingMonth = this.currentDate.getMonth();
        const displayingYear = this.currentDate.getFullYear();
        
        // 如果當前顯示的是當月，不能再往前
        if (displayingYear === currentYear && displayingMonth === currentMonth) {
            return false;
        }
        
        // 如果當前顯示的是下個月，可以回到當月
        const nextMonthInfo = this.getNextMonthYearAndMonth(currentYear, currentMonth);
        
        if (displayingYear === nextMonthInfo.year && displayingMonth === nextMonthInfo.month) {
            return true;
        }
        
        return false;
    }
    
    /**
     * 🔍 檢查是否可以導航到下一個月
     */
    canNavigateToNextMonth() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const displayingMonth = this.currentDate.getMonth();
        const displayingYear = this.currentDate.getFullYear();
        
        // 如果當前顯示的是當月，需要檢查月度開放時間
        if (displayingYear === currentYear && displayingMonth === currentMonth) {
            // 檢查是否已經過了每月15號晚上8點
            const currentDay = now.getDate();
            const currentHour = now.getHours();
            
            // 如果還沒到15號，不能切換到下個月
            if (currentDay < this.CONSTANTS.MONTHLY_OPENING_DAY) {
                return false;
            }
            
            // 如果是15號但還沒到晚上8點，不能切換到下個月
            if (currentDay === this.CONSTANTS.MONTHLY_OPENING_DAY && currentHour < this.CONSTANTS.MONTHLY_OPENING_HOUR) {
                return false;
            }
            
            return true;
        }
        
        // 如果當前顯示的是下個月，不能再往後
        const nextMonthInfo = this.getNextMonthYearAndMonth(currentYear, currentMonth);
        
        if (displayingYear === nextMonthInfo.year && displayingMonth === nextMonthInfo.month) {
            return false;
        }
        
        return false;
    }
    
    /**
     * 🎛️ 更新導航按鈕的啟用/禁用狀態
     */
    updateNavigationButtons() {
        const canGoPrev = this.canNavigateToPreviousMonth();
        const canGoNext = this.canNavigateToNextMonth();
        
        this.domElements.prevMonth.disabled = !canGoPrev;
        this.domElements.nextMonth.disabled = !canGoNext;
    }
    
    /**
     * 選擇日期
     * @param {Date} date - 選中的日期
     * @param {HTMLElement} element - 對應的日期格子元素
     */
    async selectDate(date, element) {
        // 移除之前選中日期的樣式
        document.querySelectorAll('.day.selected').forEach(day => {
            day.classList.remove('selected');
        });
        
        // 為新選中的日期添加樣式
        element.classList.add('selected');
        this.selectedDate = new Date(date);
        
        // 顯示時段選擇區域並從快取載入時段
        this.showTimeSlots();
        await this.loadTimeSlotsFromCache();
    }
    
    /**
     * 顯示時段選擇區域
     * 當使用者選擇日期後，顯示該日期的可預約時段
     */
    showTimeSlots() {
        const timeSlotsContainer = this.domElements.timeSlots;
        const selectedDateElement = this.domElements.selectedDate;
        
        // 格式化並顯示選中的日期
        const dateStr = this.formatDate(this.selectedDate);
        selectedDateElement.textContent = `${dateStr} 可預約時段`;
        
        // 顯示時段選擇區域
        timeSlotsContainer.classList.remove('hidden');
        
        // 重置選中的時間
        this.selectedTime = null;
        
        // 直接載入時段資料（因為已預先載入所有資料）
        this.loadTimeSlotsFromCache();
    }

    /**
     * 從快取載入時段資料
     * 直接從預先載入的快取中讀取時段，無需重新查詢API
     */
    async loadTimeSlotsFromCache() {
        if (!this.selectedDate) {
            console.warn('無法載入時段：未選擇日期');
            this.showNoTimeSlotsMessage('請先選擇日期');
            return;
        }

        try {
            const dateStr = this.formatDateToString(this.selectedDate);
            const dateData = this.calendarDataCache.get(dateStr);
            
            console.log(`📋 從快取載入時段: ${dateStr}`, dateData);
            
            if (!dateData) {
                console.warn(`日期 ${dateStr} 的資料不在快取中`);
                this.showNoTimeSlotsMessage('該日期無可預約時段');
                return;
            }
            
            if (!dateData.hasAvailableSlots || dateData.timeSlots.length === 0) {
                console.log(`日期 ${dateStr} 沒有可預約時段`);
                this.showNoTimeSlotsMessage('該日期無可預約時段');
                return;
            }
            
            // 📋 直接使用快取的預約狀態結果
            let availabilityResult = dateData.availabilityResult;
            
            // 如果沒有預約狀態結果（檢查失敗的情況），創建預設結果
            if (!availabilityResult) {
                const timeSlotStrings = dateData.timeSlots.map(slot => slot.time || slot);
                availabilityResult = {
                    success: true,
                    availability: {}
                };
                timeSlotStrings.forEach(time => {
                    availabilityResult.availability[time] = {
                        available: false,
                        status: '已滿',
                        period: this.getTimePeriod(time),
                        conflictingEvents: [],
                        note: '預約狀態檢查失敗，不可預約，預設為已滿狀態'
                    };
                });
            }
            
            // 生成時段HTML
            this.generateBackendTimeSlotsHTML(dateData.timeSlots, availabilityResult);
            
        } catch (error) {
            console.error('從快取載入時段失敗:', error);
            this.showNoTimeSlotsMessage('載入時段失敗，請稍後再試');
        }
    }
    
    /**
     * 生成後端時段HTML
     * @param {Array} timeSlots - 時段陣列
     * @param {Object} availabilityResult - 可用性結果
     */
    generateBackendTimeSlotsHTML(timeSlots, availabilityResult) {
        const slotsContainer = this.domElements.timeSlots.querySelector('.slots-container');
        slotsContainer.innerHTML = '';
        
        timeSlots.forEach(slot => {
            const time = slot.time || slot;
            const availability = availabilityResult?.availability?.[time];
            const isWithinTimeLimit = this.checkTimeLimit(this.selectedDate, time);
            
            const timeSlotElement = document.createElement('div');
            timeSlotElement.className = 'time-slot';
            timeSlotElement.setAttribute('data-time', time);
            
            let buttonText = '預約';
            let buttonDisabled = false;
            let periodText = this.getTimePeriod(time);
            
            if (!isWithinTimeLimit) {
                timeSlotElement.classList.add('booked', 'expired');
                buttonText = '無法預約';
                buttonDisabled = true;
                periodText = '無法預約';
            } else if (availability && !availability.available) {
                timeSlotElement.classList.add('booked');
                buttonText = '已滿';
                buttonDisabled = true;
                periodText = '已滿';
            } else {
                buttonText = '預約';
                buttonDisabled = false;
                periodText = availability?.period || this.getTimePeriod(time);
            }
            
            timeSlotElement.innerHTML = `
                <div class="time-info">
                    <span class="time">${time}</span>
                    <span class="period">${periodText}</span>
                </div>
                <button class="book-btn" data-time="${time}" ${buttonDisabled ? 'disabled' : ''}>${buttonText}</button>
            `;
            
            slotsContainer.appendChild(timeSlotElement);
        });
        
        this.domElements.timeSlotElements = document.querySelectorAll('.time-slot');
        this.domElements.bookBtns = document.querySelectorAll('.book-btn');
    }

    /**
     * 根據時間計算時段標籤
     */
    getTimePeriod(time) {
        const [hours] = time.split(':').map(Number);
        
        if (hours >= 6 && hours < 12) {
            return '上午';
        } else if (hours >= 12 && hours < 18) {
            return '下午';
        } else {
            return '晚上';
        }
    }
    
    /**
     * 顯示無時段訊息
     */
    showNoTimeSlotsMessage(message) {
        const slotsContainer = this.domElements.timeSlots.querySelector('.slots-container');
        slotsContainer.innerHTML = `
            <div class="no-slots-message">
                <p>${message}</p>
                <p class="hint">請選擇其他日期或稍後再試</p>
            </div>
        `;
    }
    
    /**
     * 顯示載入指示器
     * @param {string} message - 訊息
     * @param {boolean} nonBlocking - 是否為非阻塞模式 (true: 不全屏遮擋)
     */
    showLoadingIndicator(message = '正在載入預約系統...', nonBlocking = false) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            const loadingText = loadingIndicator.querySelector('p');
            if (loadingText) {
                loadingText.textContent = message;
            }
            
            if (nonBlocking) {
                // 非阻塞模式：調整樣式使其不覆蓋全屏
                // 這裡假設 CSS 已經處理，或者我們動態調整
                loadingIndicator.style.display = 'block';
                // 可以在 CSS 中新增一個 class .non-blocking 來縮小它
            } else {
                loadingIndicator.style.display = 'block';
            }
        }
    }

    /**
     * 隱藏載入指示器
     */
    hideLoadingIndicator() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }

    /**
     * 隱藏行事曆
     */
    hideCalendar() {
        const calendarContainer = document.querySelector('.calendar-container');
        if (calendarContainer) {
            calendarContainer.style.display = 'none';
        }
    }

    /**
     * 顯示行事曆
     */
    showCalendar() {
        const calendarContainer = document.querySelector('.calendar-container');
        if (calendarContainer) {
            calendarContainer.style.display = 'block';
        }
    }
    
    /**
     * 儲存預約資訊到本地存儲
     */
    async saveBookingInfo() {
        // 將日期統一存為本地格式 YYYY-MM-DD，並另外提供帶 +08:00 的 ISO 時間字串
        const dateStr = this.formatDateToString(this.selectedDate);
        const timeStr = this.selectedTime || '';
        const isoStart = (dateStr && timeStr) ? `${dateStr}T${timeStr}:00+08:00` : '';

        const bookingInfo = {
            date: dateStr,                 // YYYY-MM-DD
            time: timeStr,                 // HH:mm
            isoStart: isoStart,            // ISO 8601
            dateFormatted: this.formatDate(this.selectedDate),
            timestamp: new Date().toISOString()
        };
        
        try {
            // 1️⃣ 首選：使用 ApiService.safeSetLocalStorage
            const canUseApiService = typeof ApiService !== 'undefined' &&
                typeof ApiService.safeSetLocalStorage === 'function';
            
            if (canUseApiService) {
                const encrypted = await ApiService.safeSetLocalStorage('currentBookingInfo', bookingInfo);
                if (encrypted) {
                    console.log('🔐 已透過 ApiService 以加密方式儲存當前預約資訊');
                    return;
                }
            }
            
            // 2️⃣ 次選：使用 CryptoUtils
            const canUseCrypto = typeof CryptoUtils !== 'undefined' &&
                typeof CryptoUtils.setEncryptedItem === 'function' &&
                typeof CryptoUtils.isSupported === 'function' &&
                CryptoUtils.isSupported();
            
            if (canUseCrypto) {
                const cryptoSuccess = await CryptoUtils.setEncryptedItem('currentBookingInfo', bookingInfo);
                if (cryptoSuccess) {
                    console.log('🔐 已透過 CryptoUtils 直接加密儲存當前預約資訊');
                    return;
                }
            }
            
            // 3️⃣ 最終回退：明文儲存
            localStorage.setItem('currentBookingInfo', JSON.stringify(bookingInfo));
            console.warn('⚠️ 已使用明文 localStorage 儲存 currentBookingInfo');
            
        } catch (error) {
            console.error('❌ 儲存預約資訊時發生非預期錯誤：', error);
            localStorage.setItem('currentBookingInfo', JSON.stringify(bookingInfo));
        }
    }
    
    /**
     * 重置選擇狀態
     */
    resetSelection() {
        document.querySelectorAll('.day.selected').forEach(day => {
            day.classList.remove('selected');
        });
        this.domElements.timeSlots.classList.add('hidden');
        this.selectedDate = null;
        this.selectedTime = null;
    }
    
    /**
     * 🕒 檢查時段是否符合3小時前的預約限制
     */
    checkTimeLimit(selectedDate, timeSlot) {
        const now = new Date();
        const appointmentDateTime = new Date(selectedDate);
        const [hours, minutes] = timeSlot.split(':').map(Number);
        
        appointmentDateTime.setHours(hours, minutes, 0, 0);
        
        const advanceTime = this.CONSTANTS.BOOKING_ADVANCE_HOURS * this.CONSTANTS.MS_PER_HOUR;
        const cutoffTime = new Date(appointmentDateTime.getTime() - advanceTime);
        
        return now <= cutoffTime;
    }
    
    /**
     * 格式化日期為中文顯示
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekday = this.CONSTANTS.WEEKDAY_NAMES[date.getDay()];
        
        return `${year}年${month}月${day}日 (${weekday})`;
    }
    
    /**
     * 🛠️ 輔助方法：計算下個月的年月
     */
    getNextMonthYearAndMonth(currentYear, currentMonth) {
        return {
            year: currentMonth === 11 ? currentYear + 1 : currentYear,
            month: currentMonth === 11 ? 0 : currentMonth + 1
        };
    }
    
    /**
     * 🛠️ 輔助方法：重置日期的時間為午夜
     */
    resetTimeToMidnight(date) {
        const newDate = new Date(date);
        newDate.setHours(0, 0, 0, 0);
        return newDate;
    }

    /**
     * 🔄 LIFF 環境的資料載入（包含用戶驗證）
     * 使用 LIFF 用戶資訊載入當月資料
     */
    async loadCurrentMonthDataWithLiff() {
        if (!window.ApiService) {
            console.warn('無法載入當月資料：後端API服務未載入');
            throw new Error('後端API服務未載入');
        }
        
        try {
            // 🔐 確保有 LIFF 用戶資訊
            const liffProfile = await this.getLiffUserProfile();
            
            // 🚀 載入當前月份的資料
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth();
            
            console.log(`🔄 LIFF 環境載入當月資料: ${year}-${month + 1}`);
            
            const monthStart = new Date(year, month, 1);
            const monthEnd = new Date(year, month + 1, 0);
            
            const startDate = this.formatDateToString(monthStart);
            const endDate = this.formatDateToString(monthEnd);
            
            const apiParams = { startDate, endDate };
            if (liffProfile) {
                apiParams.liffUserId = liffProfile.userId;
                apiParams.liffDisplayName = liffProfile.displayName;
            }
            
            const result = await window.ApiService.batchCheckTimeSlotAvailability(startDate, endDate);
            
            if (!result.success) {
                throw new Error(`載入當月資料失敗: ${result.error}`);
            }
            
            // 清除舊的快取（只保留當月資料）
            this.calendarDataCache.clear();
            
            // 🔍 處理後端回應的資料結構
            this.processCalendarData(result.data);
            
            console.log(`✅ 當月資料載入完成，快取 ${this.calendarDataCache.size} 天`);
            
        } catch (error) {
            console.error('LIFF 環境資料載入失敗:', error);
            throw error; 
        }
    }

    /**
     * 🔐 取得 LIFF 用戶資訊
     */
    async getLiffUserProfile() {
        try {
            if (!window.liff || !window.liff.isLoggedIn() || !window.liff.getProfile) {
                return null;
            }
            return await window.liff.getProfile();
        } catch (error) {
            console.error('取得 LIFF 用戶資訊失敗:', error);
            return null;
        }
    }

    /**
     * 🔍 處理日曆資料（抽取共用邏輯）
     */
    processCalendarData(data) {
        for (const [dateStr, slotStatusObj] of Object.entries(data || {})) {
            const timeSlots = Object.keys(slotStatusObj).map(time => ({ 
                time,
                period: this.getTimePeriodForTime(time)
            }));
            
            const hasAvailableSlots = Object.values(slotStatusObj).some(slot => 
                slot && slot.available === true
            );
            
            this.calendarDataCache.set(dateStr, {
                timeSlots: timeSlots,
                totalSlots: timeSlots.length,
                loadedAt: new Date(),
                hasSlots: timeSlots.length > 0,
                hasAvailableSlots: hasAvailableSlots,
                availabilityResult: { availability: slotStatusObj }
            });
        }
    }

    /**
     * 🚨 LIFF 環境專用錯誤處理
     */
    async handleLiffDataLoadError(error) {
        console.log('🔧 LIFF 環境錯誤處理:', error);
        
        const errorMessage = typeof error === 'string' ? error : (error.message || error.toString());
        
        if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized') || errorMessage.includes('認證')) {
            console.log('🔐 可能是認證問題，嘗試重新初始化 LIFF...');
            
            try {
                await this.reinitializeLiff();
                await this.loadCurrentMonthDataWithLiff();
                console.log('✅ LIFF 重新初始化成功');
            } catch (reinitError) {
                throw new Error('LIFF 認證失敗，請重新開啟應用程式');
            }
        } else {
            console.log('🔄 嘗試重新載入資料...');
            try {
                await this.loadCurrentMonthDataWithLiff();
                console.log('✅ 資料重新載入成功');
            } catch (retryError) {
                throw new Error('資料載入失敗，請檢查網路連線並重試');
            }
        }
    }

    /**
     * 🔄 重新初始化 LIFF
     */
    async reinitializeLiff() {
        try {
            if (window.liffService && window.liffService.init) {
                await window.liffService.init();
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            throw error;
        }
    }

    /**
     * 🔄 LIFF 環境背景預載（考慮環境限制）
     * 🚀 優化：改用 loadMonthDataWithLiff 統一介面，享受 Promise 共用優勢
     */
    async preloadNextMonthInLiffBackground() {
        try {
            // 延遲執行，讓主線程優先
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (!window.liff || !window.liff.isLoggedIn()) {
                // 如果 LIFF 還沒登入，可能要考慮是否要預載，或者就用訪客模式預載
                // 這裡選擇繼續嘗試預載，因為 loadMonthDataWithLiff 會處理無 LIFF profile 的情況
            }
            
            const nextMonth = new Date(this.currentDate);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            
            const year = nextMonth.getFullYear();
            const month = nextMonth.getMonth();
            
            console.log(`🚀 啟動背景預載下個月: ${year}-${month + 1}`);
            
            // 呼叫統一的載入方法
            // 這會將 Promise 放入 pendingMonthRequests
            // 如果使用者隨後切換到下個月，會直接共用這個 Promise
            await this.loadMonthDataWithLiff(year, month);
            
            console.log(`✅ 背景預載下月資料完成 (${year}-${month + 1})`);
            
        } catch (error) {
            console.warn('背景預載失敗:', error);
        }
    }

    /**
     * 🚨 LIFF 環境專用錯誤顯示
     */
    showLiffErrorState(errorMessage) {
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #6b5b73;">
                    <div style="font-size: 48px; margin-bottom: 20px;">📱</div>
                    <h2 style="margin-bottom: 10px; color: #d32f2f;">LIFF 載入失敗</h2>
                    <p style="margin-bottom: 20px; color: #8b7d8b;">${errorMessage}</p>
                    <button onclick="location.reload()" style="
                        background: #00C300; 
                        color: white; 
                        border: none; 
                        padding: 12px 24px; 
                        border-radius: 6px; 
                        cursor: pointer;
                        font-size: 16px;
                    ">重新載入</button>
                </div>
            `;
        }
    }
}

/**
 * 🚀 啟動入口
 */
document.addEventListener('DOMContentLoaded', () => {
    // 立即實例化，內部會自動開始並行載入
    const calendar = new NailBookingCalendar();
});
