/**
 * API 服務模組 - 與 Google Apps Script 通訊
 * 請將 SCRIPT_URL 替換為您的 Google Apps Script 部署 URL
 */

// ⚠️ 重要：請將此 URL 替換為您的 Google Apps Script 部署 URL
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWyHhUHGHnEkGtrKY5vOqSXmeubYdUCUtJgQOIpIDAuleppKjvQBg7isgjTwftKI6F/exec';

/**
 * API 服務類別
 */
class ApiService {
    // 快取環境檢測結果，避免重複檢查
    static _isLIFF = null;
    
    /**
     * 檢測是否在 LIFF 環境中（快取結果）
     * @returns {boolean} 是否為 LIFF 環境
     */
    static isLIFFEnvironment() {
        if (this._isLIFF === null) {
            this._isLIFF = window.liff || navigator.userAgent.includes('Line');
        }
        return this._isLIFF;
    }

    /**
     * 準備 JSONP 請求參數
     * @param {Object} data - 原始資料
     * @returns {Object} - JSONP 參數
     */
    static prepareJsonpParams(data) {
        const jsonpParams = { action: data.action };
        
        // 根據不同動作準備參數
        switch (data.action) {
            case 'saveCustomer':
                Object.assign(jsonpParams, data.customer);
                break;
            case 'saveBooking':
                Object.assign(jsonpParams, data.booking);
                break;
            case 'getCustomer':
                jsonpParams.phone = data.phone;
                break;
            case 'updateBookingStatus':
                jsonpParams.bookingId = data.bookingId;
                jsonpParams.status = data.status;
                break;
            case 'checkTimeSlotAvailability':
                // 🔧 特殊處理陣列參數
                jsonpParams.date = data.date;
                // 將陣列序列化為JSON字串，後端會重新解析
                jsonpParams.timeSlots = JSON.stringify(data.timeSlots);
                console.log('🔍 JSONP 陣列參數準備:', {
                    original: data.timeSlots,
                    serialized: jsonpParams.timeSlots,
                    isArray: Array.isArray(data.timeSlots)
                });
                break;
            case 'getAvailableTimeSlots':
                jsonpParams.date = data.date;
                break;
            case 'getBatchAvailableTimeSlots':
                jsonpParams.startDate = data.startDate;
                jsonpParams.endDate = data.endDate;
                break;
            case 'getGoogleCalendarCredentials':
                // 不需要額外參數
                break;
            default:
                // 其他情況直接複製所有屬性
                Object.assign(jsonpParams, data);
        }
        
        // 🛡️ 關鍵修正：JSONP 版本請求必須顯式附上 CSRF Token
        // 先前僅複製 customer/booking 物件，導致 token 遺失而被後端拒絕
        if (data.csrfToken) {
            jsonpParams.csrfToken = data.csrfToken;
        }
        
        return jsonpParams;
    }
    /**
     * 使用 JSONP 方式發送請求到 Google Apps Script
     * @param {Object} params - 請求參數
     * @returns {Promise<Object>} - 回應結果
     */
    static async sendJsonpRequest(params) {
        return new Promise((resolve, reject) => {
            // 生成唯一的回調函數名稱
            const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
            
            // 在全域範圍建立回調函數
            window[callbackName] = function(data) {
                resolve(data);
                // 清理
                if (script.parentNode) {
                    document.head.removeChild(script);
                }
                delete window[callbackName];
            };
            
            // 建立 script 標籤
            const script = document.createElement('script');
            
            // 建立 URL 參數
            const urlParams = new URLSearchParams(params);
            urlParams.append('callback', callbackName);
            
            script.src = SCRIPT_URL + '?' + urlParams.toString();
            
            // 錯誤處理
            script.onerror = function() {
                reject(new Error('JSONP 請求失敗'));
                if (script.parentNode) {
                    document.head.removeChild(script);
                }
                delete window[callbackName];
            };
            
            // 超時處理
            setTimeout(() => {
                if (window[callbackName]) {
                    reject(new Error('JSONP 請求超時'));
                    if (script.parentNode) {
                        document.head.removeChild(script);
                    }
                    delete window[callbackName];
                }
            }, 15000); // 15秒超時
            
            // 執行請求
            document.head.appendChild(script);
        });
    }

