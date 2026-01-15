/**
 * 我的預約頁面 JavaScript 功能模組
 * 使用 liff-service.js 統一管理 LIFF 初始化
 */

// 等待頁面載入完成後初始化系統
document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('🚀 我的預約頁面初始化開始...');
        
        // 使用 liff-service.js 進行 LIFF 初始化，使用預約相關的 LIFF ID
        console.log('📱 正在初始化 LIFF...', { liffId: LIFF_CONFIG.LIFF_IDS.BOOKING });
        const liffSuccess = await initLiff(LIFF_CONFIG.LIFF_IDS.BOOKING);
        
        if (!liffSuccess) {
            console.error('❌ LIFF 初始化失敗');
            // 隱藏載入指示器
            document.getElementById('loadingIndicator').style.display = 'none';
            showErrorState('載入失敗，請重新整理頁面重試');
            return;
        }
        
        console.log('✅ LIFF 初始化成功');
        
        // 驗證用戶登入狀態
        if (!isLiffReady()) {
            console.error('❌ LIFF 未準備就緒');
            document.getElementById('loadingIndicator').style.display = 'none';
            showErrorState('請重新進入LINE應用程式');
            return;
        }
        
        // 獲取用戶資訊
        const userId = getLineUserId();
        // 🔒 安全日誌：遮罩敏感資訊
        console.log('👤 用戶ID:', SecurityUtils.maskUserId(userId));
        
        // 隱藏初始載入指示器
        document.getElementById('loadingIndicator').style.display = 'none';
        
        // 載入用戶的預約資訊
        loadUserBookings();
        
        console.log('✅ 我的預約頁面初始化完成');
        
    } catch (error) {
        console.error('💥 我的預約頁面初始化失敗:', error);
        // 隱藏載入指示器
        document.getElementById('loadingIndicator').style.display = 'none';
        showErrorState('系統載入失敗，請重新整理頁面重試');
    }
});

/**
 * 載入用戶的預約資訊
 */
async function loadUserBookings() {
    try {
        // 顯示載入狀態
        showLoadingState();
        
        // 檢查 LIFF 是否準備就緒
        if (!isLiffReady()) {
            console.warn('LIFF 未準備就緒');
            showErrorState('請先登入 LINE 帳號');
            return;
        }
        
        // 使用 liff-service.js 取得 LINE User ID
        const lineUserId = getLineUserId();
        
        if (!lineUserId) {
            console.warn('無法取得 LINE User ID');
            showErrorState('無法取得用戶資訊');
            return;
        }
        
        // 🔒 安全日誌：遮罩敏感資訊
        console.log('載入用戶預約資訊:', SecurityUtils.maskUserId(lineUserId));
        
        // 呼叫 API 取得預約記錄
        const response = await ApiService.getCustomerBookings(lineUserId);
        
        if (response.success && response.bookings) {
            if (response.bookings.length > 0) {
                // 有預約記錄，顯示預約資訊
                showBookingInfo(response.bookings);
            } else {
                // 沒有預約記錄
                showNoBookingState();
            }
        } else {
            console.error('取得預約記錄失敗:', response.error);
            showErrorState('載入預約資訊失敗');
        }
        
    } catch (error) {
        console.error('載入用戶預約資訊時發生錯誤:', error);
        showErrorState('載入失敗，請稍後再試');
    }
}

// 以台北時區輸出中文日期（YYYY年M月D日（週X））
function formatDateChineseTaipei(dateStr, timeStr) {
    try {
        // ✅ 總是以台北時區格式化，不受裝置或 WebView 時區影響
        // 1) 安全時間字串，若沒有提供時間則使用中午 12:00，避免跨日邊界
        const time = (typeof timeStr === 'string' && /^\d{1,2}:\d{2}$/.test(timeStr)) ? timeStr : '12:00';
        // 2) 明確加上 +08:00，代表這是台北時間的牆鐘時刻（建立一個正確的絕對時間）
        const iso = `${dateStr}T${time}:00+08:00`;
        const d = new Date(iso);
        if (isNaN(d.getTime())) return String(dateStr || '');
        // 3) 使用 Intl.DateTimeFormat 並指定 timeZone: 'Asia/Taipei' 來輸出年月日與星期
        const formatter = new Intl.DateTimeFormat('zh-TW', {
            timeZone: 'Asia/Taipei',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            weekday: 'short'
        });
        const parts = formatter.formatToParts(d);
        const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
        // 4) weekday 可能是「週五」或「星期五」，保留最後一個中文字作為週X
        const weekdayRaw = map.weekday || '';
        const weekdayChar = weekdayRaw.replace('星期', '').replace('週', '');
        return `${map.year}年${map.month}月${map.day}日（${weekdayChar}）`;
    } catch (e) {
        return String(dateStr || '');
    }
}

