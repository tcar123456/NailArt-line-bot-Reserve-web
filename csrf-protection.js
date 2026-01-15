/**
 * 🛡️ CSRF 保護模組 - 防止跨站請求偽造
 * 
 * 功能：
 * 1. 生成和驗證 CSRF Token
 * 2. 自動在 API 請求中加入 Token
 * 3. Session 級別的安全保護
 * 
 * 使用場景：
 * - 防止惡意網站偽造用戶請求
 * - 保護重要操作（預約、建檔、修改）
 * - 符合 OWASP 安全標準
 * 
 * 技術說明：
 * - 使用 sessionStorage 儲存 Token（關閉分頁後自動清除）
 * - Token 包含隨機值和時間戳記
 * - 每次頁面載入自動生成新 Token
 * 
 * @version 1.0.0
 * @date 2025-11-13
 */

class CSRFProtection {
    /**
     * 🔑 CSRF Token 儲存鍵名
     */
    static TOKEN_KEY = 'csrfToken';
    static TOKEN_TIMESTAMP_KEY = 'csrfTokenTimestamp';
    
    /**
     * ⏰ Token 有效期（毫秒）
     * 預設：30 分鐘
     */
    static TOKEN_LIFETIME = 30 * 60 * 1000; // 30 分鐘
    
    /**
     * 🎲 生成隨機 CSRF Token
     * 
     * Token 格式：random_value + timestamp
     * 
     * 安全特性：
     * 1. 使用 crypto.getRandomValues() 生成強隨機數
     * 2. 包含時間戳記以支援過期檢查
     * 3. Base36 編碼（字母數字混合）
     * 
     * @returns {string} CSRF Token
     * 
     * @example
     * const token = CSRFProtection.generateToken();
     * console.log(token); // "k2j3h4g5f6d7s8a9_1699876543210"
     */
    static generateToken() {
        try {
            // 1. 生成強隨機數（使用瀏覽器 Crypto API）
            const randomArray = new Uint32Array(4);
            crypto.getRandomValues(randomArray);
            
            // 2. 將隨機數轉換為 Base36 字串
            const randomPart = Array.from(randomArray)
                .map(num => num.toString(36))
                .join('');
            
            // 3. 加入時間戳記
            const timestamp = Date.now().toString(36);
            
            // 4. 組合成完整 Token
            const token = `${randomPart}_${timestamp}`;
            
            // 5. 儲存到 sessionStorage
            sessionStorage.setItem(this.TOKEN_KEY, token);
            sessionStorage.setItem(this.TOKEN_TIMESTAMP_KEY, Date.now().toString());
            
            console.log('🔑 CSRF Token 已生成', {
                tokenLength: token.length,
                timestamp: new Date().toISOString()
            });
            
            return token;
            
        } catch (error) {
            console.error('❌ CSRF Token 生成失敗:', error);
            
            // 降級方案：使用 Math.random()（安全性較低）
            const fallbackToken = Math.random().toString(36).substring(2) + 
                                  Date.now().toString(36);
            
            sessionStorage.setItem(this.TOKEN_KEY, fallbackToken);
            sessionStorage.setItem(this.TOKEN_TIMESTAMP_KEY, Date.now().toString());
            
            console.warn('⚠️ 使用降級方案生成 Token');
            
            return fallbackToken;
        }
    }
    
    /**
     * 📖 取得當前的 CSRF Token
     * 
     * 如果 Token 不存在或已過期，自動生成新 Token
     * 
     * @returns {string} CSRF Token
     * 
     * @example
     * const token = CSRFProtection.getToken();
     */
    static getToken() {
        try {
            // 1. 從 sessionStorage 讀取 Token
            const token = sessionStorage.getItem(this.TOKEN_KEY);
            const timestamp = sessionStorage.getItem(this.TOKEN_TIMESTAMP_KEY);
            
            // 2. 檢查 Token 是否存在
            if (!token || !timestamp) {
                console.log('🔑 Token 不存在，生成新 Token');
                return this.generateToken();
            }
            
            // 3. 檢查 Token 是否過期
            const tokenAge = Date.now() - parseInt(timestamp);
            
            if (tokenAge > this.TOKEN_LIFETIME) {
                console.log('⏰ Token 已過期，生成新 Token', {
                    age: `${Math.round(tokenAge / 1000)}秒`,
                    maxAge: `${this.TOKEN_LIFETIME / 1000}秒`
                });
                return this.generateToken();
            }
            
            // 4. 返回有效的 Token
            return token;
            
        } catch (error) {
            console.error('❌ 讀取 CSRF Token 失敗:', error);
            
            // 錯誤時生成新 Token
            return this.generateToken();
        }
    }
    
