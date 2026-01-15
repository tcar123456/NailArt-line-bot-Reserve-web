/**
 * timeslotService.gs - 時段服務模組
 * 美甲預約系統 - Google Apps Script
 *
 * 包含：時段查詢、時段可用性檢查、批量時段檢查
 */

// ==================== 時段查詢 ====================

/**
 * 處理取得可用時段請求
 * @param {string} date - 查詢日期 (YYYY-MM-DD 格式)
 * @returns {Object} - 可用時段結果
 */
function handleGetAvailableTimeSlots(date) {
  try {
    console.log('處理時段查詢請求，日期:', date);

    if (!date) {
      throw new Error('缺少查詢日期參數');
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new Error('日期格式錯誤，請使用 YYYY-MM-DD 格式');
    }

    const calendarId = CALENDAR_CONFIG.calendarId;
    if (!calendarId || calendarId === 'YOUR_CALENDAR_ID@gmail.com') {
      return {
        success: false,
        error: '日曆未設定',
        availableSlots: [],
        message: '請在指令碼屬性中設定 GOOGLE_CALENDAR_ID',
        timestamp: new Date().toISOString()
      };
    }

    const queryDate = new Date(date);
    if (isNaN(queryDate.getTime())) {
      throw new Error('無效的日期格式');
    }

    // 檢查是否為過去日期
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (queryDate < today) {
      return {
        success: true,
        date: date,
        availableSlots: [],
        message: '過去日期無可用時段',
        timestamp: new Date().toISOString()
      };
    }

    const availableSlots = getAvailableTimeSlotsFromCalendar(queryDate);

    return {
      success: true,
      date: date,
      availableSlots: availableSlots,
      totalSlots: availableSlots.length,
      message: `找到 ${availableSlots.length} 個可用時段`,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('查詢可用時段時發生錯誤:', error);
    return {
      success: false,
      error: error.message,
      date: date || null,
      availableSlots: [],
      message: '查詢可用時段失敗',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 從 Google Calendar 讀取時段
 * @param {Date} date - 查詢日期
 * @returns {Array} - 可用時段陣列
 */
function getAvailableTimeSlotsFromCalendar(date) {
  try {
    const readCalendarId = CALENDAR_CONFIG.timeSlotsCalendarId;
    const queryDateStr = getTaipeiDateString(date);
    const { startTime, endTime } = getOptimizedQueryRange(queryDateStr);

    const events = AdvancedCalendarService.getEvents(readCalendarId, startTime, endTime);
    const availableSlots = [];

    for (const event of events) {
      const title = event.getTitle();
      const eventStartTime = event.getStartTime();
      const eventDateStr = getTaipeiDateString(eventStartTime);

      if (eventDateStr === queryDateStr) {
        const timeSlots = extractTimeSlotsFromTitle(title, eventStartTime);

        for (const slot of timeSlots) {
          const existingSlot = availableSlots.find(s => s.time === slot.time);
          if (!existingSlot) {
            availableSlots.push(slot);
          }
        }
      }
    }

    availableSlots.sort((a, b) => a.time.localeCompare(b.time));
    return availableSlots;

  } catch (error) {
    console.error('從日曆讀取時段失敗:', error);
    return [];
  }
}

/**
 * 從事件標題中提取時段資訊
 */
function extractTimeSlotsFromTitle(title, eventStartTime) {
  const slots = [];

  try {
    const timePatterns = [
      /(\d{1,2}):(\d{2})/g,
      /(\d{1,2})點(\d{2})?/g,
      /(\d{1,2})時(\d{2})?/g,
      /上午\s*(\d{1,2}):?(\d{2})?/g,
      /下午\s*(\d{1,2}):?(\d{2})?/g,
      /晚上\s*(\d{1,2}):?(\d{2})?/g
    ];

    const foundTimes = new Set();

    for (const pattern of timePatterns) {
      let match;
      while ((match = pattern.exec(title)) !== null) {
        let hour = parseInt(match[1]);
        let minute = parseInt(match[2]) || 0;

        if (title.includes('下午') && hour < 12) {
          hour += 12;
        } else if (title.includes('上午') && hour === 12) {
          hour = 0;
        }

        const timeStr = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
        foundTimes.add(timeStr);
      }
    }

    // 如果標題中沒有時間，使用事件開始時間
    if (foundTimes.size === 0 && eventStartTime) {
      const hour = eventStartTime.getHours();
      const minute = eventStartTime.getMinutes();
      const timeStr = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
      foundTimes.add(timeStr);
    }

    for (const timeStr of foundTimes) {
      const hour = parseInt(timeStr.split(':')[0]);
      let period = '晚上';
      if (hour >= 6 && hour < 12) period = '上午';
      else if (hour >= 12 && hour < 18) period = '下午';

      slots.push({
        time: timeStr,
        period: period,
        label: `${period} ${timeStr}`,
        available: true,
        source: 'calendar_event',
        originalTitle: title
      });
    }

  } catch (error) {
    console.error('提取時段時發生錯誤:', error);
  }

  return slots;
}

// ==================== 時段可用性檢查 ====================

/**
 * 處理時段可用性檢查請求
 */
function handleCheckTimeSlotAvailability(date, timeSlots) {
  try {
    if (!date) throw new Error('缺少查詢日期參數');
    if (!timeSlots) throw new Error('缺少時段參數');
    if (!Array.isArray(timeSlots)) throw new Error('時段參數必須是陣列格式');

    if (timeSlots.length === 0) {
      return {
        success: true,
        date: date,
        availability: {},
        checkedSlots: 0,
        message: '沒有時段需要檢查',
        timestamp: new Date().toISOString()
      };
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new Error('日期格式錯誤，請使用 YYYY-MM-DD 格式');
    }

    const bookingCalendarId = CALENDAR_CONFIG.calendarId;
    if (!bookingCalendarId || bookingCalendarId === 'YOUR_CALENDAR_ID@gmail.com') {
      return {
        success: false,
        error: '預約日曆未設定',
        availability: {},
        timestamp: new Date().toISOString()
      };
    }

    const queryDate = createTaipeiDateFromYMD(date);
    if (isNaN(queryDate.getTime())) {
      throw new Error('無效的日期格式');
    }

    const availability = checkTimeSlotsAvailability(queryDate, date, timeSlots, bookingCalendarId);

    return {
      success: true,
      date: date,
      availability: availability,
      checkedSlots: timeSlots.length,
      message: '時段可用性檢查完成',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('檢查時段可用性時發生錯誤:', error);
    return {
      success: false,
      error: error.message,
      date: date || null,
      availability: {},
      message: '檢查時段可用性失敗',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 檢查多個時段的可用性
 */
function checkTimeSlotsAvailability(date, dateStr, timeSlots, calendarId) {
  const availability = {};

  try {
    const queryDateStr = dateStr;
    const { startTime, endTime } = getOptimizedQueryRange(queryDateStr);
    const events = AdvancedCalendarService.getEvents(calendarId, startTime, endTime);

    for (const timeSlot of timeSlots) {
      const slotAvailability = checkSingleTimeSlotAvailability(events, timeSlot, date, queryDateStr);
      availability[timeSlot] = slotAvailability;
    }

  } catch (error) {
    console.error('檢查時段可用性時發生錯誤:', error);
    for (const slot of timeSlots) {
      availability[slot] = { available: false, conflictCount: -1, reason: '檢查失敗: ' + error.message };
    }
  }

  return availability;
}

/**
 * 檢查單一時段的可用性
 */
function checkSingleTimeSlotAvailability(events, timeSlot, date, queryDateStr) {
  try {
    const [hour, minute] = timeSlot.split(':').map(Number);

    const slotStartStr = queryDateStr + 'T' + String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ':00+08:00';
    const slotStart = new Date(slotStartStr);

    const endHour = hour + CALENDAR_CONFIG.defaultDuration;
    const slotEndStr = queryDateStr + 'T' + String(endHour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ':00+08:00';
    const slotEnd = new Date(slotEndStr);

    let conflictCount = 0;
    const conflictingEvents = [];

    for (const event of events) {
      const eventStart = event.getStartTime();
      const eventEnd = event.getEndTime();
      const eventDateStr = getTaipeiDateString(eventStart);

      if (eventDateStr !== queryDateStr) continue;

      if (slotStart < eventEnd && slotEnd > eventStart) {
        conflictCount++;
        conflictingEvents.push({
          title: event.getTitle(),
          start: eventStart.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
          end: eventEnd.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
        });
      }
    }

    const isAvailable = conflictCount === 0;

    return {
      available: isAvailable,
      conflictCount: conflictCount,
      conflictingEvents: conflictingEvents,
      reason: isAvailable ? '可預約' : `與 ${conflictCount} 個預約衝突`
    };

  } catch (error) {
    console.error(`檢查時段 ${timeSlot} 時發生錯誤:`, error);
    return {
      available: false,
      conflictCount: -1,
      reason: '檢查失敗: ' + error.message
    };
  }
}

// ==================== 批量時段檢查 ====================

/**
 * 批量查詢多天所有時段的可預約狀態
 */
function handleBatchCheckTimeSlotAvailability(startDate, endDate) {
  try {
    console.log('批量查詢多天所有時段可預約狀態:', { startDate, endDate });

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new Error('日期格式錯誤，請使用 YYYY-MM-DD 格式');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('無效的日期格式');
    }

    if (start > end) {
      throw new Error('開始日期不能晚於結束日期');
    }

    const maxDays = 62;
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (daysDiff > maxDays) {
      throw new Error(`查詢範圍過大，最多支援 ${maxDays} 天`);
    }

    const timeSlotsCalendarId = CALENDAR_CONFIG.timeSlotsCalendarId;
    const bookingCalendarId = CALENDAR_CONFIG.calendarId;

    if (!timeSlotsCalendarId || !bookingCalendarId) {
      return {
        success: false,
        error: '日曆配置未設定',
        data: {},
        timestamp: new Date().toISOString()
      };
    }

    const { startTime: rangeStartTime, endTime: rangeEndTime } = getOptimizedQueryRangeBatch(startDate, endDate);

    // 批量查詢
    const timeSlotsEvents = AdvancedCalendarService.getEvents(timeSlotsCalendarId, rangeStartTime, rangeEndTime);
    const bookingEvents = AdvancedCalendarService.getEvents(bookingCalendarId, rangeStartTime, rangeEndTime);

    // 按日期分組
    const timeSlotsByDate = {};
    timeSlotsEvents.forEach(event => {
      const eventDateStr = getTaipeiDateString(event.getStartTime());
      if (eventDateStr >= startDate && eventDateStr <= endDate) {
        if (!timeSlotsByDate[eventDateStr]) timeSlotsByDate[eventDateStr] = [];
        timeSlotsByDate[eventDateStr].push(event);
      }
    });

    const bookingsByDate = {};
    bookingEvents.forEach(event => {
      const eventDateStr = getTaipeiDateString(event.getStartTime());
      if (eventDateStr >= startDate && eventDateStr <= endDate) {
        if (!bookingsByDate[eventDateStr]) bookingsByDate[eventDateStr] = [];
        bookingsByDate[eventDateStr].push(event);
      }
    });

    // 逐日處理
    const result = {};
    let totalDays = 0;
    let totalSlots = 0;

    for (let currentDate = new Date(start); currentDate <= end; currentDate.setDate(currentDate.getDate() + 1)) {
      const dateStr = getTaipeiDateString(currentDate);

      try {
        const dayTimeSlotsEvents = timeSlotsByDate[dateStr] || [];
        const availableSlots = extractTimeSlotsFromEvents(dayTimeSlotsEvents, dateStr);

        if (!availableSlots || availableSlots.length === 0) {
          result[dateStr] = {};
          continue;
        }

        const timeSlotStrings = availableSlots.map(slot => slot.time || slot);
        const dayBookingEvents = bookingsByDate[dateStr] || [];
        const availability = checkTimeSlotsAvailabilityFromEvents(dayBookingEvents, timeSlotStrings, currentDate, dateStr);

        result[dateStr] = availability;
        totalSlots += timeSlotStrings.length;
        totalDays++;

      } catch (error) {
        console.error(`處理日期 ${dateStr} 時發生錯誤:`, error);
        result[dateStr] = { error: error.message };
      }
    }

    return {
      success: true,
      data: result,
      totalDays: totalDays,
      totalSlots: totalSlots,
      message: `批量查詢完成，處理 ${totalDays} 天，總計 ${totalSlots} 個時段`,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('批量查詢多天可預約狀態時發生錯誤:', error);
    return {
      success: false,
      error: error.message,
      data: {},
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 從事件陣列中提取時段資訊（批量處理）
 */
function extractTimeSlotsFromEvents(events, dateStr) {
  const availableSlots = [];

  try {
    for (const event of events) {
      const title = event.getTitle();
      const eventStartTime = event.getStartTime();
      const eventDateStr = getTaipeiDateString(eventStartTime);

      if (eventDateStr === dateStr) {
        const timeSlots = extractTimeSlotsFromTitle(title, eventStartTime);

        for (const slot of timeSlots) {
          const existingSlot = availableSlots.find(s => s.time === slot.time);
          if (!existingSlot) {
            availableSlots.push(slot);
          }
        }
      }
    }

    availableSlots.sort((a, b) => a.time.localeCompare(b.time));
    return availableSlots;

  } catch (error) {
    console.error(`從事件中提取時段失敗 (${dateStr}):`, error);
    return [];
  }
}

/**
 * 從事件陣列中檢查時段可用性（批量處理）
 */
function checkTimeSlotsAvailabilityFromEvents(bookingEvents, timeSlots, date, queryDateStr) {
  const availability = {};

  try {
    for (const timeSlot of timeSlots) {
      const slotAvailability = checkSingleTimeSlotAvailabilityFromEvents(bookingEvents, timeSlot, date, queryDateStr);
      availability[timeSlot] = slotAvailability;
    }
    return availability;

  } catch (error) {
    console.error(`檢查時段可用性失敗 (${queryDateStr}):`, error);
    for (const slot of timeSlots) {
      availability[slot] = { available: false, conflictCount: -1, reason: '檢查失敗: ' + error.message };
    }
    return availability;
  }
}

/**
 * 從事件陣列中檢查單一時段的可用性（批量處理）
 */
function checkSingleTimeSlotAvailabilityFromEvents(bookingEvents, timeSlot, date, queryDateStr) {
  try {
    const [hour, minute] = timeSlot.split(':').map(Number);

    const slotStartStr = queryDateStr + 'T' + String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ':00+08:00';
    const slotStart = new Date(slotStartStr);

    const endHour = hour + CALENDAR_CONFIG.defaultDuration;
    const slotEndStr = queryDateStr + 'T' + String(endHour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ':00+08:00';
    const slotEnd = new Date(slotEndStr);

    let conflictCount = 0;
    const conflictingEvents = [];

    for (const event of bookingEvents) {
      const eventStart = event.getStartTime();
      const eventEnd = event.getEndTime();
      const eventDateStr = getTaipeiDateString(eventStart);

      if (eventDateStr !== queryDateStr) continue;

      if (slotStart < eventEnd && slotEnd > eventStart) {
        conflictCount++;
        conflictingEvents.push({
          title: event.getTitle(),
          start: eventStart.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
          end: eventEnd.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
        });
      }
    }

    return {
      available: conflictCount === 0,
      conflictCount: conflictCount,
      conflictingEvents: conflictingEvents,
      reason: conflictCount === 0 ? '可預約' : `與 ${conflictCount} 個預約衝突`
    };

  } catch (error) {
    return {
      available: false,
      conflictCount: -1,
      reason: '檢查失敗: ' + error.message
    };
  }
}

// ==================== 批量時段查詢 ====================

/**
 * 處理批量取得可用時段請求
 */
function handleGetBatchAvailableTimeSlots(startDate, endDate) {
  try {
    if (!startDate || !endDate) {
      throw new Error('缺少開始日期或結束日期參數');
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new Error('日期格式錯誤，請使用 YYYY-MM-DD 格式');
    }

    const calendarId = CALENDAR_CONFIG.calendarId;
    if (!calendarId || calendarId === 'YOUR_CALENDAR_ID@gmail.com') {
      return {
        success: false,
        error: '日曆未設定',
        dateSlots: {},
        timestamp: new Date().toISOString()
      };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('無效的日期格式');
    }

    if (start > end) {
      throw new Error('開始日期不能晚於結束日期');
    }

    const maxDays = 62;
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (daysDiff > maxDays) {
      throw new Error(`查詢範圍過大，最多支援 ${maxDays} 天`);
    }

    const dateSlots = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalSlots = 0;
    let processedDays = 0;

    for (let currentDate = new Date(start); currentDate <= end; currentDate.setDate(currentDate.getDate() + 1)) {
      const dateStr = getTaipeiDateString(currentDate);

      if (currentDate < today) {
        dateSlots[dateStr] = {
          availableSlots: [],
          message: '過去日期無可用時段',
          isSkipped: true
        };
        continue;
      }

      try {
        const availableSlots = getAvailableTimeSlotsFromCalendar(currentDate);

        dateSlots[dateStr] = {
          availableSlots: availableSlots,
          totalSlots: availableSlots.length,
          message: `找到 ${availableSlots.length} 個可用時段`,
          isSkipped: false
        };

        totalSlots += availableSlots.length;
        processedDays++;

      } catch (error) {
        dateSlots[dateStr] = {
          availableSlots: [],
          error: error.message,
          message: '查詢失敗',
          isSkipped: false
        };
      }
    }

    return {
      success: true,
      startDate: startDate,
      endDate: endDate,
      dateSlots: dateSlots,
      totalDays: processedDays,
      totalSlots: totalSlots,
      message: `批量查詢完成，處理 ${processedDays} 天，總計 ${totalSlots} 個時段`,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('批量查詢可用時段時發生錯誤:', error);
    return {
      success: false,
      error: error.message,
      startDate: startDate || null,
      endDate: endDate || null,
      dateSlots: {},
      timestamp: new Date().toISOString()
    };
  }
}