/**
 * 顯示預約資訊（支援未來預約過濾）
 * @param {Array} bookings - 預約記錄陣列
 */
function showBookingInfo(bookings) {
    // 隱藏載入和無預約狀態
    hideAllStates();
    
    // 生成預約卡片 HTML
    const bookingInfoContainer = document.getElementById('bookingInfoContainer');
    const generatedHTML = generateBookingCardHTML(bookings);
    
    // 🎯 如果過濾後沒有未來預約，顯示無預約狀態
    if (!generatedHTML || generatedHTML.trim() === '') {
        console.log('沒有未來預約，顯示無預約狀態');
        showNoFutureBookingState();
        return;
    }
    
    // 📋 顯示未來預約卡片
    bookingInfoContainer.innerHTML = generatedHTML;
    bookingInfoContainer.style.display = 'block';
    
    // 📊 統計資訊更新
    const futureBookingsCount = (generatedHTML.match(/booking-card/g) || []).length;
    console.log(`顯示 ${futureBookingsCount} 筆未來預約記錄`);
}

/**
 * 顯示載入狀態
 */
function showLoadingState() {
    hideAllStates();
    const loadingContainer = document.getElementById('loadingContainer');
    loadingContainer.style.display = 'block';
}

/**
 * 隱藏所有狀態容器
 */
function hideAllStates() {
    document.getElementById('bookingInfoContainer').style.display = 'none';
    document.getElementById('noBookingContainer').style.display = 'none';
    document.getElementById('loadingContainer').style.display = 'none';
}

/**
 * 顯示無預約狀態
 * 當用戶沒有預約記錄時顯示友好的提示訊息
 */
function showNoBookingState() {
    hideAllStates();
    
    // 顯示無預約狀態，包含圖示、文字和返回按鈕
    const noBookingContainer = document.getElementById('noBookingContainer');
    const noBookingText = noBookingContainer.querySelector('.no-booking-text');
    
    // 確保文字顯示正確的無預約訊息
    noBookingText.textContent = '目前沒有預約記錄';
    noBookingContainer.style.display = 'block';
}

/**
 * 顯示無未來預約狀態
 * 當用戶有預約記錄但都是過去時間時顯示的提示訊息
 */
function showNoFutureBookingState() {
    hideAllStates();
    
    // 顯示無預約狀態，包含圖示、文字和返回按鈕
    const noBookingContainer = document.getElementById('noBookingContainer');
    const noBookingText = noBookingContainer.querySelector('.no-booking-text');
    
    // 顯示沒有未來預約的訊息
    noBookingText.textContent = '目前沒有即將到來的預約';
    noBookingContainer.style.display = 'block';
}

/**
 * 顯示錯誤狀態
 * @param {string} message - 錯誤訊息
 */
function showErrorState(message = '載入失敗，請稍後再試') {
    hideAllStates();
    
    // 獲取無預約容器和其中的文字元素
    const noBookingContainer = document.getElementById('noBookingContainer');
    const noBookingText = noBookingContainer.querySelector('.no-booking-text');
    
    // 修改文字為錯誤訊息
    noBookingText.textContent = message;
    
    // 顯示錯誤狀態容器
    noBookingContainer.style.display = 'block';
}

/**
 * 生成預約卡片 HTML（只顯示未來預約）
 * @param {Array} bookingInfo - 預約資訊陣列
 * @returns {string} 生成的 HTML 字串
 */
