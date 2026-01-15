/**
 * 顧客建檔系統類別
 * 負責處理顧客資料的建檔、驗證、儲存和顯示功能
 */
class CustomerRegistration {
    constructor() {
        // 初始化系統
        this.init();
    }
    
    /**
     * 初始化建檔系統
     * 依序執行LIFF初始化、載入顧客資料、綁定事件
     */
    async init() {
        try {
            await initLiff(); // 使用共用的LIFF初始化
            this.bindEvents(); // 綁定所有事件監聽器
        } catch (error) {
            console.error('初始化失敗:', error);
        }
    }
    
    /**
     * 綁定所有事件監聽器
     * 包括表單提交、模態框關閉、輸入驗證等
     */
    bindEvents() {
        // 表單提交事件
        document.getElementById('customerForm').addEventListener('submit', (e) => {
            e.preventDefault(); // 防止表單預設提交行為
            this.handleFormSubmit();
        });
        
        // 關閉成功提示按鈕事件
        document.getElementById('closeSuccessBtn').addEventListener('click', async () => {
            this.hideModal('successModal');
            await this.handlePostRegistrationRedirect();
        });
        
        // 手機號碼輸入時的即時驗證
        document.getElementById('customerPhone').addEventListener('input', (e) => {
            this.validatePhoneInput(e.target);
        });
        
        // 姓名輸入時的即時驗證
        document.getElementById('customerName').addEventListener('input', (e) => {
            this.validateNameInput(e.target);
        });
    }
    
    /**
     * 處理表單提交
     * 驗證輸入資料並建立顧客檔案
     */
    async handleFormSubmit() {
        const nameInput = document.getElementById('customerName');
        const phoneInput = document.getElementById('customerPhone');
        
        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        
        // 清除之前的錯誤訊息
        this.clearErrors();
        
        // 驗證輸入資料
        const validation = this.validateInputs(name, phone);
        
        if (!validation.isValid) {
            this.displayValidationErrors(validation.errors, { nameInput, phoneInput });
            return;
        }
        
        // 顯示載入狀態
        this.showLoadingState();
        
        try {
            // 如果驗證通過，建立顧客檔案
            await this.createCustomer(name, phone);
        } finally {
            // 無論成功或失敗都要隱藏載入狀態
            this.hideLoadingState();
        }
    }
    
