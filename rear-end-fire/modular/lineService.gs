/**
 * lineService.gs - LINE Bot 整合模組
 * 美甲預約系統 - Google Apps Script
 *
 * 包含：LINE 訊息發送、Token 管理
 */

// ==================== LINE 訊息發送 ====================

/**
 * 發送 LINE 預約確認訊息
 * @param {Object} bookingData - 預約資料
 * @returns {Object} - 發送結果
 */
function sendLineBookingConfirmation(bookingData) {
  try {
    // 檢查 LINE 配置
    if (!LINE_CONFIG.enabled) {
      console.log('LINE 訊息發送功能已停用');
      return { success: false, message: 'LINE 訊息功能已停用' };
    }

    if (!LINE_CONFIG.channelAccessToken) {
      console.error('LINE Channel Access Token 未設定');
      return { success: false, message: 'LINE Token 未設定' };
    }

    if (!bookingData.lineUserId) {
      console.error('缺少 LINE User ID');
      return { success: false, message: '缺少 LINE User ID' };
    }

    // 建立訊息內容
    const message = createLineBookingMessage(bookingData);

    // 準備 API 請求
    const payload = {
      to: bookingData.lineUserId,
      messages: [message]
    };

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + LINE_CONFIG.channelAccessToken
      },
      payload: JSON.stringify(payload)
    };

    // 發送請求
    console.log('發送 LINE 訊息給用戶:', bookingData.lineUserId);
    const response = UrlFetchApp.fetch(LINE_CONFIG.messagingApiUrl, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      console.log('LINE 預約確認訊息發送成功');
      return { success: true, message: 'LINE 訊息發送成功' };
    } else {
      const errorText = response.getContentText();
      console.error('LINE 訊息發送失敗:', responseCode, errorText);
      return { success: false, message: `LINE 訊息發送失敗: ${responseCode}` };
    }

  } catch (error) {
    console.error('發送 LINE 訊息時發生錯誤:', error);
    return { success: false, message: `LINE 訊息發送錯誤: ${error.message}` };
  }
}

/**
 * 建立 LINE 預約確認訊息
 * @param {Object} bookingData - 預約資料
 * @returns {Object} - LINE 訊息物件
 */
function createLineBookingMessage(bookingData) {
  // 格式化日期為中文格式
  let displayDate = bookingData.date;
  if (displayDate) {
    try {
      const dateObj = new Date(displayDate);
      if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const weekday = weekdays[dateObj.getDay()];
        displayDate = `${year}年${month}月${day}日（${weekday}）`;
      }
    } catch (e) {
      console.warn('日期格式化失敗:', displayDate);
    }
  }

  // 建立訊息內容
  let messageText = `🎉 預約成功！\n\n`;
  messageText += `客戶：${bookingData.customerName || '未提供'}\n`;
  messageText += `日期：${displayDate}\n`;
  messageText += `時間：${bookingData.time}\n`;

  // 只顯示非空的服務項目
  if (bookingData.services && bookingData.services.trim() !== '') {
    messageText += `服務：${bookingData.services}\n`;
  }

  // 只顯示非空的卸甲服務
  if (bookingData.removal && bookingData.removal.trim() !== '') {
    messageText += `卸甲：${bookingData.removal}\n`;
  }

  // 延甲資訊
  messageText += `延甲：${bookingData.quantity || '無'}\n`;

  // 備註（只有在有內容時才顯示）
  if (bookingData.remarks && bookingData.remarks.trim() !== '') {
    messageText += `備註：${bookingData.remarks}\n`;
  }

  messageText += `\n感謝您的預約！如有任何需要取消或是更改時間，請透過私訊與我們聯繫，期待為您服務 💕`;

  return {
    type: 'text',
    text: messageText
  };
}

// ==================== LINE Token 管理 ====================

/**
 * 設定 LINE Channel Access Token（僅限管理員使用）
 * @param {string} token - LINE Channel Access Token
 */
function setLineChannelAccessToken(token) {
  if (!token) {
    console.error('請提供 Channel Access Token');
    return;
  }

  try {
    const success = updateConfigurations({
      'LINE_CHANNEL_ACCESS_TOKEN': token
    });

    if (success) {
      console.log('LINE Channel Access Token 已安全儲存');
      console.log('配置快取已自動清理');
      console.log('現在可以安全地將程式碼上傳到 GitHub 了');
    } else {
      console.error('儲存 Token 失敗');
    }
  } catch (error) {
    console.error('儲存 Token 失敗:', error);
  }
}

/**
 * 檢查 LINE Token 設定狀態
 */
function checkLineTokenStatus() {
  const token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');

  if (token) {
    console.log('LINE Channel Access Token 已設定');
    console.log('Token 長度:', token.length);
    console.log('Token 前8位:', token.substring(0, 8) + '...');
  } else {
    console.log('LINE Channel Access Token 尚未設定');
    console.log('請執行 setLineChannelAccessToken() 函數來設定');
  }
}

/**
 * 檢查所有指令碼屬性設定狀態
 */
function checkScriptProperties() {
  console.log('=== 指令碼屬性設定狀態檢查 ===');

  const properties = PropertiesService.getScriptProperties().getProperties();

  // 檢查 Google Calendar ID
  const calendarId = properties['GOOGLE_CALENDAR_ID'];
  if (calendarId) {
    console.log('GOOGLE_CALENDAR_ID 已設定');
    console.log('Calendar ID:', calendarId);
  } else {
    console.log('GOOGLE_CALENDAR_ID 尚未設定');
  }

  // 檢查通知 Email
  const notificationEmail = properties['NOTIFICATION_EMAIL'];
  if (notificationEmail) {
    console.log('NOTIFICATION_EMAIL 已設定');
    console.log('Email:', notificationEmail);
  } else {
    console.log('NOTIFICATION_EMAIL 尚未設定');
  }

  // 檢查 LINE Token
  const lineToken = properties['LINE_CHANNEL_ACCESS_TOKEN'];
  if (lineToken) {
    console.log('LINE_CHANNEL_ACCESS_TOKEN 已設定');
    console.log('Token 長度:', lineToken.length);
    console.log('Token 前8位:', lineToken.substring(0, 8) + '...');
  } else {
    console.log('LINE_CHANNEL_ACCESS_TOKEN 尚未設定');
  }

  console.log('=== 檢查完成 ===');
}