function generateBookingCardHTML(bookingInfo) {
    let html = '';
    
    // 🕐 取得當前時間作為過濾基準
    const now = new Date();
    
    // 📅 過濾出未來的預約（包含今天未到時間的預約）
    const futureBookings = bookingInfo.filter(booking => {
        try {
            // 🔧 建立預約的完整日期時間
            // ✅ 明確加上台北時區，避免被瀏覽器誤解為 UTC 造成跨日
            const bookingDateTime = new Date(`${booking.date}T${booking.time}:00+08:00`);
            
            // ✅ 只保留未來時間的預約
            const isFutureBooking = bookingDateTime > now;
            
            // 🔍 調試日誌
            if (!isFutureBooking) {
                console.log(`過濾掉過期預約: ${booking.date} ${booking.time}`, {
                    bookingTime: bookingDateTime.toLocaleString('zh-TW'),
                    currentTime: now.toLocaleString('zh-TW'),
                    isPast: bookingDateTime <= now
                });
            }
            
            return isFutureBooking;
            
        } catch (error) {
            console.warn('日期時間解析失敗，保留此預約:', booking, error);
            return true; // 解析失敗時保留，避免意外過濾
        }
    });
    
    console.log(`原始預約數量: ${bookingInfo.length}, 未來預約數量: ${futureBookings.length}`);
    
    // 🎯 如果沒有未來預約，返回空字串（將觸發無預約狀態顯示）
    if (futureBookings.length === 0) {
        return '';
    }
    
    // 📋 為未來預約生成卡片 HTML
    futureBookings.forEach((booking, index) => {
        // 以台北時區輸出中文日期（避免國外時區裝置顯示成前一天）
        const displayDate = formatDateChineseTaipei(booking.date, booking.time);
        
        // 格式化時間 - 前端額外保護
        let displayTime = booking.time;
        if (displayTime && typeof displayTime === 'string' && displayTime.includes('T')) {
            try {
                const timeObj = new Date(displayTime);
                const hours = timeObj.getHours();
                const minutes = timeObj.getMinutes();
                displayTime = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
            } catch (e) {
                console.warn('前端時間格式化失敗:', displayTime);
                displayTime = booking.time; // 保持原樣
            }
        }
        
        html += `
            <div class="booking-card">
                <div class="booking-details">
                    <!-- 日期時間區域 - 新的2x2格子佈局 -->
                    <div class="datetime-section">
                        <!-- 上左：姓名 -->
                        <div class="booking-detail-item">
                            <span class="booking-detail-label">客戶姓名</span>
                            <span class="booking-detail-value customer-name-value">${SecurityUtils.maskName(booking.customerName) || '未提供姓名'}</span>
                        </div>
                        <!-- 上右：連絡電話 -->
                        <div class="booking-detail-item">
                            <span class="booking-detail-label">連絡電話</span>
                            <span class="booking-detail-value">${SecurityUtils.maskPhone(booking.phone) || '未提供電話'}</span>
                        </div>
                        <!-- 下左：預約日期 -->
                        <div class="booking-detail-item">
                            <span class="booking-detail-label">預約日期</span>
                            <span class="booking-detail-value">${displayDate || '未提供日期'}</span>
                        </div>
                        <!-- 下右：預約時間 -->
                        <div class="booking-detail-item">
                            <span class="booking-detail-label">預約時間</span>
                            <span class="booking-detail-value">${displayTime || '未提供時間'}</span>
                        </div>
                    </div>
                    
                    <!-- 服務項目區域 -->
                    <div class="service-section">
                        <div class="service-section-title">服務項目</div>
                        <div class="service-item">
                            <span class="service-label">服務：</span>
                            <span class="service-value">${booking.services || '無'}</span>
                        </div>
                        <div class="service-item">
                            <span class="service-label">卸甲：</span>
                            <span class="service-value">${booking.removal || '無'}</span>
                        </div>
                        <div class="service-item">
                            <span class="service-label">延甲：</span>
                            <span class="service-value">${booking.quantity || '無'}</span>
                        </div>
                        <div class="service-item">
                            <span class="service-label">備註：</span>
                            <span class="service-value">${booking.remarks || '無'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    return html;
}

 