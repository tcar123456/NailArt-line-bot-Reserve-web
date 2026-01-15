/**
 * 🔒 安全工具模組 - 敏感資料保護
 * 
 * 功能：
 * 1. 資料遮罩（Data Masking）
 * 2. 安全日誌輸出
 * 3. 敏感資訊過濾
 * 
 * 使用場景：
 * - console.log 輸出時遮罩敏感資訊
 * - 顯示資料時保護隱私
 * - 錯誤訊息中移除敏感內容
 * 
 * @version 1.0.0
 * @date 2025-11-13
 */

class SecurityUtils {
    /**
     * 🔒 遮罩手機號碼
     * 
     * @param {string} phone - 完整的手機號碼（例如：0912345678）
     * @returns {string} 遮罩後的手機號碼（例如：0912***678）
     * 
     * @example
     * SecurityUtils.maskPhone('0912345678')  // "0912***678"
     * SecurityUtils.maskPhone('09123')       // "09123" (格式不正確，直接返回)
     * SecurityUtils.maskPhone(null)          // ""
     */
    static maskPhone(phone) {
        // 輸入驗證
        if (!phone) return '';
        
        // 轉換為字串
        const phoneStr = String(phone);
        
        // 檢查長度（台灣手機號碼為 10 位數）
        if (phoneStr.length !== 10) {
            // 格式不正確，返回部分遮罩
            if (phoneStr.length > 4) {
                return phoneStr.substring(0, 4) + '***';
            }
            return phoneStr;
        }
        
        // 標準遮罩：保留前 4 位和後 3 位
        // 0912345678 → 0912***678
        const prefix = phoneStr.substring(0, 4);  // 0912
        const suffix = phoneStr.substring(7, 10); // 678
        
        return `${prefix}***${suffix}`;
    }
    
    /**
     * 🔒 遮罩 LINE User ID
     * 
     * @param {string} userId - 完整的 LINE User ID（例如：U1234567890abcdef）
     * @returns {string} 遮罩後的 User ID（例如：U123***cdef）
     * 
     * @example
     * SecurityUtils.maskUserId('U1234567890abcdef')  // "U123***cdef"
     * SecurityUtils.maskUserId('U12')                // "U12" (太短，直接返回)
     * SecurityUtils.maskUserId(null)                 // ""
     */
    static maskUserId(userId) {
        // 輸入驗證
        if (!userId) return '';
        
        // 轉換為字串
        const userIdStr = String(userId);
        
        // 檢查長度（LINE User ID 通常為 33 字元）
        if (userIdStr.length < 10) {
            // 太短，只顯示開頭
            return userIdStr.substring(0, 3) + '***';
        }
        
        // 標準遮罩：保留前 4 位和後 4 位
        // U1234567890abcdef → U123***cdef
        const prefix = userIdStr.substring(0, 4);
        const suffix = userIdStr.substring(userIdStr.length - 4);
        
        return `${prefix}***${suffix}`;
    }
    
    /**
     * 🔒 遮罩姓名
     * 
     * @param {string} name - 完整姓名（例如：王小明）
     * @returns {string} 遮罩後的姓名（例如：王**）
     * 
     * @example
     * SecurityUtils.maskName('王小明')    // "王**"
     * SecurityUtils.maskName('王')        // "王" (單字，不遮罩)
     * SecurityUtils.maskName('John Doe')  // "J***"
     */
    static maskName(name) {
        // 輸入驗證
        if (!name) return '';
        
        // 轉換為字串並去除空白
        const nameStr = String(name).trim();
        
        // 如果只有一個字，不遮罩
        if (nameStr.length <= 1) {
            return nameStr;
        }
        
        // 中文姓名：保留姓氏
        // 王小明 → 王**
        if (/[\u4e00-\u9fa5]/.test(nameStr)) {
            return nameStr.substring(0, 1) + '*'.repeat(nameStr.length - 1);
        }
        
        // 英文姓名：保留第一個字母
        // John Doe → J***
        return nameStr.substring(0, 1) + '***';
    }
    
    /**
     * 🔒 遮罩電子郵件
     * 
     * @param {string} email - 完整電子郵件（例如：user@example.com）
     * @returns {string} 遮罩後的電子郵件（例如：u***@example.com）
     * 
     * @example
     * SecurityUtils.maskEmail('user@example.com')     // "u***@example.com"
     * SecurityUtils.maskEmail('test@gmail.com')       // "t***@gmail.com"
     */
    static maskEmail(email) {
        // 輸入驗證
        if (!email) return '';
        
        // 轉換為字串
        const emailStr = String(email);
        
        // 檢查是否包含 @
        if (!emailStr.includes('@')) {
            return emailStr.substring(0, 1) + '***';
        }
        
        // 分割 @ 前後
        const [localPart, domain] = emailStr.split('@');
        
        // 遮罩本地部分
        const maskedLocal = localPart.substring(0, 1) + '***';
        
        return `${maskedLocal}@${domain}`;
    }
    