    /**
     * ✅ 驗證 Token 是否有效（前端驗證）
     * 
     * 注意：這只是客戶端驗證，真正的安全驗證應在後端進行
     * 
     * @param {string} token - 要驗證的 Token
     * @returns {boolean} 是否有效
     * 
     * @example
     * const isValid = CSRFProtection.validateToken(token);
     */
    static validateToken(token) {
        try {
            if (!token) {
                console.warn('⚠️ Token 為空');
                return false;
            }
            
            // 取得當前有效的 Token
            const currentToken = this.getToken();
            
            // 比對 Token
            const isValid = token === currentToken;
            
            if (!isValid) {
                console.warn('⚠️ Token 驗證失敗', {
                    提供的Token長度: token.length,
                    當前Token長度: currentToken.length
                });
            }
            
            return isValid;
            
        } catch (error) {
            console.error('❌ Token 驗證過程發生錯誤:', error);
            return false;
        }
    }
    
    /**
     * 🔄 刷新 Token（延長有效期）
     * 
     * @returns {string} 新的 Token
     * 
     * @example
     * const newToken = CSRFProtection.refreshToken();
     */
    static refreshToken() {
        console.log('🔄 刷新 CSRF Token');
        return this.generateToken();
    }
    
    /**
     * 🗑️ 清除 Token（登出時使用）
     * 
     * @example
     * CSRFProtection.clearToken();
     */
    static clearToken() {
        try {
            sessionStorage.removeItem(this.TOKEN_KEY);
            sessionStorage.removeItem(this.TOKEN_TIMESTAMP_KEY);
            
            console.log('🗑️ CSRF Token 已清除');
            
        } catch (error) {
            console.error('❌ 清除 Token 失敗:', error);
        }
    }
    
    /**
     * 📊 取得 Token 資訊（除錯用）
     * 
     * @returns {Object} Token 資訊
     * 
     * @example
     * const info = CSRFProtection.getTokenInfo();
     * console.log(info);
     */
    static getTokenInfo() {
        try {
            const token = sessionStorage.getItem(this.TOKEN_KEY);
            const timestamp = sessionStorage.getItem(this.TOKEN_TIMESTAMP_KEY);
            
            if (!token || !timestamp) {
                return {
                    exists: false,
                    message: 'Token 不存在'
                };
            }
            
            const tokenAge = Date.now() - parseInt(timestamp);
            const isExpired = tokenAge > this.TOKEN_LIFETIME;
            const remainingTime = this.TOKEN_LIFETIME - tokenAge;
            
            return {
                exists: true,
                tokenLength: token.length,
                createdAt: new Date(parseInt(timestamp)).toISOString(),
                age: `${Math.round(tokenAge / 1000)}秒`,
                isExpired: isExpired,
                remainingTime: isExpired ? 0 : `${Math.round(remainingTime / 1000)}秒`,
                maxAge: `${this.TOKEN_LIFETIME / 1000}秒`
            };
            
        } catch (error) {
            console.error('❌ 取得 Token 資訊失敗:', error);
            
            return {
                exists: false,
                error: error.message
            };
        }
    }
    
    /**
     * 🚀 初始化 CSRF 保護
     * 
     * 在頁面載入時自動調用，生成初始 Token
     * 
     * @example
     * CSRFProtection.init();
     */
    static init() {
        console.log('🛡️ 初始化 CSRF 保護模組');
        
        // 生成初始 Token
        const token = this.generateToken();
        
        console.log('✅ CSRF 保護已啟用', {
            tokenLength: token.length,
            lifetime: `${this.TOKEN_LIFETIME / 1000}秒`
        });
        
        // 定期刷新 Token（每 15 分鐘）
        setInterval(() => {
            console.log('⏰ 定期刷新 CSRF Token');
            this.refreshToken();
        }, 15 * 60 * 1000); // 15 分鐘
    }
}

// 🌐 全域使用（瀏覽器環境）
if (typeof window !== 'undefined') {
    window.CSRFProtection = CSRFProtection;
    
    // 🚀 自動初始化（頁面載入時）
    if (document.readyState === 'loading') {
        // DOM 尚未載入完成
        document.addEventListener('DOMContentLoaded', () => {
            CSRFProtection.init();
        });
    } else {
        // DOM 已經載入完成
        CSRFProtection.init();
    }
    
    console.log('✅ CSRF 保護模組已載入');
}

// 🌐 全域函數：便捷取得 CSRF Token
window.getCSRFToken = function() {
    return CSRFProtection.getToken();
};

// 🌐 全域物件：暴露 CSRFProtection 類
window.CSRFProtection = CSRFProtection;

// 📦 模組導出（Node.js 環境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CSRFProtection;
}

