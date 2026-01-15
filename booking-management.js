/**
 * 預約管理頁面
 * 使用 liff-service.js 統一管理 LIFF 初始化
 */

// 等待頁面載入完成
document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('🚀 預約管理頁面初始化開始...');
        
        // 使用 liff-service.js 進行 LIFF 初始化，使用預約相關的 LIFF ID
        console.log('📱 正在初始化 LIFF...', { liffId: LIFF_CONFIG.LIFF_IDS.BOOKING });
        const liffSuccess = await initLiff(LIFF_CONFIG.LIFF_IDS.BOOKING);
        
        if (!liffSuccess) {
            console.error('❌ LIFF 初始化失敗');
            alert('載入失敗，請重新整理頁面重試');
            return;
        }
        
        console.log('✅ LIFF 初始化成功');
        
        // 驗證用戶登入狀態
        if (!isLiffReady()) {
            console.error('❌ LIFF 未準備就緒');
            alert('請重新進入LINE應用程式');
            return;
        }
        
        // 獲取用戶資訊
        const userId = getLineUserId();
        console.log('👤 用戶ID:', userId);
        
        // 初始化按鈕事件監聽器
        initializeButtons();
        
        // 所有初始化完成後，顯示頁面內容
        showPageContent();
        
        console.log('✅ 預約管理頁面初始化完成');
        
    } catch (error) {
        console.error('💥 預約管理頁面初始化失敗:', error);
        alert('系統載入失敗，請重新整理頁面重試');
    }
});

/**
 * 顯示頁面內容
 */
function showPageContent() {
    const mainContainer = document.getElementById('mainContainer');
    if (mainContainer) {
        mainContainer.style.display = 'block';
        console.log('✅ 頁面內容已顯示');
    }
}

/**
 * 初始化按鈕事件監聽器
 */
function initializeButtons() {
    // 我的預約按鈕
    const myReservationsBtn = document.getElementById('myReservationsBtn');
    if (myReservationsBtn) {
        myReservationsBtn.addEventListener('click', function() {
            console.log('點擊了我的預約按鈕');
            // 導航到我的預約頁面
            window.location.href = 'mybooking.html';
        });
    }
} 