    /**
     * 發送請求到 Google Apps Script（支援 JSONP 和 POST）
     * @param {Object} data - 請求資料
     * @returns {Promise<Object>} - 回應結果
     */
    static async sendRequest(data) {
        try {
            // 🛡️ 自動加入 CSRF Token（重要操作保護）
            // 定義需要 CSRF 保護的操作
            const csrfProtectedActions = [
                'saveCustomer',         // 儲存客戶資料
                'saveBooking',          // 儲存預約
                'updateBookingStatus',  // 更新預約狀態
                'deleteBooking'         // 刪除預約（如果有）
            ];
            
            if (csrfProtectedActions.includes(data.action) && 
                typeof CSRFProtection !== 'undefined') {
                // 取得 CSRF Token 並加入請求
                const csrfToken = CSRFProtection.getToken();
                data.csrfToken = csrfToken;
                
                console.log('🛡️ 已加入 CSRF Token', {
                    action: data.action,
                    tokenLength: csrfToken.length
                });
            }
            
            // 檢查是否在 LIFF 環境中
            const isLIFF = this.isLIFFEnvironment();
            
            console.log('=== API 請求詳細資訊 ===');
            console.log('動作:', data.action);
            // 🔒 安全日誌：遮罩敏感資訊
            console.log('資料:', SecurityUtils.maskSensitiveData(data));
            console.log('目標 URL:', SCRIPT_URL);
            console.log('環境:', isLIFF ? 'LIFF' : '一般瀏覽器');
            console.log('時間:', new Date().toLocaleString());
            console.log('User Agent:', navigator.userAgent);
            console.log('========================');
            
            // 優先使用 JSONP 方式（更可靠，特別是在 LIFF 環境中）
            try {
                console.log('🔄 嘗試使用 JSONP 方式...');
                
                // 準備 JSONP 參數
                const jsonpParams = this.prepareJsonpParams(data);
                
                const result = await this.sendJsonpRequest(jsonpParams);
                
                console.log('=== JSONP 請求成功 ===');
                // 🔒 安全日誌：遮罩敏感資訊
                console.log('結果:', SecurityUtils.maskSensitiveData(result));
                console.log('====================');
                
                return result;
                
            } catch (jsonpError) {
                console.warn('JSONP 請求失敗，嘗試 POST 方式:', jsonpError.message);
                
                // JSONP 失敗，嘗試傳統 POST 方式
                // 🔧 CORS 修正：使用 text/plain 以避免觸發 Preflight OPTIONS
                const fetchOptions = {
                    method: 'POST',
                    body: JSON.stringify(data)
                    // 注意：不設定 Content-Type: application/json，避免跨域預檢失敗
                };
                
                // 在 LIFF 環境中，某些情況下不設定 mode 可能更好
                if (!isLIFF) {
                    fetchOptions.mode = 'cors';
                }

                console.log('請求選項:', fetchOptions);
                console.log('請求內容:', JSON.stringify(data, null, 2));

                const response = await fetch(SCRIPT_URL, fetchOptions);

                console.log('=== POST 回應資訊 ===');
                console.log('狀態碼:', response.status);
                console.log('狀態文字:', response.statusText);
                console.log('回應標頭:', Object.fromEntries(response.headers.entries()));
                console.log('===================');

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('錯誤回應內容:', errorText);
                    throw new Error(`HTTP 錯誤! 狀態: ${response.status}, 內容: ${errorText}`);
                }

                const result = await response.json();
                console.log('=== POST 請求成功 ===');
                console.log('結果:', result);
                console.log('===================');
                
                return result;
            }
            
        } catch (error) {
            console.error('=== API 請求失敗 ===');
            console.error('錯誤類型:', error.name);
            console.error('錯誤訊息:', error.message);
            console.error('完整錯誤:', error);
            console.error('錯誤堆疊:', error.stack);
            
            // 在 LIFF 環境中記錄額外資訊
            if (this.isLIFFEnvironment()) {
                console.warn('=== LIFF 環境特殊資訊 ===');
                console.warn('LIFF 物件存在:', !!window.liff);
                console.warn('LINE 用戶代理:', navigator.userAgent.includes('Line'));
                console.warn('網路請求失敗可能是正常的 LIFF 安全限制');
                console.warn('========================');
            }
            
            console.error('==================');
            
            // 如果所有方式都失敗，回退到本地存儲
            console.warn('🔄 所有網路請求都失敗，回退到本地存儲模式');
            return await this.handleLocalFallback(data);
        }
    }

    /**
     * 儲存客戶資料
     * @param {Object} customer - 客戶資料 {name, phone}
     * @returns {Promise<Object>} - 儲存結果
     */
    static async saveCustomer(customer) {
        const requestData = {
            action: 'saveCustomer',
            customer: customer
        };
        
        const result = await this.sendRequest(requestData);
        
        // 如果儲存成功且不是本地模式，也要保存到本地存儲
        if (result.success && !result.isLocal) {
            const customerDataForStorage = {
                lineUserId: customer.lineUserId,
                name: customer.name,
                customerName: customer.name, // 新增相容性欄位
                phone: customer.phone,
                createdAt: new Date().toISOString(),
                lastVerified: new Date().toISOString()
            };
            
            this.safeSetLocalStorage('latestCustomerData', customerDataForStorage);
            console.log('✅ 客戶資料已同步保存到本地存儲:', customerDataForStorage);
        }
        
        return result;
    }

    /**
     * 儲存預約資料
     * @param {Object} booking - 預約資料
     * @returns {Promise<Object>} - 儲存結果
     */
    static async saveBooking(booking) {
        const requestData = {
            action: 'saveBooking',
            booking: booking
        };
        
        return await this.sendRequest(requestData);
    }

    /**
     * 查詢客戶資料
     * @param {string} phone - 手機號碼
     * @returns {Promise<Object>} - 客戶資料
     */
    static async getCustomer(phone) {
        const requestData = {
            action: 'getCustomer',
            phone: phone
        };
        
        return await this.sendRequest(requestData);
    }

    /**
     * 更新預約狀態
     * @param {string} bookingId - 預約ID
     * @param {string} status - 新狀態
     * @returns {Promise<Object>} - 更新結果
     */
    static async updateBookingStatus(bookingId, status) {
        const requestData = {
            action: 'updateBookingStatus',
            bookingId: bookingId,
            status: status
        };
        
        return await this.sendRequest(requestData);
    }

    /**
     * 🔐 安全的本地存儲操作（支援加密）
     * 
     * 敏感資料自動使用 AES-256-GCM 加密
     * 非敏感資料使用傳統 JSON 儲存
     * 
     * @param {string} key - 存儲鍵值
     * @param {*} defaultValue - 預設值
     * @returns {Promise<*>} - 存儲的值或預設值
     * 
     * @example
     * const data = await ApiService.safeGetLocalStorage('latestCustomerData', {});
     */
    static async safeGetLocalStorage(key, defaultValue = null) {
        try {
            // 定義需要加密的敏感資料鍵值
            const sensitiveKeys = [
                'latestCustomerData',   // 最新客戶資料
                'nailCustomers',        // 客戶列表
                'nailBookings',         // 預約記錄
                'currentBookingInfo',   // 當前預約資訊
                'pendingBookingInfo'    // 待處理預約資訊
            ];
            
            // 檢查是否為敏感資料且支援加密
            if (sensitiveKeys.includes(key) && 
                typeof CryptoUtils !== 'undefined' && 
                CryptoUtils.isSupported()) {
                
                // 🔐 使用加密讀取
                const value = await CryptoUtils.getEncryptedItem(key);
                
                // 如果加密讀取失敗，嘗試讀取舊的明文資料並遷移
                if (value === null) {
                    console.log(`🔍 加密讀取失敗，嘗試讀取舊格式資料：${key}`);
                    const plainItem = localStorage.getItem(key);
                    
                    if (plainItem) {
                        console.log(`📦 找到舊格式資料：${key}，長度：${plainItem.length}`);
                        
                        try {
                            // 嘗試解析明文資料
                            const plainData = JSON.parse(plainItem);
                            console.log(`✅ 成功解析明文資料：${key}`);
                            console.log(`🔄 正在遷移為加密格式...`);
                            
                            // 重新加密儲存
                            const encrypted = await CryptoUtils.setEncryptedItem(key, plainData);
                            
                            if (encrypted) {
                                console.log(`✅ ${key} 已成功遷移為加密格式`);
                            } else {
                                console.warn(`⚠️ ${key} 加密失敗，但仍返回明文資料`);
                            }
                            
                            return plainData;
                        } catch (parseError) {
                            console.error(`❌ 無法解析 ${key}:`, parseError);
                            console.warn(`📝 原始資料（前100字元）：${plainItem.substring(0, 100)}`);
                            
                            // 清除損壞的資料
                            console.log(`🗑️ 清除損壞的資料：${key}`);
                            localStorage.removeItem(key);
                            
                            return defaultValue;
                        }
                    } else {
                        console.log(`📭 ${key} 不存在於 localStorage`);
                    }
                }
                
                return value !== null ? value : defaultValue;
                
            } else {
                // 📦 一般資料（非敏感），使用傳統方式
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            }
            
        } catch (error) {
            console.warn(`讀取 localStorage[${key}] 失敗:`, error);
            return defaultValue;
        }
    }

    /**
     * 🔐 安全的本地存儲設定（支援加密）
     * 
     * 敏感資料自動使用 AES-256-GCM 加密
     * 非敏感資料使用傳統 JSON 儲存
     * 
     * @param {string} key - 存儲鍵值
     * @param {*} value - 要存儲的值
     * @returns {Promise<boolean>} - 是否成功
     * 
     * @example
     * await ApiService.safeSetLocalStorage('latestCustomerData', customerData);
     */
    static async safeSetLocalStorage(key, value) {
        try {
            // 定義需要加密的敏感資料鍵值
            const sensitiveKeys = [
                'latestCustomerData',   // 最新客戶資料
                'nailCustomers',        // 客戶列表
                'nailBookings',         // 預約記錄
                'currentBookingInfo',   // 當前預約資訊
                'pendingBookingInfo'    // 待處理預約資訊
            ];
            
            // 檢查是否為敏感資料且支援加密
            if (sensitiveKeys.includes(key) && 
                typeof CryptoUtils !== 'undefined' && 
                CryptoUtils.isSupported()) {
                
                // 🔐 使用加密儲存
                const success = await CryptoUtils.setEncryptedItem(key, value);
                return success;
                
            } else {
                // 📦 一般資料（非敏感），使用傳統方式
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            }
            
        } catch (error) {
            console.warn(`設定 localStorage[${key}] 失敗:`, error);
            return false;
        }
    }

    /**
     * 🔐 本地存儲回退處理（當 Google Apps Script 無法連接時）
     * 
     * 支援加密儲存敏感資料
     * 
     * @param {Object} data - 原始請求資料
     * @returns {Promise<Object>} - 模擬回應
     */
    static async handleLocalFallback(data) {
        console.log('使用本地存儲回退模式');
        
        switch (data.action) {
            case 'saveCustomer': {
                // 儲存到本地存儲
                const customers = await this.safeGetLocalStorage('nailCustomers', []);
                const existingIndex = customers.findIndex(c => c.phone === data.customer.phone);
                
                if (existingIndex >= 0) {
                    customers[existingIndex] = {
                        ...customers[existingIndex],
                        ...data.customer,
                        lineUserId: data.customer.lineUserId || customers[existingIndex].lineUserId, // 保留或更新LINE User ID
                        updatedAt: new Date().toISOString()
                    };
                } else {
                    customers.push({
                        ...data.customer,
                        lineUserId: data.customer.lineUserId || '', // 加入LINE User ID
                        createdAt: new Date().toISOString()
                    });
                }
                
                await this.safeSetLocalStorage('nailCustomers', customers);
                
                // 更新最新客戶資料，包含LINE User ID
                const latestCustomerData = {
                    ...data.customer,
                    lineUserId: data.customer.lineUserId || ''
                };
                await this.safeSetLocalStorage('latestCustomerData', latestCustomerData);
                
                return {
                    success: true,
                    message: '客戶資料已儲存到本地',
                    isLocal: true
                };
            }

            case 'saveBooking': {
                // 儲存預約到本地存儲
                const bookings = await this.safeGetLocalStorage('nailBookings', []);
                const newBooking = {
                    ...data.booking,
                    lineUserId: data.booking.lineUserId || '', // 加入LINE User ID
                    createdAt: new Date().toISOString()
                };
                
                bookings.push(newBooking);
                await this.safeSetLocalStorage('nailBookings', bookings);
                
                // 更新已預約時段
                const key = `${data.booking.date}_${data.booking.time}`;
                const bookedSlots = await this.safeGetLocalStorage('nailBookingSlots', {});
                bookedSlots[key] = true;
                await this.safeSetLocalStorage('nailBookingSlots', bookedSlots);
                
                return {
                    success: true,
                    message: '預約已儲存到本地',
                    isLocal: true
                };
            }

            case 'getCustomer': {
                // 從本地存儲查詢客戶
                const localCustomers = await this.safeGetLocalStorage('nailCustomers', []);
                const customer = localCustomers.find(c => c.phone === data.phone);
                
                return {
                    success: true,
                    customer: customer || null,
                    isLocal: true
                };
            }

            default:
                return {
                    success: false,
                    error: '本地模式不支援此操作',
                    isLocal: true
                };
        }
    }

    /**
     * 根據LINE User ID驗證客戶是否存在
     * @param {string} lineUserId - LINE User ID
     * @returns {Promise<Object>} - 驗證結果
     */
    static async verifyCustomerByLineId(lineUserId) {
        if (!lineUserId) {
            return { success: false, error: '缺少LINE User ID' };
        }

        const requestData = {
            action: 'verifyCustomerByLineId',
            lineUserId: lineUserId
        };
        
        return await this.sendRequest(requestData);
    }

    /**
     * 根據LINE User ID獲取客戶資料
     * @param {string} lineUserId - LINE User ID
     * @returns {Promise<Object>} - 客戶資料
     */
    static async getCustomerByLineId(lineUserId) {
        if (!lineUserId) {
            return { success: false, error: '缺少LINE User ID' };
        }

        const requestData = {
            action: 'getCustomerByLineId',
            lineUserId: lineUserId
        };
        
        return await this.sendRequest(requestData);
    }

    /**
     * 根據LINE User ID獲取客戶的預約記錄
     * @param {string} lineUserId - LINE User ID
     * @returns {Promise<Object>} - 預約記錄陣列
     */
    static async getCustomerBookings(lineUserId) {
        if (!lineUserId) {
            return { success: false, error: '缺少LINE User ID' };
        }

        const requestData = {
            action: 'getCustomerBookings',
            lineUserId: lineUserId
        };
        
        return await this.sendRequest(requestData);
    }

    /**
     * 取得 Google Calendar 憑證和配置
     * ⚠️ 此方法會取得敏感資訊，僅供前端使用
     * @returns {Promise<Object>} - Google Calendar 憑證和配置
     */
    static async getGoogleCalendarCredentials() {
        const requestData = {
            action: 'getGoogleCalendarCredentials'
        };
        
        return await this.sendRequest(requestData);
    }

    /**
     * 檢查時段可用性
     * @param {string} date - 查詢日期 (YYYY-MM-DD 格式)
     * @param {Array} timeSlots - 要檢查的時段陣列
     * @returns {Promise<Object>} - 時段可用性結果
     */
    static async checkTimeSlotAvailability(date, timeSlots) {
        if (!date || !timeSlots || !Array.isArray(timeSlots)) {
            return { success: false, error: '缺少必要參數' };
        }

        const requestData = {
            action: 'checkTimeSlotAvailability',
            date: date,
            timeSlots: timeSlots
        };
        
        return await this.sendRequest(requestData);
    }

    /**
     * 取得可用時段
     * @param {string} date - 查詢日期 (YYYY-MM-DD 格式)
     * @returns {Promise<Object>} - 可用時段結果
     */
    static async getAvailableTimeSlots(date) {
        if (!date) {
            return { success: false, error: '缺少查詢日期' };
        }

        const requestData = {
            action: 'getAvailableTimeSlots',
            date: date
        };
        
        return await this.sendRequest(requestData);
    }

    /**
     * 批量取得可用時段
     * @param {string} startDate - 開始日期 (YYYY-MM-DD 格式)
     * @param {string} endDate - 結束日期 (YYYY-MM-DD 格式)
     * @returns {Promise<Object>} - 批量可用時段結果
     */
    static async getBatchAvailableTimeSlots(startDate, endDate) {
        if (!startDate || !endDate) {
            return { success: false, error: '缺少開始日期或結束日期' };
        }

        const requestData = {
            action: 'getBatchAvailableTimeSlots',
            startDate: startDate,
            endDate: endDate
        };
        
        return await this.sendRequest(requestData);
    }

    /**
     * 批次查詢多天所有時段的可預約狀態（含衝突檢查）
     * @param {string} startDate - 查詢起始日（YYYY-MM-DD）
     * @param {string} endDate - 查詢結束日（YYYY-MM-DD）
     * @returns {Promise<Object>} - 回應結果，格式同後端
     */
    static async batchCheckTimeSlotAvailability(startDate, endDate) {
        // 準備請求資料
        const data = {
            action: 'handleBatchCheckTimeSlotAvailability',
            startDate,
            endDate
        };
        // 發送請求，回傳結果
        return await this.sendRequest(data);
    }

}

