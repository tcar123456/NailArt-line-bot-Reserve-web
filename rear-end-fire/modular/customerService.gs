/**
 * customerService.gs - 客戶服務模組
 * 美甲預約系統 - Google Apps Script
 *
 * 包含：客戶建檔、客戶查詢、客戶驗證
 */

// ==================== 客戶建檔 ====================

/**
 * 處理客戶建檔
 * @param {Object} customer - 客戶資料
 * @returns {Object} - 處理結果
 */
function handleSaveCustomer(customer) {
  try {
    // 輸入驗證
    if (!customer || typeof customer !== 'object') {
      throw new Error('客戶資料格式錯誤');
    }

    if (!customer.name || !customer.phone) {
      throw new Error('客戶姓名和手機號碼為必填項目');
    }

    // 手機號碼格式驗證
    if (!SYSTEM_CONFIG.PHONE_REGEX.test(customer.phone.replace(/[-\s]/g, ''))) {
      throw new Error('手機號碼格式不正確');
    }

    const sheet = getSheet(CUSTOMER_SHEET_NAME);

    // 清除快取以確保資料一致性
    clearCustomerCache();

    // 檢查是否已有相同的 LINE User ID
    const existingRowByLineId = findCustomerByLineUserId(customer.lineUserId);

    if (existingRowByLineId > 0) {
      // 更新現有客戶資料
      const now = new Date();
      sheet.getRange(existingRowByLineId, 2).setValue(customer.name);

      const phoneCell = sheet.getRange(existingRowByLineId, 3);
      phoneCell.setNumberFormat('@');
      phoneCell.setValue(customer.phone);

      sheet.getRange(existingRowByLineId, 4).setValue(now);

      return {
        success: true,
        message: '客戶資料已更新',
        isExisting: true,
        timestamp: new Date().toISOString()
      };
    }

    // 檢查是否已有相同的手機號碼
    const existingRowByPhone = findCustomerByPhone(customer.phone);

    if (existingRowByPhone > 0) {
      // 更新 LINE User ID
      const now = new Date();
      sheet.getRange(existingRowByPhone, 1).setValue(customer.lineUserId);
      sheet.getRange(existingRowByPhone, 2).setValue(customer.name);
      sheet.getRange(existingRowByPhone, 4).setValue(now);

      return {
        success: true,
        message: '客戶資料已更新（LINE User ID已關聯）',
        isExisting: true,
        timestamp: new Date().toISOString()
      };
    }

    // 新客戶，新增資料
    const now = new Date();
    const newRow = sheet.getLastRow() + 1;

    sheet.appendRow([
      customer.lineUserId || '',
      customer.name,
      `'${customer.phone}`,
      now,
      '',
      0
    ]);

    // 設定手機欄位為文字格式
    const phoneCell = sheet.getRange(newRow, 3);
    phoneCell.setNumberFormat('@');
    phoneCell.setValue(customer.phone);

    return {
      success: true,
      message: '客戶建檔成功',
      isExisting: false,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('儲存客戶資料時發生錯誤:', error);
    throw error;
  }
}

// ==================== 客戶查詢 ====================

/**
 * 處理客戶查詢（依手機號碼）
 * @param {string} phone - 手機號碼
 * @returns {Object} - 查詢結果
 */
function handleGetCustomer(phone) {
  try {
    const sheet = getSheet(CUSTOMER_SHEET_NAME);
    const rowIndex = findCustomerByPhone(phone);

    if (rowIndex > 0) {
      const row = sheet.getRange(rowIndex, 1, 1, 6).getValues()[0];

      return {
        success: true,
        customer: {
          lineUserId: row[0],
          name: row[1],
          phone: row[2],
          createdAt: row[3],
          lastBooking: row[4],
          totalBookings: row[5]
        },
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        success: true,
        customer: null,
        message: '客戶不存在',
        timestamp: new Date().toISOString()
      };
    }

  } catch (error) {
    console.error('查詢客戶資料時發生錯誤:', error);
    throw error;
  }
}

/**
 * 根據 LINE User ID 獲取客戶資料
 * @param {string} lineUserId - LINE User ID
 * @returns {Object} - 客戶資料
 */
function handleGetCustomerByLineId(lineUserId) {
  try {
    if (!lineUserId) {
      return {
        success: true,
        customer: null,
        message: '缺少LINE User ID',
        timestamp: new Date().toISOString()
      };
    }

    const sheet = getSheet(CUSTOMER_SHEET_NAME);
    const rowIndex = findCustomerByLineUserId(lineUserId);

    if (rowIndex > 0) {
      const row = sheet.getRange(rowIndex, 1, 1, 6).getValues()[0];

      return {
        success: true,
        customer: {
          lineUserId: row[0],
          name: row[1],
          phone: row[2],
          createdAt: row[3],
          lastBooking: row[4],
          totalBookings: row[5]
        },
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        success: true,
        customer: null,
        message: '客戶不存在',
        timestamp: new Date().toISOString()
      };
    }

  } catch (error) {
    console.error('查詢客戶資料時發生錯誤:', error);
    throw error;
  }
}

// ==================== 客戶驗證 ====================

/**
 * 根據 LINE User ID 驗證客戶是否存在
 * @param {string} lineUserId - LINE User ID
 * @returns {Object} - 驗證結果
 */
function handleVerifyCustomerByLineId(lineUserId) {
  try {
    if (!lineUserId) {
      return {
        success: true,
        exists: false,
        message: '缺少LINE User ID',
        timestamp: new Date().toISOString()
      };
    }

    const sheet = getSheet(CUSTOMER_SHEET_NAME);
    const rowIndex = findCustomerByLineUserId(lineUserId);

    if (rowIndex > 0) {
      const row = sheet.getRange(rowIndex, 1, 1, 6).getValues()[0];

      return {
        success: true,
        exists: true,
        customer: {
          lineUserId: row[0],
          name: row[1],
          phone: row[2],
          createdAt: row[3],
          lastBooking: row[4],
          totalBookings: row[5]
        },
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        success: true,
        exists: false,
        message: '客戶不存在',
        timestamp: new Date().toISOString()
      };
    }

  } catch (error) {
    console.error('驗證客戶時發生錯誤:', error);
    throw error;
  }
}

// ==================== 客戶預約資訊更新 ====================

/**
 * 更新客戶的預約資訊
 * @param {string} phone - 手機號碼
 * @param {Date} bookingTime - 預約時間
 */
function updateCustomerBookingInfo(phone, bookingTime) {
  const sheet = getSheet(CUSTOMER_SHEET_NAME);
  const rowIndex = findCustomerByPhone(phone);

  if (rowIndex > 0) {
    // 更新最後預約時間
    sheet.getRange(rowIndex, 5).setValue(bookingTime);

    // 增加預約次數
    const currentCount = sheet.getRange(rowIndex, 6).getValue() || 0;
    sheet.getRange(rowIndex, 6).setValue(currentCount + 1);
  }
}

// ==================== 客戶預約記錄查詢 ====================

/**
 * 處理取得客戶預約記錄
 * @param {string} lineUserId - LINE User ID
 * @returns {Object} - 查詢結果
 */
function handleGetCustomerBookings(lineUserId) {
  try {
    console.log('開始查詢客戶預約記錄:', lineUserId);

    if (!lineUserId) {
      throw new Error('缺少 LINE User ID');
    }

    // 使用索引查詢
    const bookings = getBookingsFromIndex(lineUserId);

    // 處理時間格式
    const processedBookings = bookings.map(booking => {
      const processedBooking = { ...booking };

      // 確保日期格式正確
      if (processedBooking.date instanceof Date) {
        processedBooking.date = Utilities.formatDate(processedBooking.date, SYSTEM_CONFIG.TIMEZONE || 'Asia/Taipei', 'yyyy-MM-dd');
      }

      // 格式化時間
      if (processedBooking.time instanceof Date) {
        processedBooking.time = Utilities.formatDate(processedBooking.time, SYSTEM_CONFIG.TIMEZONE || 'Asia/Taipei', 'HH:mm');
      } else if (typeof processedBooking.time === 'number') {
        const totalMinutes = Math.round(processedBooking.time * 24 * 60);
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        processedBooking.time = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
      }

      // 格式化建立時間
      if (processedBooking.createdAt instanceof Date) {
        processedBooking.createdAt = processedBooking.createdAt.toISOString();
      }

      return processedBooking;
    });

    // 按預約日期排序（最新的在前面）
    processedBookings.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}:00+08:00`);
      const dateB = new Date(`${b.date}T${b.time}:00+08:00`);
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`查詢完成，找到 ${processedBookings.length} 筆預約記錄`);

    return {
      success: true,
      bookings: processedBookings,
      totalCount: processedBookings.length,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('查詢客戶預約記錄時發生錯誤:', error);
    return {
      success: false,
      error: error.message,
      bookings: [],
      totalCount: 0,
      timestamp: new Date().toISOString()
    };
  }
}
