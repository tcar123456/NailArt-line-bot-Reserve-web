/**
 * 🔐 加密工具模組 - localStorage 資料加密
 * 
 * 功能：
 * 1. AES-256-GCM 加密/解密
 * 2. 安全金鑰管理
 * 3. localStorage 資料保護
 * 
 * 使用場景：
 * - 敏感資料存儲（客戶資料、預約資訊）
 * - 防止 XSS 攻擊竊取資料
 * - 符合資料保護規範
 * 
 * 技術說明：
 * - 使用瀏覽器原生 Web Crypto API
 * - AES-GCM 模式提供加密和認證
 * - 每次加密使用隨機 IV，確保安全性
 * 
 * @version 1.0.0
 * @date 2025-11-13
 */

class CryptoUtils {
    /**
     * 🔑 基礎金鑰種子（用於衍生用戶專屬金鑰）
     * 
     * ⚠️ 安全性說明：
     * 1. 此金鑰作為「種子」，結合用戶 ID 生成專屬金鑰
     * 2. 即使攻擊者看到源碼，仍需要知道目標用戶的 LINE User ID
     * 3. 不同用戶使用不同金鑰，無法互相解密資料
     * 
     * 🛡️ 安全層級分析：
     * - 防護等級：中等（適合中小型應用）
     * - 防護對象：普通窺探、低階攻擊、資料洩漏
     * - 無法防護：專業攻擊者（需要後端加密方案）
     * 
     * 💡 為什麼前端加密仍有意義：
     * 1. 增加攻擊難度：攻擊者需要同時獲得源碼和用戶 ID
     * 2. 資料隔離：用戶之間的資料無法互相解密
     * 3. 符合資料保護最佳實踐：總比明文儲存安全
     * 4. 防止意外洩漏：截圖、日誌、瀏覽器擴充套件等
     * 
     * 🔐 真正的安全防護應包含：
     * - HTTPS 傳輸加密（防網路竊聽）
     * - 後端資料加密（防伺服器洩漏）
     * - 前端加密（防本地窺探和 XSS）
     * - 訪問控制和審計（防內部威脅）
     * 
     * 注意：金鑰長度必須是 32 字元（256 位元）
     */
    static BASE_KEY_SEED = 'NailArtReserve2025SecureKey123!!'; // 32 字元 = 256 位元
    