    /**
     * 統一驗證輸入資料
     * @param {string} name - 顧客姓名
     * @param {string} phone - 顧客手機號碼
     * @returns {Object} 驗證結果
     */
    validateInputs(name, phone) {
        const errors = [];
        
        if (!this.validateName(name)) {
            errors.push({ field: 'name', message: '請輸入有效的姓名' });
        }
        
        if (!this.validatePhone(phone)) {
            errors.push({ field: 'phone', message: '請輸入正確的手機號碼格式' });

        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * 顯示驗證錯誤訊息
     * @param {Array} errors - 錯誤陣列
     * @param {Object} inputs - 輸入框元素
     */
    displayValidationErrors(errors, inputs) {
        errors.forEach(error => {
            if (error.field === 'name') {
                this.showError('nameError', error.message);
                inputs.nameInput.classList.add('error');
            } else if (error.field === 'phone') {
                this.showError('phoneError', error.message);
                inputs.phoneInput.classList.add('error');
            }
        });
    }
    
    /**
     * 驗證姓名格式
     * @param {string} name - 要驗證的姓名
     * @returns {boolean} 驗證結果
     */
    validateName(name) {
        // 姓名不能為空，且長度在2-20字之間
        return name.length >= 2 && name.length <= 20;
    }
    
    /**
     * 驗證手機號碼格式
     * @param {string} phone - 要驗證的手機號碼
     * @returns {boolean} 驗證結果
     */
    validatePhone(phone) {
        // 檢查是否為09開頭的10位數字
        const phoneRegex = /^09\d{8}$/;
        return phoneRegex.test(phone);
    }
    

    
    /**
     * 姓名輸入即時驗證
     * @param {HTMLInputElement} input - 姓名輸入框元素
     */
    validateNameInput(input) {
        const name = input.value.trim();
        const errorElement = document.getElementById('nameError');
        
        if (name.length === 0) {
            // 清空時不顯示錯誤
            input.classList.remove('error');
            errorElement.textContent = '';
        } else if (!this.validateName(name)) {
            input.classList.add('error');
            errorElement.textContent = '姓名長度需在2-20字之間';
        } else {
            input.classList.remove('error');
            errorElement.textContent = '';
        }
    }
    
    /**
     * 手機號碼輸入即時驗證
     * @param {HTMLInputElement} input - 手機號碼輸入框元素
     */
    validatePhoneInput(input) {
        let phone = input.value.replace(/\D/g, ''); // 移除非數字字符
        
        // 限制最多10位數字
        if (phone.length > 10) {
            phone = phone.substring(0, 10);
        }
        
        // 更新輸入框值
        input.value = phone;
        
        const errorElement = document.getElementById('phoneError');
        
        if (phone.length === 0) {
            // 清空時不顯示錯誤
            input.classList.remove('error');
            errorElement.textContent = '';
        } else if (!this.validatePhone(phone)) {
            input.classList.add('error');
            if (!phone.startsWith('09')) {
                errorElement.textContent = '手機號碼必須以09開頭';
            } else if (phone.length < 10) {
                errorElement.textContent = '手機號碼必須為10位數';
            }
        } else {
            input.classList.remove('error');
            errorElement.textContent = '';
        }
    }
    
    /**
     * 建立新顧客檔案
     * @param {string} name - 顧客姓名
     * @param {string} phone - 顧客手機號碼
     */
    async createCustomer(name, phone) {
        try {
            // 建立顧客物件，包含LINE User ID
            const customer = {
                name: name,
                phone: phone,
                lineUserId: getLineUserId() // 使用共用的函數獲取User ID
            };
            
            // 使用 API 服務儲存客戶資料到伺服器
            const result = await ApiService.saveCustomer(customer);
            
            if (result.success) {
                // 保存客戶資料到本地存儲，供其他頁面使用
                const customerDataForStorage = {
                    lineUserId: customer.lineUserId,
                    name: customer.name,
                    customerName: customer.name, // 新增相容性欄位
                    phone: customer.phone,
                    createdAt: new Date().toISOString(),
                    lastVerified: new Date().toISOString()
                };
                
                // 使用 ApiService 的安全存儲方法
                ApiService.safeSetLocalStorage('latestCustomerData', customerDataForStorage);
                // 🔒 安全日誌：遮罩敏感資訊
                console.log('✅ 客戶資料已保存到本地存儲:', SecurityUtils.maskSensitiveData(customerDataForStorage));
                
                // 透過 LIFF 發送建檔確認訊息
                await this.sendRegistrationConfirmMessage(customer.phone);
                
                // 顯示成功訊息
                this.showSuccessModal(customer);
                
                // 重置表單
                this.resetForm();
            } else {
                throw new Error(result.error || '建檔失敗');
            }
        } catch (error) {
            console.error('建檔錯誤:', error);
            this.showError('phoneError', '建檔失敗，請稍後再試');
        }
    }
    
    /**
     * 顯示建檔成功的模態框
     * @param {Object} customer - 顧客資料物件
     */
    showSuccessModal(customer) {
        const modal = document.getElementById('successModal');
        const customerInfo = document.getElementById('customerInfo');
        
        // 格式化顯示資訊
        customerInfo.innerHTML = `
            <div><strong>姓名：</strong>${customer.name}</div>
            <div><strong>手機：</strong>${customer.phone}</div>
            <div><strong>建檔時間：</strong>${this.formatDateTime(new Date().toISOString())}</div>
        `;
        
        // 顯示模態框
        modal.classList.remove('hidden');
    }
    
    /**
     * 顯示錯誤訊息
     * @param {string} elementId - 錯誤訊息元素的ID
     * @param {string} message - 錯誤訊息內容
     */
    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        errorElement.textContent = message;
    }
    
    /**
     * 清除所有錯誤訊息和樣式
     */
    clearErrors() {
        // 清除錯誤訊息
        document.getElementById('nameError').textContent = '';
        document.getElementById('phoneError').textContent = '';
        
        // 移除錯誤樣式
        document.getElementById('customerName').classList.remove('error');
        document.getElementById('customerPhone').classList.remove('error');
    }
    
    /**
     * 重置表單到初始狀態
     */
    resetForm() {
        document.getElementById('customerForm').reset();
        this.clearErrors();
    }
    
    /**
     * 隱藏模態框
     * @param {string} modalId - 模態框的ID
     */
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('hidden');
    }
    
