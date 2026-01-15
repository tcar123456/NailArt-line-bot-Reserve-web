/**
 * adminService.gs - 後台管理模組
 * 美甲預約系統 - Google Apps Script
 *
 * 包含：後台設定讀取、後台設定更新、管理員驗證
 */

// ==================== 後台設定讀取 ====================

/**
 * 處理取得後台設定
 * @returns {Object} - 後台設定資料
 */
function handleGetAdminSettings() {
  try {
    console.log('開始讀取後台設定');

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName('後台預約項目');

    if (!sheet) {
      throw new Error('找不到「後台預約項目」工作表');
    }

    // 讀取所有資料（從第2行開始，跳過標題）
    const data = sheet.getDataRange().getValues();
    const headers = data[0]; // 第一行是標題
    const rows = data.slice(1); // 從第二行開始是資料

    // 解析資料
    const settings = {
      services: [],
      removals: [],
      extension: {
        enabled: false,
        quantities: []
      }
    };

    rows.forEach(row => {
      const type = row[0];
      const id = row[1];
      const name = row[2];
      const enabled = row[3] === true || row[3] === 'TRUE';
      const sort = row[4] || 0;

      const item = { id: String(id), name, enabled, sort };

      switch (type) {
        case 'SERVICE':
          settings.services.push(item);
          break;
        case 'REMOVAL':
          settings.removals.push(item);
          break;
        case 'EXTENSION':
          settings.extension.enabled = enabled;
          settings.extension.id = id;  // 保存延甲的 ID
          break;
        case 'EXTENSION-Q':  // 延甲數量選項
          settings.extension.quantities.push(item);
          break;
      }
    });

    // 按排序順序排列
    settings.services.sort((a, b) => a.sort - b.sort);
    settings.extension.quantities.sort((a, b) => a.sort - b.sort);

    console.log('後台設定讀取成功');

    return {
      success: true,
      data: settings,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('讀取後台設定失敗:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// ==================== 後台設定更新 ====================

/**
 * 處理更新後台設定
 * @param {Object} data - 包含設定資料和用戶ID
 * @returns {Object} 更新結果
 */
function handleUpdateAdminSettings(data) {
  try {
    console.log('開始更新後台設定');

    // TODO: 這裡應該驗證用戶是否為管理員
    // const userId = data.userId;
    // if (!isAdmin(userId)) {
    //   throw new Error('無權限：僅管理員可以修改設定');
    // }

    const settings = data.settings;

    if (!settings) {
      throw new Error('缺少設定資料');
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName('後台預約項目');

    // 如果工作表不存在，建立它
    if (!sheet) {
      console.log('建立新工作表：後台預約項目');
      sheet = spreadsheet.insertSheet('後台預約項目');

      // 設定標題行
      const headers = ['類型', 'ID', '名稱', '啟用', '排序'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

      // 設定標題樣式
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#e8dbe8');

      // 凍結標題行
      sheet.setFrozenRows(1);
    }

    // 準備新資料
    const newData = [];

    // 新增服務項目
    if (settings.services && Array.isArray(settings.services)) {
      settings.services.forEach((service, index) => {
        newData.push([
          'SERVICE',
          service.id,
          service.name,
          service.enabled,
          service.sort || (index + 1)
        ]);
      });
    }

    // 新增卸甲選項
    if (settings.removals && Array.isArray(settings.removals)) {
      settings.removals.forEach((removal, index) => {
        newData.push([
          'REMOVAL',
          removal.id,
          removal.name,
          removal.enabled,
          index + 1  // 卸甲選項也獨立排序
        ]);
      });
    }

    // 新增延甲設定
    if (settings.extension) {
      // 延甲功能開關
      newData.push([
        'EXTENSION',
        settings.extension.id || 'EXT10001',  // 使用提供的 ID
        '延甲功能',
        settings.extension.enabled,
        1  // 延甲主項目排序為 1
      ]);

      // 延甲數量選項
      if (settings.extension.quantities && Array.isArray(settings.extension.quantities)) {
        settings.extension.quantities.forEach((quantity, index) => {
          newData.push([
            'EXTENSION-Q',  // 延甲數量類型
            quantity.id,
            quantity.name,
            quantity.enabled,
            quantity.sort || (index + 1)
          ]);
        });
      }
    }

    // 清空現有資料（保留標題）
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 5).clearContent();
    }

    // 寫入新資料
    if (newData.length > 0) {
      sheet.getRange(2, 1, newData.length, 5).setValues(newData);
      console.log('成功寫入 ' + newData.length + ' 筆資料');
    }

    // 自動調整欄寬
    sheet.autoResizeColumns(1, 5);

    console.log('後台設定更新成功');

    return {
      success: true,
      message: '設定已成功更新',
      itemsUpdated: newData.length,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('更新後台設定失敗:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// ==================== 管理員驗證 ====================

/**
 * 驗證用戶是否為管理員（預留功能）
 * @param {string} userId - LINE User ID
 * @returns {boolean} 是否為管理員
 */
function isAdmin(userId) {
  // TODO: 實作管理員驗證邏輯
  // 可以從另一個工作表讀取管理員列表
  // 或者使用 PropertiesService 儲存管理員 ID

  // 暫時返回 true，允許所有人更新（開發階段）
  console.warn('管理員驗證尚未實作，暫時允許所有用戶');
  return true;
}