// ==================== 後台管理 API ====================

/**
 * 取得後台管理設定
 * @returns {Promise<Object>} - 設定資料
 */
async function getAdminSettings() {
    console.log('📖 開始取得後台設定');
    
    try {
        const response = await ApiService.sendRequest({
            action: 'getAdminSettings'
        });
        
        if (response.success) {
            console.log('✅ 後台設定取得成功');
            return response;
        } else {
            throw new Error(response.error || '取得設定失敗');
        }
    } catch (error) {
        console.error('❌ 取得後台設定失敗:', error);
        throw error;
    }
}

/**
 * 更新後台管理設定
 * @param {Object} settings - 設定資料
 * @param {string} userId - 用戶ID（管理員）
 * @param {string} csrfToken - CSRF Token
 * @returns {Promise<Object>} - 更新結果
 */
async function updateAdminSettings(settings, userId, csrfToken) {
    console.log('📝 開始更新後台設定');
    
    try {
        const response = await ApiService.sendRequest({
            action: 'updateAdminSettings',
            settings: settings,
            userId: userId,
            csrfToken: csrfToken
        });
        
        if (response.success) {
            console.log('✅ 後台設定更新成功:', response.itemsUpdated, '筆資料');
            return response;
        } else {
            throw new Error(response.error || '更新設定失敗');
        }
    } catch (error) {
        console.error('❌ 更新後台設定失敗:', error);
        throw error;
    }
}

// 匯出供其他檔案使用
window.ApiService = ApiService; 