    /**
     * 🔐 處理建檔完成後的跳轉邏輯（支援加密）
     * 檢查是否有待處理的預約資訊，決定跳轉目標
     */
    async handlePostRegistrationRedirect() {
        console.log('✅ 客戶建檔完成，檢查跳轉目標...');
        
        // 🔐 檢查是否有待處理的預約資訊（從服務選擇頁面來的）
        const pendingBookingInfo = await ApiService.safeGetLocalStorage('pendingBookingInfo', null);
        
        if (pendingBookingInfo) {
            console.log('📅 發現待處理的預約資訊，返回服務選擇頁面');
            // 🔒 安全日誌：遮罩敏感資訊
            console.log('💾 預約資訊:', SecurityUtils.maskSensitiveData(pendingBookingInfo));
            
            // 🔐 將待處理的預約資訊恢復到正常的預約資訊（加密儲存）
            await ApiService.safeSetLocalStorage('currentBookingInfo', pendingBookingInfo);
            
            // 清除待處理的預約資訊
            localStorage.removeItem('pendingBookingInfo');
            
            console.log('➡️ 導向 service-selection.html');
            window.location.href = 'service-selection.html';
            
        } else {
            console.log('🏠 沒有待處理的預約資訊，返回首頁');
            console.log('➡️ 導向 index.html');
            window.location.href = 'index.html';
        }
    }
    
    /**
     * 格式化日期時間顯示
     * @param {string} isoString - ISO格式的日期字串
     * @returns {string} 格式化後的日期時間字串
     */
    formatDateTime(isoString) {
        const date = new Date(isoString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}/${month}/${day} ${hours}:${minutes}`;
    }
    
    /**
     * 透過 LIFF 發送建檔確認訊息
     * @param {string} phone - 完整的手機號碼
     */
    async sendRegistrationConfirmMessage(phone) {
        try {
            // 檢查 LIFF 是否已初始化且在 LINE 環境中
            if (!window.liff || !window.liff.isLoggedIn()) {
                console.log('📱 LIFF 未登入或非 LINE 環境，跳過發送訊息');
                return;
            }

            // 格式化手機號碼，隱藏中間3位數
            // 例如：0912345678 -> 0912XXX678
            const maskedPhone = this.maskPhoneNumber(phone);
            
            // 建立訊息內容
            const message = {
                type: 'text',
                text: `✅已完成建檔囉！\n手機${maskedPhone}`
            };

            // 透過 LIFF 發送訊息
            await window.liff.sendMessages([message]);
            console.log('📤 建檔確認訊息已發送:', message.text);
            
        } catch (error) {
            // 發送訊息失敗不影響建檔流程，只記錄錯誤
            console.error('⚠️ 發送建檔確認訊息失敗:', error);
        }
    }
    
    /**
     * 隱藏手機號碼中間3位數
     * @param {string} phone - 完整的手機號碼 (例如: 0912345678)
     * @returns {string} 隱藏中間3位數的手機號碼 (例如: 0912XXX678)
     */
    maskPhoneNumber(phone) {
        if (!phone || phone.length !== 10) {
            return phone; // 如果號碼格式不正確，直接返回原值
        }
        
        // 取前4位 + XXX + 後3位
        // 0912345678 -> 0912XXX678
        const prefix = phone.substring(0, 4);  // 0912
        const suffix = phone.substring(7, 10); // 678
        
        return `${prefix}XXX${suffix}`;
    }
    
    /**
     * 顯示載入狀態
     * 禁用表單提交，顯示載入動畫和文字
     */
    showLoadingState() {
        const submitBtn = document.getElementById('submitBtn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        
        // 添加載入中的CSS類別
        submitBtn.classList.add('loading');
        
        // 禁用按鈕
        submitBtn.disabled = true;
        
        // 切換顯示內容：隱藏原始文字，顯示載入狀態
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        
        console.log('🔄 顯示載入狀態');
    }
    
    /**
     * 隱藏載入狀態
     * 重新啟用表單提交，恢復原始按鈕外觀
     */
    hideLoadingState() {
        const submitBtn = document.getElementById('submitBtn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        
        // 移除載入中的CSS類別
        submitBtn.classList.remove('loading');
        
        // 重新啟用按鈕
        submitBtn.disabled = false;
        
        // 切換顯示內容：顯示原始文字，隱藏載入狀態
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        
        console.log('✅ 隱藏載入狀態');
    }

}

// 當頁面載入完成時，初始化顧客建檔系統
document.addEventListener('DOMContentLoaded', () => {
    new CustomerRegistration();
}); 