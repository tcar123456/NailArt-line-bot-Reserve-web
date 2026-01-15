/**
 * Google 日曆服務模組
 * 處理與 Google Calendar API 的所有互動
 * 支援多個日曆ID查詢時段可用性
 */
class GoogleCalendarService {
    constructor() {
        // Google Calendar API 設定 - 將透過 setConfig 方法設定
        this.apiKey = '';
        this.calendarIds = []; // 用於讀取時段的日曆ID陣列
        this.bookingCalendarId = ''; // 用於寫入預約的專用日曆ID
        this.baseUrl = 'https://www.googleapis.com/calendar/v3';
        
        // 動態時段配置 - 不再使用固定時段
        this.useDynamicTimeSlots = true;
        
        // 快取已查詢的預約資料，減少 API 調用
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5分鐘快取
    }

    /**
     * 設定 API 金鑰和日曆 ID
     * @param {string} apiKey - Google Calendar API Key
     * @param {Array<string>} calendarIds - 用於讀取的日曆 ID 陣列
     * @param {string} bookingCalendarId - 用於寫入預約的日曆 ID
     */
    setConfig(apiKey, calendarIds, bookingCalendarId = null) {
        this.apiKey = apiKey;
        this.calendarIds = Array.isArray(calendarIds) ? calendarIds : [calendarIds];
        
        // 如果有提供專用預約日曆ID，則使用它；否則使用第一個讀取日曆
        this.bookingCalendarId = bookingCalendarId || this.calendarIds[0];
        
        console.log('Google Calendar 設定完成:', {
            apiKey: apiKey ? '***已設定***' : '未設定',
            readCalendarIds: this.calendarIds,
            bookingCalendarId: this.bookingCalendarId
        });
    }

    /**
     * 檢查指定日期的時段可用性（已棄用 - 使用動態時段生成）
     * 此方法保留僅為了向後相容，實際使用 scanAvailableTimeSlotsFromCalendar 和 checkDynamicTimeSlotAvailability
     * @param {Date} date - 要檢查的日期
     * @returns {Promise<Object>} - 時段可用性結果
     * @deprecated 請使用動態時段生成方法
     */
    async checkTimeSlotAvailability(date) {
        console.warn('⚠️ checkTimeSlotAvailability 已棄用，請使用動態時段生成方法');
        
        try {
            // 使用動態時段生成替代
            const timeSlots = await this.scanAvailableTimeSlotsFromCalendar(date);
            const availabilityResult = await this.checkDynamicTimeSlotAvailability(date, timeSlots);
            
            return {
                date: this.getDateKey(date),
                availability: availabilityResult.availability || {},
                totalEvents: availabilityResult.totalBookings || 0,
                calendarCount: this.calendarIds.length,
                isDynamic: true,
                deprecationWarning: '此方法已棄用，請使用動態時段生成'
            };

        } catch (error) {
            console.error('檢查時段可用性失敗:', error);
            return {
                date: this.getDateKey(date),
                availability: {},
                error: error.message,
                calendarCount: this.calendarIds.length,
                isDynamic: true
            };
        }
    }