    /**
     * 🔒 遮罩客戶物件中的敏感資訊
     * 
     * 用於安全地記錄或顯示客戶資料
     * 
     * @param {Object} customer - 客戶物件
     * @returns {Object} 遮罩後的客戶物件
     * 
     * @example
     * const customer = {
     *   name: '王小明',
     *   phone: '0912345678',
     *   lineUserId: 'U1234567890abcdef'
     * };
     * 
     * SecurityUtils.maskCustomer(customer);
     * // {
     * //   name: '王**',
     * //   phone: '0912***678',
     * //   lineUserId: 'U123***cdef'
     * // }
     */
    static maskCustomer(customer) {
        // 輸入驗證
        if (!customer || typeof customer !== 'object') {
            return {};
        }
        
        // 創建遮罩後的副本
        const masked = { ...customer };
        
        // 遮罩各個欄位
        if (masked.name) {
            masked.name = this.maskName(masked.name);
        }
        
        if (masked.phone) {
            masked.phone = this.maskPhone(masked.phone);
        }
        
        if (masked.lineUserId) {
            masked.lineUserId = this.maskUserId(masked.lineUserId);
        }
        
        if (masked.email) {
            masked.email = this.maskEmail(masked.email);
        }
        
        return masked;
    }
    
    /**
     * 🔒 安全的日誌輸出
     * 
     * 自動遮罩常見的敏感欄位後再輸出到 console
     * 
     * @param {string} message - 日誌訊息
     * @param {*} data - 要輸出的資料（會自動遮罩）
     * @param {string} level - 日誌等級（log/warn/error）
     * 
     * @example
     * SecurityUtils.safeLog('客戶資料', {
     *   name: '王小明',
     *   phone: '0912345678'
     * });
     * // 輸出: "客戶資料 { name: '王**', phone: '0912***678' }"
     */
    static safeLog(message, data = null, level = 'log') {
        // 如果沒有資料，直接輸出訊息
        if (!data) {
            console[level](message);
            return;
        }
        
        // 遮罩資料
        const maskedData = this.maskSensitiveData(data);
        
        // 輸出
        console[level](message, maskedData);
    }
    
    /**
     * 🔒 遮罩資料中的敏感欄位
     * 
     * 遞迴處理物件，自動遮罩已知的敏感欄位
     * 
     * @param {*} data - 任何類型的資料
     * @returns {*} 遮罩後的資料
     * 
     * 敏感欄位列表：
     * - phone, phoneNumber, mobile, tel
     * - lineUserId, userId, user_id
     * - name, userName, customerName
     * - email, emailAddress
     */
    static maskSensitiveData(data) {
        // Null 或 undefined
        if (data == null) {
            return data;
        }
        
        // 基本類型（數字、字串、布林值）
        if (typeof data !== 'object') {
            return data;
        }
        
        // 陣列
        if (Array.isArray(data)) {
            return data.map(item => this.maskSensitiveData(item));
        }
        
        // 物件
        const masked = {};
        
        for (const [key, value] of Object.entries(data)) {
            // 檢查是否為敏感欄位（不區分大小寫）
            const lowerKey = key.toLowerCase();
            
            // 手機號碼欄位
            if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey === 'tel') {
                masked[key] = this.maskPhone(value);
            }
            // LINE User ID 欄位
            else if (lowerKey.includes('lineuserid') || lowerKey.includes('userid') || lowerKey === 'user_id') {
                masked[key] = this.maskUserId(value);
            }
            // 姓名欄位
            else if (lowerKey === 'name' || lowerKey.includes('username') || lowerKey.includes('customername')) {
                masked[key] = this.maskName(value);
            }
            // 電子郵件欄位
            else if (lowerKey.includes('email')) {
                masked[key] = this.maskEmail(value);
            }
            // 其他欄位：遞迴處理
            else if (typeof value === 'object') {
                masked[key] = this.maskSensitiveData(value);
            }
            // 非敏感欄位：保持原值
            else {
                masked[key] = value;
            }
        }
        
        return masked;
    }
    
    /**
     * 🔒 檢查字串是否包含敏感資訊
     * 
     * 用於驗證輸出內容是否安全
     * 
     * @param {string} text - 要檢查的文字
     * @returns {Object} 檢查結果
     * 
     * @example
     * SecurityUtils.containsSensitiveInfo('手機號碼：0912345678');
     * // { 
     * //   hasSensitiveInfo: true, 
     * //   types: ['phone'],
     * //   message: '包含敏感資訊：phone'
     * // }
     */
    static containsSensitiveInfo(text) {
        if (!text) {
            return { hasSensitiveInfo: false, types: [] };
        }
        
        const textStr = String(text);
        const foundTypes = [];
        
        // 檢查手機號碼模式（台灣）
        if (/09\d{8}/.test(textStr)) {
            foundTypes.push('phone');
        }
        
        // 檢查 LINE User ID 模式
        if (/U[0-9a-f]{32}/i.test(textStr)) {
            foundTypes.push('lineUserId');
        }
        
        // 檢查電子郵件模式
        if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(textStr)) {
            foundTypes.push('email');
        }
        
        return {
            hasSensitiveInfo: foundTypes.length > 0,
            types: foundTypes,
            message: foundTypes.length > 0 
                ? `包含敏感資訊：${foundTypes.join(', ')}` 
                : '無敏感資訊'
        };
    }
}

// 🌐 全域使用（瀏覽器環境）
if (typeof window !== 'undefined') {
    window.SecurityUtils = SecurityUtils;
}

// 📦 模組導出（Node.js 環境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityUtils;
}


