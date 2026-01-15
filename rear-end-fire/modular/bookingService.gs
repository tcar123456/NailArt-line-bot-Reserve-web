/**
 * bookingService.gs - 預約服務模組
 * 美甲預約系統 - Google Apps Script
 *
 * 包含：預約儲存、預約狀態更新、後端時段驗證
 */

// ==================== 預約儲存 ====================

/**
 * 處理預約儲存
 * @param {Object} booking - 預約資料
 * @returns {Object} - 處理結果
 */
function handleSaveBooking(booking) {
  const bookingStartTime = Date.now();
  Logger.api('開始處理預約儲存', { customerName: booking.customerName, date: booking.date, time: booking.time }, 'booking');

  // 使用 Document Lock 避免並發寫入
  const bookingLock = LockService.getDocumentLock();
  try {
    bookingLock.waitLock(30000);
  } catch (lockError) {
    console.error('無法取得預約鎖定:', lockError);
    return {
      success: false,
      error: 'LOCK_TIMEOUT',
      message: '目前預約人數較多，請稍後再試',
      timestamp: new Date().toISOString()
    };
  }

  try {
    // 預約資料驗證
    if (!booking || typeof booking !== 'object') {
      throw new Error('預約資料格式錯誤');
    }

    const requiredFields = ['customerName', 'phone', 'date', 'time'];
    for (const field of requiredFields) {
      if (!booking[field]) {
        throw new Error(`缺少必要欄位: ${field}`);
      }
    }

    // 日期格式驗證
    const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
    if (!DATE_REGEX.test(booking.date) || /[TZ]/i.test(booking.date)) {
      throw new Error(`無效的日期格式: ${booking.date}，請使用 YYYY-MM-DD 格式`);
    }

    // 時間格式驗證
    if (!SYSTEM_CONFIG.TIME_FORMAT_REGEX.test(booking.time)) {
      throw new Error(`無效的時間格式: ${booking.time}，請使用 HH:MM 格式`);
    }

    // 後端二次驗證時段可用性
    const backendSlotCheck = verifyBackendTimeSlotAvailability(booking.date, booking.time);
    if (!backendSlotCheck.available) {
      console.warn('後端時段檢查未通過:', backendSlotCheck);
      return {
        success: false,
        error: backendSlotCheck.errorCode || 'TIME_SLOT_UNAVAILABLE',
        message: backendSlotCheck.message || '該時段已被占用，請重新選擇',
        conflictDetails: backendSlotCheck.slotStatus,
        timestamp: new Date().toISOString()
      };
    }

    // 根據預約日期年份取得對應的工作表
    const bookingSheetName = getBookingSheetNameByDate(booking.date);
    const bookingSheet = getSheet(bookingSheetName);
    const customerSheet = getSheet(CUSTOMER_SHEET_NAME);

    Logger.log('預約將寫入工作表: ' + bookingSheetName, { date: booking.date }, 'booking');

    clearCustomerCache();

    const now = new Date();
    const services = booking.serviceText || booking.services || booking.service || '';

    // 查找客戶的 LINE User ID
    let lineUserId = '';
    if (booking.phone) {
      const customerRowIndex = findCustomerByPhone(booking.phone);
      if (customerRowIndex > 0) {
        lineUserId = customerSheet.getRange(customerRowIndex, 1).getValue() || '';
      }
    }

    // 格式化預約日期
    let formattedDate = booking.date;
    try {
      const parts = booking.date.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        formattedDate = `${year}年${month}月${day}日`;
      }
    } catch (e) {
      formattedDate = booking.date;
    }

    // 準備要寫入的資料
    const rowData = [
      lineUserId,
      booking.customerName,
      `'${booking.phone}`,
      formattedDate,
      booking.time,
      services,
      booking.removalText || booking.removal || '',
      (booking.quantityText || booking.quantity) ? (booking.quantityText || booking.quantity) : '無',
      booking.remarks || '',
      now
    ];

    // 新增預約記錄
    const newBookingRow = bookingSheet.getLastRow() + 1;
    bookingSheet.appendRow(rowData);

    // 設定手機欄位格式
    const bookingPhoneCell = bookingSheet.getRange(newBookingRow, 3);
    bookingPhoneCell.setNumberFormat('@');
    bookingPhoneCell.setValue(booking.phone);

    clearBookingCache();

    Logger.log('預約資料已寫入試算表', null, 'booking');
    SpreadsheetApp.flush();

    // 更新客戶預約資訊
    updateCustomerBookingInfo(booking.phone, now);

    Utilities.sleep(500);

    // 建立 Google 日曆活動
    let calendarEventResult = null;
    try {
      const calendarData = {
        customerName: booking.customerName,
        phone: booking.phone,
        date: booking.date,
        time: booking.time,
        services: services,
        removal: booking.removal || '',
        quantity: booking.quantity || '',
        remarks: booking.remarks || ''
      };

      calendarEventResult = createCalendarEvent(calendarData);

      if (calendarEventResult && calendarEventResult.success) {
        // 將 Event ID 寫入試算表
        try {
          bookingSheet.getRange(newBookingRow, 11).setValue(calendarEventResult.eventId);
        } catch (updateError) {
          console.error('寫入 Event ID 到試算表失敗:', updateError);
        }

        // 發送預約通知
        try {
          const emailBookingData = {
            customerName: booking.customerName,
            phone: booking.phone,
            date: booking.date,
            time: booking.time,
            services: booking.serviceText || services,
            removal: booking.removalText || booking.removal,
            quantity: (booking.quantityText || booking.quantity) || '無',
            remarks: booking.remarks
          };
          sendBookingNotification(emailBookingData, calendarEventResult);
        } catch (notificationError) {
          console.error('發送通知失敗:', notificationError);
        }
      }

    } catch (calendarError) {
      console.error('建立Google日曆活動時發生錯誤:', calendarError);
      calendarEventResult = {
        success: false,
        error: calendarError.message,
        message: '日曆活動建立失敗，但預約資料已儲存'
      };
    }

    // 發送 LINE 預約確認訊息
    let lineMessageResult = null;
    try {
      const lineBookingData = {
        lineUserId: booking.lineUserId,
        customerName: booking.customerName,
        phone: booking.phone,
        date: booking.date,
        time: booking.time,
        services: booking.serviceText || services,
        removal: booking.removalText || booking.removal,
        quantity: (booking.quantityText || booking.quantity) || '無',
        remarks: booking.remarks
      };

      lineMessageResult = sendLineBookingConfirmation(lineBookingData);
    } catch (lineError) {
      console.error('發送 LINE 訊息時發生錯誤:', lineError);
      lineMessageResult = { success: false, message: `LINE 訊息發送錯誤: ${lineError.message}` };
    }

    const result = {
      success: true,
      message: '預約儲存成功',
      calendarEvent: calendarEventResult,
      lineMessage: lineMessageResult,
      bookingData: {
        customerName: booking.customerName,
        phone: booking.phone,
        date: booking.date,
        time: booking.time,
        services: services
      },
      timestamp: new Date().toISOString()
    };

    Logger.performance('預約處理完成', bookingStartTime, 'booking');
    return result;

  } catch (error) {
    console.error('儲存預約資料時發生嚴重錯誤:', error);
    throw error;

  } finally {
    bookingLock.releaseLock();
    console.log('已釋放預約鎖定');
  }
}