    /**
     * 查詢所有日曆在指定日期的事件
     * @param {Date} date - 查詢日期
     * @returns {Promise<Array>} - 所有事件陣列
     */
    async getAllEventsForDate(date) {
        if (!this.apiKey || this.calendarIds.length === 0) {
            throw new Error('請先設定 Google Calendar API Key 和日曆 ID');
        }

        const allEvents = [];
        
        // 並行查詢所有日曆
        const promises = this.calendarIds.map(calendarId => 
            this.getEventsForDateFromCalendar(date, calendarId)
        );
        
        try {
            const results = await Promise.allSettled(promises);
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    allEvents.push(...result.value);
                } else {
                    console.error(`日曆 ${this.calendarIds[index]} 查詢失敗:`, result.reason);
                }
            });
            
            console.log(`成功查詢 ${this.calendarIds.length} 個日曆，共 ${allEvents.length} 個事件`);
            return allEvents;
            
        } catch (error) {
            console.error('查詢多個日曆事件失敗:', error);
            throw error;
        }
    }

    /**
     * 查詢單一日曆在指定日期的事件
     * @param {Date} date - 查詢日期
     * @param {string} calendarId - 日曆ID
     * @returns {Promise<Array>} - 事件陣列
     */
    async getEventsForDateFromCalendar(date, calendarId) {
        // 設定查詢時間範圍（當天 00:00 到 23:59）
        const startTime = new Date(date);
        startTime.setHours(0, 0, 0, 0);
        
        const endTime = new Date(date);
        endTime.setHours(23, 59, 59, 999);

        const url = `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events`;
        const params = new URLSearchParams({
            key: this.apiKey,
            timeMin: startTime.toISOString(),
            timeMax: endTime.toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });

        console.log(`查詢日曆 ${calendarId}:`, `${url}?${params}`);

        const response = await fetch(`${url}?${params}`);
        
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Google Calendar API 錯誤 (${calendarId}): ${response.status} - ${errorData}`);
        }

        const data = await response.json();
        const events = data.items || [];
        
        // 為每個事件標記來源日曆
        events.forEach(event => {
            event.sourceCalendarId = calendarId;
        });
        
        return events;
    }

    /**
     * 檢查時段是否可用
     * @param {Array} events - 事件陣列
     * @param {Object} slotConfig - 時段配置
     * @param {Date} date - 日期
     * @returns {boolean} - 是否可用
     */
    isTimeSlotAvailable(events, slotConfig, date) {
        const slotStartHour = slotConfig.start;
        const slotEndHour = slotConfig.end;
        
        // 檢查是否有事件與此時段重疊
        for (const event of events) {
            if (this.doesEventConflictWithTimeSlot(event, slotStartHour, slotEndHour, date)) {
                return false; // 有衝突，時段不可用
            }
        }
        
        return true; // 無衝突，時段可用
    }

    /**
     * 檢查事件是否與時段衝突
     * @param {Object} event - 日曆事件
     * @param {number} slotStartHour - 時段開始小時
     * @param {number} slotEndHour - 時段結束小時  
     * @param {Date} date - 日期
     * @returns {boolean} - 是否衝突
     */
    doesEventConflictWithTimeSlot(event, slotStartHour, slotEndHour, date) {
        if (!event.start || !event.end) {
            return false; // 沒有時間資訊的事件不計算
        }
        
        let eventStart, eventEnd;
        
        // 處理全天事件
        if (event.start.date) {
            // 全天事件視為佔用整天
            return true;
        }
        
        // 處理有時間的事件
        if (event.start.dateTime && event.end.dateTime) {
            eventStart = new Date(event.start.dateTime);
            eventEnd = new Date(event.end.dateTime);
        } else {
            return false;
        }
        
        // 確保是同一天的事件
        const eventDate = new Date(eventStart);
        eventDate.setHours(0, 0, 0, 0);
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        
        if (eventDate.getTime() !== targetDate.getTime()) {
            return false;
        }
        
        // 檢查時間重疊
        const eventStartHour = eventStart.getHours() + eventStart.getMinutes() / 60;
        const eventEndHour = eventEnd.getHours() + eventEnd.getMinutes() / 60;
        
        // 時段範圍：slotStartHour ~ slotEndHour+0.99 (例如：10:00~12:59)
        const slotEndTime = slotEndHour + 0.99;
        
        // 檢查是否有重疊：事件開始時間 < 時段結束時間 且 事件結束時間 > 時段開始時間
        const hasOverlap = eventStartHour < slotEndTime && eventEndHour > slotStartHour;
        
        if (hasOverlap) {
            console.log(`發現時段衝突:`, {
                event: event.summary,
                eventTime: `${eventStartHour.toFixed(2)}~${eventEndHour.toFixed(2)}`,
                slotTime: `${slotStartHour}~${slotEndTime}`,
                calendar: event.sourceCalendarId
            });
        }
        
        return hasOverlap;
    }

    /**
     * 取得與時段衝突的事件
     * @param {Array} events - 事件陣列
     * @param {Object} slotConfig - 時段配置
     * @param {Date} date - 日期
     * @returns {Array} - 衝突事件陣列
     */
    getConflictingEvents(events, slotConfig, date) {
        const conflictingEvents = [];
        const slotStartHour = slotConfig.start;
        const slotEndHour = slotConfig.end;
        
        events.forEach(event => {
            if (this.doesEventConflictWithTimeSlot(event, slotStartHour, slotEndHour, date)) {
                conflictingEvents.push({
                    summary: event.summary,
                    start: event.start,
                    end: event.end,
                    calendarId: event.sourceCalendarId
                });
            }
        });
        
        return conflictingEvents;
    }

    /**
     * 創建預約事件
     * @param {Object} bookingData - 預約資料
     * @returns {Promise<Object>} - 創建結果
     */
    async createBookingEvent(bookingData) {
        if (!this.apiKey || !this.bookingCalendarId) {
            throw new Error('請先設定 Google Calendar API Key 和預約日曆 ID');
        }

        try {
            const event = this.createEventFromBooking(bookingData);
            
            const url = `${this.baseUrl}/calendars/${encodeURIComponent(this.bookingCalendarId)}/events`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}` // ⚠️ 錯誤：API Key無法用於寫入操作，需要OAuth 2.0 token
                },
                body: JSON.stringify(event)
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`創建日曆事件失敗: ${response.status} - ${errorData}`);
            }

            const createdEvent = await response.json();
            
            // 清除相關日期的快取
            const dateKey = this.getDateKey(new Date(bookingData.date));
            this.cache.delete(dateKey);
            
            return {
                success: true,
                eventId: createdEvent.id,
                eventLink: createdEvent.htmlLink
            };

        } catch (error) {
            console.error('創建日曆事件失敗:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 從預約資料創建 Google Calendar 事件
     * @param {Object} bookingData - 預約資料
     * @returns {Object} - Google Calendar 事件物件
     */
    createEventFromBooking(bookingData) {
        const startDateTime = new Date(`${bookingData.date}T${bookingData.time}:00`);
        const endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000); // 預設2小時服務時間

        return {
            summary: `美甲預約 - ${bookingData.customerName}`,
            description: `
客戶姓名: ${bookingData.customerName}
聯絡電話: ${bookingData.phone}
服務項目: ${bookingData.services ? bookingData.services.join(', ') : '待確認'}
預約ID: ${bookingData.bookingId}
LINE User ID: ${bookingData.lineUserId || ''}

備註: ${bookingData.notes || '無'}
            `.trim(),
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'Asia/Taipei'
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'Asia/Taipei'
            },
            attendees: [
                {
                    email: bookingData.email || '',
                    displayName: bookingData.customerName,
                    responseStatus: 'accepted'
                }
            ],
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'popup', minutes: 60 },  // 1小時前提醒
                    { method: 'popup', minutes: 1440 } // 1天前提醒
                ]
            }
        };
    }

    /**
     * 從事件中提取時間
     * @param {Object} event - Google Calendar 事件
     * @returns {string|null} - 時間字串 (HH:MM) 或 null
     */
    extractTimeFromEvent(event) {
        try {
            if (!event.start || !event.start.dateTime) {
                return null;
            }
            
            const startTime = new Date(event.start.dateTime);
            const hours = startTime.getHours().toString().padStart(2, '0');
            const minutes = startTime.getMinutes().toString().padStart(2, '0');
            
            return `${hours}:${minutes}`;
        } catch (error) {
            console.error('提取事件時間失敗:', error);
            return null;
        }
    }

    /**
     * 從行程標題中提取時間
     * 支援多種格式：11:00、11：00、上午11:00、下午2:00等
     * @param {string} title - 行程標題
     * @returns {string|null} - 時間字串 (HH:MM) 或 null
     */
    extractTimeFromTitle(title) {
        if (!title || typeof title !== 'string') {
            return null;
        }

        try {
            // 移除空白字符
            const cleanTitle = title.trim();
            
            // 正則表達式匹配各種時間格式
            const timePatterns = [
                // 標準格式：11:00, 09:30
                /(\d{1,2})[:\：](\d{2})/,
                // 帶上午下午：上午11:00, 下午2:00, 早上9:30
                /(?:上午|下午|早上|晚上|中午)\s*(\d{1,2})[:\：](\d{2})/,
                // 純數字格式：11點、9點半
                /(\d{1,2})\s*點(?:\s*(\d{1,2})\s*分)?/,
                // 英文格式：11am, 2pm, 9:30am
                /(\d{1,2})(?:[:\：](\d{2}))?\s*(?:am|pm|AM|PM)/
            ];

            for (const pattern of timePatterns) {
                const match = cleanTitle.match(pattern);
                if (match) {
                    let hours = parseInt(match[1], 10);
                    let minutes = match[2] ? parseInt(match[2], 10) : 0;

                    // 處理12小時制轉換
                    if (cleanTitle.includes('下午') || cleanTitle.includes('晚上') || cleanTitle.toLowerCase().includes('pm')) {
                        if (hours !== 12) {
                            hours += 12;
                        }
                    } else if ((cleanTitle.includes('上午') || cleanTitle.includes('早上') || cleanTitle.toLowerCase().includes('am')) && hours === 12) {
                        hours = 0;
                    }

                    // 驗證時間有效性
                    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('從標題提取時間失敗:', error);
            return null;
        }
    }

    /**
     * 從事件中提取客戶姓名
     * @param {Object} event - Google Calendar 事件
     * @returns {string|null} - 客戶姓名或 null
     */
    extractCustomerNameFromEvent(event) {
        try {
            if (event.summary) {
                const match = event.summary.match(/美甲預約\s*-\s*(.+)/);
                if (match) {
                    return match[1].trim();
                }
            }
            return event.summary || '未知客戶';
        } catch (error) {
            console.error('提取客戶姓名失敗:', error);
            return null;
        }
    }

    /**
     * 從事件中提取服務名稱
     * @param {Object} event - Google Calendar 事件
     * @returns {string|null} - 服務名稱或 null
     */
    extractServiceNameFromEvent(event) {
        try {
            if (event.description) {
                const match = event.description.match(/服務項目:\s*(.+)/);
                if (match) {
                    return match[1].trim();
                }
            }
            return null;
        } catch (error) {
            console.error('提取服務名稱失敗:', error);
            return null;
        }
    }

    /**
     * 取得日期鍵值（用於快取）
     * @param {Date} date - 日期
     * @returns {string} - 日期鍵值 (YYYY-MM-DD)
     */
    getDateKey(date) {
        return date.toISOString().split('T')[0];
    }

    /**
     * 清除快取
     */
    clearCache() {
        this.cache.clear();
        console.log('Google Calendar 快取已清除');
    }

    /**
     * 測試 API 連接
     * @returns {Promise<boolean>} - 連接測試結果
     */
    async testConnection() {
        try {
            const today = new Date();
            await this.getAllEventsForDate(today);
            console.log('Google Calendar API 連接測試成功');
            return true;
        } catch (error) {
            console.error('Google Calendar API 連接測試失敗:', error);
            return false;
        }
    }

    /**
     * 掃描指定日期的Google日曆，提取所有可預約時段
     * @param {Date} date - 要掃描的日期
     * @returns {Promise<Array>} - 可預約時段陣列
     */
    async scanAvailableTimeSlotsFromCalendar(date) {
        try {
            console.log('掃描Google日曆可預約時段:', this.getDateKey(date));
            
            if (!this.apiKey || this.calendarIds.length === 0) {
                console.warn('Google Calendar API Key 或日曆ID未設定，返回空時段');
                return [];
            }

            // 獲取當天所有事件
            const allEvents = await this.getAllEventsForDate(date);
            console.log(`找到 ${allEvents.length} 個行程事件`);

            // 提取時間並去重
            const timeSlotsSet = new Set();
            const availableSlots = [];

            allEvents.forEach(event => {
                // 方法1：從行程標題提取時間
                const timeFromTitle = this.extractTimeFromTitle(event.summary);
                if (timeFromTitle) {
                    timeSlotsSet.add(timeFromTitle);
                    console.log(`從標題 "${event.summary}" 提取時間: ${timeFromTitle}`);
                }

                // 方法2：從行程開始時間提取（備用）
                const timeFromStart = this.extractTimeFromEvent(event);
                if (timeFromStart) {
                    timeSlotsSet.add(timeFromStart);
                    console.log(`從開始時間提取: ${timeFromStart}`);
                }
            });

            // 轉換為陣列並排序
            const sortedTimes = Array.from(timeSlotsSet).sort();
            
            // 創建時段物件
            sortedTimes.forEach(time => {
                const [hours, minutes] = time.split(':').map(Number);
                let period = ''; // 時段標籤

                if (hours >= 6 && hours < 12) {
                    period = '上午';
                } else if (hours >= 12 && hours < 18) {
                    period = '下午';
                } else {
                    period = '晚上';
                }

                availableSlots.push({
                    time: time,
                    period: period,
                    available: true, // 預設為可預約，後續會檢查衝突
                    source: 'calendar_scan'
                });
            });

            console.log(`掃描完成，找到 ${availableSlots.length} 個時段:`, availableSlots);
            return availableSlots;

        } catch (error) {
            console.error('掃描日曆時段失敗:', error);
            return [];
        }
    }

    /**
     * 檢查動態時段的可用性
     * 
     * 動態時段檢查邏輯：
     * 1. 從讀取日曆掃描到的時段都視為可預約時段
     * 2. 檢查預約日曆（f4ac87ce...）該時段是否已有行程
     * 3. 沒有行程 = 可預約，有行程 = 已滿
     * 
     * @param {Date} date - 要檢查的日期
     * @param {Array} timeSlots - 從讀取日曆掃描到的時段陣列
     * @returns {Promise<Object>} - 時段可用性結果
     */
    async checkDynamicTimeSlotAvailability(date, timeSlots) {
        try {
            const dateKey = this.getDateKey(date);
            
            // 檢查快取
            const cacheKey = `dynamic_${dateKey}`;
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheExpiry) {
                    console.log('使用快取的動態時段資料:', dateKey);
                    return cached.data;
                }
            }

            // 檢查寫入日曆中是否已有預約紀錄
            const bookingEvents = await this.getBookingEventsForDate(date);
            const availability = {};

            // 檢查每個時段的可用性
            timeSlots.forEach(slot => {
                const time = slot.time;
                
                // 檢查預約日曆該時段是否已有行程：沒有行程 = 可預約
                const hasBooking = bookingEvents.some(event => {
                    const eventTime = this.extractTimeFromEvent(event);
                    return eventTime === time;
                });

                availability[time] = {
                    available: !hasBooking, // 沒有行程就可預約
                    status: hasBooking ? '已滿' : '預約',
                    period: slot.period,
                    conflictingEvents: hasBooking ? bookingEvents.filter(event => 
                        this.extractTimeFromEvent(event) === time
                    ) : []
                };
            });

            const result = {
                date: dateKey,
                availability: availability,
                totalSlots: timeSlots.length,
                totalBookings: bookingEvents.length,
                isDynamic: true
            };

            // 更新快取
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            console.log('動態時段可用性檢查完成:', result);
            return result;

        } catch (error) {
            console.error('檢查動態時段可用性失敗:', error);
            // 錯誤時返回所有時段為可預約狀態（因為從讀取日曆掃描到表示可預約）
            const availability = {};
            timeSlots.forEach(slot => {
                availability[slot.time] = {
                    available: true, // 錯誤時預設為可預約
                    status: '預約',
                    period: slot.period,
                    conflictingEvents: [],
                    error: true
                };
            });
            
            return {
                date: this.getDateKey(date),
                availability: availability,
                error: error.message,
                isDynamic: true
            };
        }
    }

    /**
     * 取得寫入日曆中指定日期的預約事件
     * @param {Date} date - 要查詢的日期
     * @returns {Promise<Array>} - 預約事件陣列
     */
    async getBookingEventsForDate(date) {
        if (!this.apiKey || !this.bookingCalendarId) {
            console.warn('無法查詢預約日曆：API Key 或預約日曆ID未設定');
            return [];
        }

        try {
            const events = await this.getEventsForDateFromCalendar(date, this.bookingCalendarId);
            console.log(`預約日曆中找到 ${events.length} 個預約事件`);
            return events;
        } catch (error) {
            console.error('查詢預約日曆失敗:', error);
            return [];
        }
    }
}

// 建立全域實例
window.googleCalendarService = new GoogleCalendarService(); 