    /**
     * 🔑 生成用戶專屬金鑰
     * 
     * 原理：
     * 1. 結合基礎種子和用戶 LINE ID
     * 2. 使用 SHA-256 雜湊生成 256 位元金鑰
     * 3. 每個用戶有獨特的加密金鑰
     * 
     * 安全優勢：
     * - 即使攻擊者看到源碼，仍需知道用戶 LINE ID
     * - 不同用戶的資料無法互相解密
     * - 增加暴力破解難度
     * 
     * @param {string} userId - LINE User ID
     * @returns {Promise<CryptoKey>} 用戶專屬的加密金鑰
     * 
     * @example
     * const key = await CryptoUtils.deriveUserKey('U1234567890abcdef');
     */
    static async deriveUserKey(userId) {
        try {
            // 1. 結合基礎種子和用戶 ID
            const keyMaterial = this.BASE_KEY_SEED + userId;
            const keyData = new TextEncoder().encode(keyMaterial);
            
            // 2. 使用 SHA-256 生成雜湊
            const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
            
            // 3. 將雜湊轉換為 CryptoKey
            const key = await crypto.subtle.importKey(
                'raw',
                hashBuffer,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
            
            return key;
            
        } catch (error) {
            console.error('🔑 金鑰生成失敗:', error);
            throw error;
        }
    }
    
    /**
     * 🆔 取得當前用戶 ID（從 localStorage 或 LIFF）
     * 
     * 多層回退機制：
     * 1. 優先從 localStorage 讀取（快速，已快取）
     * 2. 若無快取，嘗試從 LIFF 讀取（需要已初始化）
     * 3. 若都失敗，返回 null（使用固定金鑰回退）
     * 
     * @param {boolean} [silent=true] - 是否靜默模式（不顯示警告）
     * @returns {Promise<string|null>} 用戶 ID，失敗返回 null
     */
    static async getCurrentUserId(silent = true) {
        try {
            // 方法 1：從 localStorage 讀取（優先，快速）
            const cachedUserId = localStorage.getItem('lineUserId');
            if (cachedUserId && cachedUserId.startsWith('U')) {
                // 驗證格式：LINE User ID 以 'U' 開頭
                return cachedUserId;
            }
            
            // 方法 2：從 LIFF 讀取（需要 LIFF 已初始化）
            if (typeof liff !== 'undefined') {
                try {
                    // 檢查 LIFF 是否已初始化且已登入
                    if (liff.isLoggedIn && liff.isLoggedIn()) {
                        const profile = await liff.getProfile();
                        if (profile && profile.userId) {
                            // 快取到 localStorage 以加速後續讀取
                            localStorage.setItem('lineUserId', profile.userId);
                            return profile.userId;
                        }
                    }
                } catch (liffError) {
                    // LIFF 可能尚未初始化，靜默處理
                    if (!silent) {
                        console.warn('⚠️ LIFF 尚未初始化或未登入');
                    }
                }
            }
            
            // 方法 3：無法取得用戶 ID，使用固定金鑰回退（向後相容）
            if (!silent) {
                console.warn('⚠️ 無法取得用戶 ID，將使用固定金鑰（較低安全性，但可解密舊資料）');
            }
            return null;
            
        } catch (error) {
            // 靜默處理錯誤，避免干擾使用者體驗
            if (!silent) {
                console.error('🆔 取得用戶 ID 過程發生錯誤:', error);
            }
            return null;
        }
    }
    
    /**
     * 🔐 加密文字（使用 AES-256-GCM + 用戶專屬金鑰）
     * 
     * AES-GCM 優點：
     * 1. 提供加密和認證（AEAD）
     * 2. 防止資料被篡改
     * 3. 現代瀏覽器原生支援
     * 4. 高效能加密演算法
     * 
     * 🔑 金鑰策略：
     * - 優先使用用戶專屬金鑰（基於 LINE User ID）
     * - 若無法取得用戶 ID，則使用預設金鑰（較低安全性）
     * 
     * @param {string} plainText - 原始文字
     * @param {string} [userId] - 用戶 ID（選填，未提供時自動取得）
     * @returns {Promise<string>} Base64 編碼的加密資料（格式：iv:ciphertext）
     * 
     * @example
     * const encrypted = await CryptoUtils.encrypt('敏感資料');
     * console.log(encrypted); // "dGVzdA==:eW91ciBkYXRh"
     */
    static async encrypt(plainText, userId = null) {
        try {
            // 1. 取得用戶專屬金鑰
            let key;
            
            // 1.1 若未提供 userId，自動取得
            if (!userId) {
                userId = await this.getCurrentUserId();
            }
            
            // 1.2 根據 userId 生成金鑰
            if (userId) {
                // 使用用戶專屬金鑰（較高安全性）
                key = await this.deriveUserKey(userId);
            } else {
                // 使用預設金鑰（相容性回退）
                const keyData = new TextEncoder().encode(this.BASE_KEY_SEED);
                key = await crypto.subtle.importKey(
                    'raw',
                    keyData,
                    { name: 'AES-GCM', length: 256 },
                    false,
                    ['encrypt', 'decrypt']
                );
            }
            
            // 2. 生成隨機 IV (Initialization Vector)
            // IV 必須是唯一的，但不需要保密
            // GCM 模式建議使用 12 字節的 IV
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            // 3. 將原始文字轉換為字節陣列
            const encodedText = new TextEncoder().encode(plainText);
            
            // 4. 執行加密
            const encryptedData = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },  // 演算法和參數
                key,                          // 加密金鑰（用戶專屬）
                encodedText                   // 要加密的資料
            );
            
            // 5. 將 IV 和加密資料組合（格式：iv:ciphertext）
            // 使用 Base64 編碼以便儲存為字串
            const ivBase64 = this.arrayBufferToBase64(iv);
            const encryptedBase64 = this.arrayBufferToBase64(encryptedData);
            
            return `${ivBase64}:${encryptedBase64}`;
            
        } catch (error) {
            console.error('🔐 加密失敗:', error);
            // 加密失敗時返回 null，呼叫者應處理此情況
            return null;
        }
    }
    
    /**
     * 🔓 解密文字（使用 AES-256-GCM + 用戶專屬金鑰 + 向後相容）
     * 
     * 🔑 金鑰策略（多層回退機制）：
     * 1. 優先嘗試用戶專屬金鑰（新版本）
     * 2. 若失敗，回退到固定金鑰（舊版本相容）
     * 3. 確保平滑升級，不會遺失舊資料
     * 
     * 📦 向後相容：
     * - 可以解密舊版本（固定金鑰）的資料
     * - 可以解密新版本（用戶專屬金鑰）的資料
     * - 自動識別並使用正確的金鑰
     * 
     * @param {string} encryptedText - 加密的文字（Base64 格式，包含 IV）
     * @param {string} [userId] - 用戶 ID（選填，未提供時自動取得）
     * @returns {Promise<string|null>} 解密後的原始文字，失敗返回 null
     * 
     * @example
     * const decrypted = await CryptoUtils.decrypt(encrypted);
     * console.log(decrypted); // "敏感資料"
     */
    static async decrypt(encryptedText, userId = null) {
        try {
            // 1. 分離 IV 和加密資料
            const parts = encryptedText.split(':');
            if (parts.length !== 2) {
                console.error('🔓 解密失敗：資料格式錯誤');
                return null;
            }
            
            const [ivBase64, encryptedBase64] = parts;
            
            // 2. 將 Base64 轉換回 ArrayBuffer
            const iv = this.base64ToArrayBuffer(ivBase64);
            const encryptedData = this.base64ToArrayBuffer(encryptedBase64);
            
            // 3. 取得用戶 ID（若未提供）
            if (!userId) {
                userId = await this.getCurrentUserId();
            }
            
            // 4. 多層回退解密策略
            let plainText = null;
            let usedLegacyKey = false;  // 標記是否使用舊版金鑰
            
            // 策略 1：嘗試用戶專屬金鑰（新版本）
            if (userId) {
                try {
                    const userKey = await this.deriveUserKey(userId);
                    const decryptedData = await crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv: iv },
                        userKey,
                        encryptedData
                    );
                    plainText = new TextDecoder().decode(decryptedData);
                    // 成功使用用戶專屬金鑰，不需要日誌（正常情況）
                } catch (userKeyError) {
                    // 用戶專屬金鑰失敗，靜默繼續嘗試固定金鑰
                    // 不輸出日誌，避免干擾（這是預期的回退行為）
                }
            }
            
            // 策略 2：若用戶專屬金鑰失敗，回退到固定金鑰（舊版本相容）
            if (!plainText) {
                try {
                    const legacyKeyData = new TextEncoder().encode(this.BASE_KEY_SEED);
                    const legacyKey = await crypto.subtle.importKey(
                        'raw',
                        legacyKeyData,
                        { name: 'AES-GCM', length: 256 },
                        false,
                        ['encrypt', 'decrypt']
                    );
                    const decryptedData = await crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv: iv },
                        legacyKey,
                        encryptedData
                    );
                    plainText = new TextDecoder().decode(decryptedData);
                    usedLegacyKey = true;  // 標記使用了舊版金鑰
                    // 只在偵錯模式輸出（不干擾正常使用）
                    // console.log('🔄 使用舊版固定金鑰解密（將自動升級）');
                } catch (legacyKeyError) {
                    // 兩種金鑰都失敗，這才是真正的錯誤
                    return null;
                }
            }
            
            return plainText;
            
        } catch (error) {
            console.error('🔓 解密過程發生錯誤:', error);
            // 解密失敗可能原因：
            // 1. 資料已被篡改（GCM 認證失敗）
            // 2. 所有金鑰都不正確
            // 3. 資料損壞或格式錯誤
            return null;
        }
    }
    
    /**
     * 🔐 加密並儲存到 localStorage
     * 
     * 流程：
     * 1. 將資料轉為 JSON
     * 2. 使用 AES-GCM 加密
     * 3. 儲存到 localStorage
     * 
     * @param {string} key - localStorage 的鍵名
     * @param {*} value - 要儲存的值（會先轉為 JSON）
     * @returns {Promise<boolean>} 是否成功
     * 
     * @example
     * await CryptoUtils.setEncryptedItem('customerData', {
     *   name: '王小明',
     *   phone: '0912345678'
     * });
     */
    static async setEncryptedItem(key, value) {
        try {
            // 1. 將值轉換為 JSON 字串
            const jsonString = JSON.stringify(value);
            
            // 2. 加密
            const encrypted = await this.encrypt(jsonString);
            
            if (!encrypted) {
                console.error('🔐 儲存失敗：加密失敗');
                return false;
            }
            
            // 3. 儲存到 localStorage
            localStorage.setItem(key, encrypted);
            
            // 4. 記錄日誌（不顯示敏感資訊）
            console.log(`🔐 已加密儲存：${key}`, {
                加密長度: encrypted.length,
                時間戳記: new Date().toISOString()
            });
            
            return true;
            
        } catch (error) {
            console.error('🔐 加密儲存失敗:', error);
            return false;
        }
    }
    
    /**
     * 🔓 從 localStorage 解密並讀取（含自動升級機制）
     * 
     * 流程：
     * 1. 從 localStorage 讀取加密資料
     * 2. 使用 AES-GCM 解密（支援舊版固定金鑰）
     * 3. 解析 JSON 並返回
     * 4. 🆕 若偵測到使用舊金鑰，自動升級為新金鑰
     * 
     * 📦 自動升級機制：
     * - 讀取時若發現是舊版資料（固定金鑰）
     * - 自動用新版金鑰（用戶專屬）重新加密
     * - 使用者無感升級，資料逐步提升安全性
     * 
     * @param {string} key - localStorage 的鍵名
     * @param {boolean} [autoUpgrade=true] - 是否自動升級舊資料（預設開啟）
     * @returns {Promise<*|null>} 解密後的值，失敗返回 null
     * 
     * @example
     * const customerData = await CryptoUtils.getEncryptedItem('customerData');
     * if (customerData) {
     *   console.log(customerData.name, customerData.phone);
     * }
     */
    static async getEncryptedItem(key, autoUpgrade = true) {
        try {
            // 1. 從 localStorage 讀取
            const encrypted = localStorage.getItem(key);
            
            if (!encrypted) {
                return null;
            }
            
            // 2. 取得當前用戶 ID（用於判斷是否需要升級）
            const userId = await this.getCurrentUserId();
            
            // 3. 解密（支援舊版金鑰回退）
            const decrypted = await this.decrypt(encrypted, userId);
            
            if (!decrypted) {
                console.error(`🔓 解密失敗：${key}（可能是舊資料格式或已損壞）`);
                return null;
            }
            
            // 4. 解析 JSON
            const value = JSON.parse(decrypted);
            
            // 5. 🆕 自動升級機制：若有用戶 ID 且啟用自動升級
            if (autoUpgrade && userId) {
                // 嘗試用用戶專屬金鑰重新加密（驗證是否已是新版）
                try {
                    const userKey = await this.deriveUserKey(userId);
                    const testEncrypt = await this.encrypt(decrypted, userId);
                    
                    // 若成功用用戶金鑰加密，檢查是否與舊資料不同
                    if (testEncrypt && testEncrypt !== encrypted) {
                        // 資料是舊版，需要升級
                        // 用新金鑰重新儲存
                        await this.setEncryptedItem(key, value);
                        
                        console.log(`🔄 資料已自動升級：${key}（舊金鑰 → 用戶專屬金鑰）`);
                    }
                } catch (upgradeError) {
                    // 升級失敗不影響讀取，靜默處理
                    // 只在偵錯模式輸出
                    // console.warn(`⚠️ 資料升級失敗：${key}`, upgradeError);
                }
            }
            
            return value;
            
        } catch (error) {
            console.error(`🔓 解密讀取失敗：${key}`, error);
            return null;
        }
    }
    
    /**
     * 🗑️ 安全刪除 localStorage 項目
     * 
     * @param {string} key - localStorage 的鍵名
     * 
     * @example
     * CryptoUtils.removeEncryptedItem('customerData');
     */
    static removeEncryptedItem(key) {
        try {
            localStorage.removeItem(key);
            console.log(`🗑️ 已刪除加密資料：${key}`);
        } catch (error) {
            console.error('🗑️ 刪除失敗:', error);
        }
    }
    
    /**
     * 🔄 ArrayBuffer 轉 Base64
     * 
     * 用於將二進位資料轉換為可儲存的字串格式
     * 
     * @param {ArrayBuffer|Uint8Array} buffer - 要轉換的資料
     * @returns {string} Base64 字串
     */
    static arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    
    /**
     * 🔄 Base64 轉 ArrayBuffer
     * 
     * 用於將儲存的字串格式轉回二進位資料
     * 
     * @param {string} base64 - Base64 字串
     * @returns {Uint8Array} ArrayBuffer
     */
    static base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    
    /**
     * 🔍 檢查瀏覽器是否支援 Web Crypto API
     * 
     * @returns {boolean} 是否支援
     * 
     * @example
     * if (CryptoUtils.isSupported()) {
     *   console.log('✅ 瀏覽器支援加密功能');
     * } else {
     *   console.warn('⚠️ 瀏覽器不支援加密，將使用明文儲存');
     * }
     */
    static isSupported() {
        return typeof crypto !== 'undefined' 
            && typeof crypto.subtle !== 'undefined';
    }
    
    /**
     * 🔄 遷移舊資料（從明文轉為加密）
     * 
     * 用於系統升級時，將現有的明文資料加密
     * 
     * @param {string} key - localStorage 的鍵名
     * @returns {Promise<boolean>} 是否成功遷移
     * 
     * @example
     * // 系統啟動時自動遷移
     * await CryptoUtils.migrateToEncrypted('latestCustomerData');
     */
    static async migrateToEncrypted(key) {
        try {
            const item = localStorage.getItem(key);
            
            if (!item) {
                return false; // 沒有資料，無需遷移
            }
            
            // 檢查是否已經是加密格式（包含 ":" 分隔符）
            if (item.includes(':') && item.split(':').length === 2) {
                // 可能已經是加密格式，嘗試解密驗證
                const decrypted = await this.decrypt(item);
                if (decrypted) {
                    console.log(`✅ ${key} 已經是加密格式，無需遷移`);
                    return true;
                }
            }
            
            // 嘗試解析為 JSON（明文格式）
            try {
                const data = JSON.parse(item);
                
                // 重新加密儲存
                const success = await this.setEncryptedItem(key, data);
                
                if (success) {
                    console.log(`✅ ${key} 已成功遷移為加密格式`);
                    return true;
                } else {
                    console.error(`❌ ${key} 遷移失敗`);
                    return false;
                }
            } catch (jsonError) {
                console.error(`❌ ${key} 不是有效的 JSON 格式，無法遷移`);
                return false;
            }
            
        } catch (error) {
            console.error(`❌ ${key} 遷移過程發生錯誤:`, error);
            return false;
        }
    }
}

// 🌐 全域使用（瀏覽器環境）
if (typeof window !== 'undefined') {
    window.CryptoUtils = CryptoUtils;
    
    // 🔍 啟動時檢查瀏覽器支援度
    if (!CryptoUtils.isSupported()) {
        console.warn('⚠️ 瀏覽器不支援 Web Crypto API，localStorage 資料將使用明文儲存');
        console.warn('⚠️ 建議使用現代瀏覽器以獲得更好的安全性保護');
    } else {
        console.log('✅ Web Crypto API 已就緒，localStorage 資料將使用 AES-256-GCM 加密');
    }
}

// 📦 模組導出（Node.js 環境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CryptoUtils;
}