// ==================== 後端時段驗證 ====================

/**
 * 在後端再次確認指定日期與時間是否仍可預約
 * @param {string} dateStr - 預約日期（YYYY-MM-DD）
 * @param {string} timeStr - 預約時間（HH:MM）
 * @returns {Object} - 驗證結果
 */
function verifyBackendTimeSlotAvailability(dateStr, timeStr) {
  console.log('後端二次驗證開始');

  const defaultResponse = {
    available: false,
    errorCode: 'TIME_SLOT_CHECK_FAILED',
    slotStatus: null,
    message: '系統忙碌中，請稍後再試',
    date: dateStr,
    time: timeStr
  };

  try {
    if (!dateStr || !timeStr) {
      defaultResponse.errorCode = 'MISSING_SLOT_PARAMS';
      defaultResponse.message = '缺少時段參數，無法完成預約';
      return defaultResponse;
    }

    if (!CALENDAR_CONFIG.calendarId || CALENDAR_CONFIG.calendarId === 'YOUR_CALENDAR_ID@gmail.com') {
      defaultResponse.errorCode = 'CALENDAR_NOT_CONFIGURED';
      defaultResponse.message = '預約日曆尚未設定，請聯絡系統管理員';
      return defaultResponse;
    }

    const queryDate = createTaipeiDateFromYMD(dateStr);
    const availabilityMap = checkTimeSlotsAvailability(queryDate, dateStr, [timeStr], CALENDAR_CONFIG.calendarId);
    const slotStatus = availabilityMap ? availabilityMap[timeStr] : null;

    if (!slotStatus) {
      defaultResponse.errorCode = 'SLOT_STATUS_MISSING';
      defaultResponse.message = '無法確認時段狀態，請重新選擇';
      return defaultResponse;
    }

    return {
      available: slotStatus.available === true,
      errorCode: slotStatus.available === true ? null : 'TIME_SLOT_CONFLICT',
      slotStatus: slotStatus,
      message: slotStatus.available === true ? '時段可用' : (slotStatus.reason || '該時段已被預約'),
      date: dateStr,
      time: timeStr
    };

  } catch (error) {
    console.error('後端時段驗證失敗:', error);
    defaultResponse.message = '後端驗證失敗，請稍後再試';
    return defaultResponse;
  }
}

// ==================== 預約狀態更新 ====================

/**
 * 處理預約狀態更新（已停用）
 * @param {string} bookingId - 預約ID
 * @param {string} status - 新狀態
 * @returns {Object} - 處理結果
 */
function handleUpdateBookingStatus(bookingId, status) {
  return {
    success: false,
    error: '預約狀態更新功能已移除',
    timestamp: new Date().toISOString()
  };
}
