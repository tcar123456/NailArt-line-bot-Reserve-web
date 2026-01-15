/**
 * 後台管理系統 - 服務項目管理
 * 提供服務項目的新增、編輯、啟用/停用、排序功能
 */

// 全域變數
let isEditMode = false; // 目前是否處於編輯模式
let originalData = []; // 儲存原始資料，用於取消修改時復原

// 拖拽相關變數
let draggedItem = null; // 目前被拖拽的項目
let originalPlaceholder = null; // 原位置佔位符
let dragStartY = 0; // 拖拽開始的Y座標
let dragStartX = 0; // 拖拽開始的X座標
let dragThreshold = 15; // 觸發取消長按的最小移動距離（增加以要求更穩定的長按）
let longPressTimer = null; // 長按計時器
let longPressDelay = 100; // 長按延遲時間(毫秒)
let isDragging = false; // 是否正在拖拽
let dragOffset = { x: 0, y: 0 }; // 拖拽偏移量

// DOM 元素引用
const editBtn = document.getElementById('editBtn');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const addServiceContainer = document.getElementById('addServiceContainer');
const addServiceBtn = document.getElementById('addServiceBtn');
const serviceOptions = document.getElementById('serviceOptions');
const confirmModal = document.getElementById('confirmModal');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const dragHint = document.getElementById('dragHint');

// 新增的卸甲、延甲相關 DOM 元素引用
const removalOptions = document.getElementById('removalOptions');
const extensionOptions = document.getElementById('extensionOptions');
const extensionQuantitySection = document.getElementById('extensionQuantitySection');
const quantityOptionsList = document.getElementById('quantityOptionsList');
const addQuantityContainer = document.getElementById('addQuantityContainer');
const addQuantityBtn = document.getElementById('addQuantityBtn');

/**
 * 頁面載入完成後初始化
 */
document.addEventListener('DOMContentLoaded', async function() {
    console.log('後台管理系統載入完成');
    initializeEventListeners();
    
    // 從 Google Sheets 載入資料
    await loadSettingsFromSheet();
});

/**
 * 從 Google Sheets 載入設定資料
 */
async function loadSettingsFromSheet() {
    try {
        console.log('📖 開始從 Google Sheets 載入資料...');
        
        // 顯示載入指示
        showLoadingIndicator();
        
        // 呼叫 API 取得設定
        const response = await getAdminSettings();
        
        if (response.success && response.data) {
            console.log('✅ 資料載入成功:', response.data);
            
            // 渲染資料到頁面
            renderSettings(response.data);
            
            // 儲存原始資料
            saveOriginalData();
            
            hideLoadingIndicator();
        } else {
            throw new Error(response.error || '載入資料失敗');
        }
        
    } catch (error) {
        console.error('❌ 從 Google Sheets 載入資料失敗:', error);
        hideLoadingIndicator();
        
        // 如果載入失敗，使用預設的靜態資料
        console.warn('⚠️ 使用預設靜態資料');
        saveOriginalData();
    }
}

/**
 * 渲染設定資料到頁面
 * @param {Object} settings - 設定資料
 */
function renderSettings(settings) {
    console.log('🎨 開始渲染資料到頁面...');
    
    // 渲染服務項目
    if (settings.services && settings.services.length > 0) {
        renderServiceItems(settings.services);
    }
    
    // 渲染卸甲選項
    if (settings.removals && settings.removals.length > 0) {
        renderRemovalOptions(settings.removals);
    }
    
    // 渲染延甲設定
    if (settings.extension) {
        renderExtensionSettings(settings.extension);
    }
    
    console.log('✅ 資料渲染完成');
}

/**
 * 渲染服務項目
 * @param {Array} services - 服務項目陣列
 */
function renderServiceItems(services) {
    const container = serviceOptions;
    container.innerHTML = ''; // 清空現有內容
    
    // 按排序順序排列
    const sortedServices = services.sort((a, b) => a.sort - b.sort);
    
    sortedServices.forEach(service => {
        const itemHTML = `
            <div class="service-item" data-service-id="${service.id}" data-enabled="${service.enabled}" data-sort="${service.sort}">
                <button class="delete-btn hidden" title="刪除此服務項目">×</button>
                <span class="service-text">${escapeHtml(service.name)}</span>
                <input type="text" class="service-edit-input hidden" value="${escapeHtml(service.name)}">
                <div class="edit-controls hidden">
                    <label class="switch">
                        <input type="checkbox" ${service.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <span class="switch-label">啟用</span>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
    });
    
    console.log(`✅ 已渲染 ${sortedServices.length} 個服務項目`);
}

/**
 * 渲染卸甲選項
 * @param {Array} removals - 卸甲選項陣列
 */
function renderRemovalOptions(removals) {
    const container = removalOptions;
    container.innerHTML = ''; // 清空現有內容
    
    // 按排序順序排列
    const sortedRemovals = removals.sort((a, b) => a.sort - b.sort);
    
    sortedRemovals.forEach(removal => {
        const itemHTML = `
            <div class="removal-item" data-removal-id="${removal.id}" data-enabled="${removal.enabled}">
                <button class="delete-btn hidden" title="刪除此選項">×</button>
                <span class="service-text">${escapeHtml(removal.name)}</span>
                <input type="text" class="service-edit-input hidden" value="${escapeHtml(removal.name)}">
                <div class="edit-controls hidden">
                    <label class="switch">
                        <input type="checkbox" ${removal.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <span class="switch-label">啟用</span>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
    });
    
    console.log(`✅ 已渲染 ${sortedRemovals.length} 個卸甲選項`);
}

/**
 * 渲染延甲設定
 * @param {Object} extension - 延甲設定物件
 */
function renderExtensionSettings(extension) {
    // 渲染延甲功能開關
    const extensionContainer = extensionOptions;
    extensionContainer.innerHTML = ''; // 清空現有內容
    
    const extensionId = extension.id || 'EXT10001';
    const extensionEnabled = extension.enabled !== false; // 預設為 true
    
    // 如果延甲功能啟用，數量選項區域應該顯示
    const quantitySectionHidden = extensionEnabled ? '' : 'hidden';
    
    // 生成數量選項的 HTML
    let quantitiesHTML = '';
    if (extension.quantities && extension.quantities.length > 0) {
        const sortedQuantities = extension.quantities.sort((a, b) => a.sort - b.sort);
        sortedQuantities.forEach(quantity => {
            quantitiesHTML += `
                <div class="quantity-item" data-quantity-id="${quantity.id}" data-enabled="${quantity.enabled}">
                    <button class="delete-btn hidden" title="刪除此選項">×</button>
                    <span class="service-text">${escapeHtml(quantity.name)}</span>
                    <input type="text" class="service-edit-input hidden" value="${escapeHtml(quantity.name)}">
                    <div class="edit-controls hidden">
                        <label class="switch">
                            <input type="checkbox" ${quantity.enabled ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <span class="switch-label">啟用</span>
                    </div>
                </div>
            `;
        });
    }
    
    const extensionHTML = `
        <div class="extension-item" data-extension-id="${extensionId}" data-enabled="${extensionEnabled}">
            <span class="service-text">延甲功能</span>
            <div class="edit-controls hidden">
                <label class="switch">
                    <input type="checkbox" ${extensionEnabled ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
                <span class="switch-label">啟用</span>
            </div>
        </div>
        
        <div class="extension-quantity-section ${quantitySectionHidden}" id="extensionQuantitySection">
            <h4 class="quantity-section-title">數量選項</h4>
            <div class="quantity-options-list" id="quantityOptionsList">
                ${quantitiesHTML}
            </div>
            
            <div class="add-quantity-container hidden" id="addQuantityContainer">
                <button class="add-service-btn" id="addQuantityBtn">
                    + 新增數量選項
                </button>
            </div>
        </div>
    `;
    
    extensionContainer.insertAdjacentHTML('beforeend', extensionHTML);
    
    console.log('✅ 已渲染延甲設定', {
        enabled: extensionEnabled,
        quantitiesCount: extension.quantities ? extension.quantities.length : 0
    });
}

/**
 * 渲染延甲數量選項
 * @param {Array} quantities - 數量選項陣列
 */
function renderQuantityOptions(quantities) {
    const container = document.getElementById('quantityOptionsList');
    if (!container) return;
    
    container.innerHTML = ''; // 清空現有內容
    
    // 按排序順序排列
    const sortedQuantities = quantities.sort((a, b) => a.sort - b.sort);
    
    sortedQuantities.forEach(quantity => {
        const itemHTML = `
            <div class="quantity-item" data-quantity-id="${quantity.id}" data-enabled="${quantity.enabled}">
                <button class="delete-btn hidden" title="刪除此選項">×</button>
                <span class="service-text">${escapeHtml(quantity.name)}</span>
                <input type="text" class="service-edit-input hidden" value="${escapeHtml(quantity.name)}">
                <div class="edit-controls hidden">
                    <label class="switch">
                        <input type="checkbox" ${quantity.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <span class="switch-label">啟用</span>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
    });
    
    console.log(`✅ 已渲染 ${sortedQuantities.length} 個延甲數量選項`);
}

/**
 * HTML 轉義（防止 XSS）
 * @param {string} text - 要轉義的文字
 * @returns {string} 轉義後的文字
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * 顯示載入指示器
 */
function showLoadingIndicator() {
    // 在服務項目容器顯示載入中
    if (serviceOptions) {
        serviceOptions.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #8b7d8b;">
                <div style="font-size: 24px; margin-bottom: 10px;">⏳</div>
                <div>載入中...</div>
            </div>
        `;
    }
}

/**
 * 隱藏載入指示器
 */
function hideLoadingIndicator() {
    // 載入指示器會被實際資料替換，所以不需要特別處理
}

/**
 * 初始化事件監聽器
 */
function initializeEventListeners() {
    // 編輯按鈕點擊事件
    editBtn.addEventListener('click', function() {
        console.log('進入編輯模式');
        enterEditMode();
    });

    // 送出按鈕點擊事件
    submitBtn.addEventListener('click', function() {
        console.log('準備送出變更');
        showConfirmModal();
    });

    // 取消按鈕點擊事件
    cancelBtn.addEventListener('click', function() {
        console.log('取消編輯，復原資料');
        exitEditMode();
        restoreOriginalData();
    });

    // 新增服務項目按鈕點擊事件
    addServiceBtn.addEventListener('click', function() {
        console.log('新增服務項目');
        addNewServiceItem();
    });
    
    // 新增數量選項按鈕點擊事件（使用事件委派，因為按鈕是動態生成的）
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'addQuantityBtn') {
            console.log('新增延甲數量選項');
            addNewQuantityOption();
        }
    });

    // 模態框按鈕事件
    modalCancelBtn.addEventListener('click', function() {
        console.log('取消儲存變更');
        hideConfirmModal();
    });

    modalConfirmBtn.addEventListener('click', function() {
        console.log('確認儲存變更');
        saveChanges();
        hideConfirmModal();
        exitEditMode();
    });

    // 點擊模態框背景關閉
    confirmModal.addEventListener('click', function(e) {
        if (e.target === confirmModal) {
            hideConfirmModal();
        }
    });
}

/**
 * 進入編輯模式
 */
function enterEditMode() {
    isEditMode = true;
    
    // 儲存當前資料作為原始資料
    saveOriginalData();
    
    // 切換按鈕顯示狀態
    editBtn.classList.add('hidden');
    submitBtn.classList.remove('hidden');
    cancelBtn.classList.remove('hidden');
    addServiceContainer.classList.remove('hidden');
    
    // 為按鈕容器添加編輯模式類別
    document.querySelector('.button-container').classList.add('edit-mode');
    
    // 顯示拖拽提示
    if (dragHint) {
        dragHint.classList.add('show');
    }
    
    // 轉換所有服務項目為編輯模式
    const serviceItems = document.querySelectorAll('.service-item');
    serviceItems.forEach(function(item, index) {
        convertToEditMode(item);
        // 為編輯模式下的服務項目添加拖拽功能
        addDragAndDropFunctionality(item);
    });
    
    // 轉換所有卸甲選項為編輯模式
    const removalItems = document.querySelectorAll('.removal-item');
    removalItems.forEach(function(item) {
        convertToEditMode(item);
    });
    
    // 轉換延甲選項為編輯模式
    const extensionItems = document.querySelectorAll('.extension-item');
    extensionItems.forEach(function(item) {
        convertToEditMode(item);
    });
    
    // 顯示延甲數量選項區域（如果延甲功能啟用）
    const extensionMainItem = document.querySelector('.extension-item');
    if (extensionMainItem && extensionMainItem.getAttribute('data-enabled') === 'true') {
        if (extensionQuantitySection) {
            extensionQuantitySection.classList.remove('hidden');
        }
        if (addQuantityContainer) {
            addQuantityContainer.classList.remove('hidden');
        }
    }
    
    // 轉換所有數量選項為編輯模式
    const quantityItems = document.querySelectorAll('.quantity-item');
    quantityItems.forEach(function(item) {
        convertToEditMode(item);
    });
    
    console.log('已進入編輯模式，共 ' + serviceItems.length + ' 個服務項目，' + 
                removalItems.length + ' 個卸甲選項，' + 
                quantityItems.length + ' 個數量選項');
}

/**
 * 離開編輯模式
 */
function exitEditMode() {
    isEditMode = false;
    
    // 切換按鈕顯示狀態
    editBtn.classList.remove('hidden');
    submitBtn.classList.add('hidden');
    cancelBtn.classList.add('hidden');
    addServiceContainer.classList.add('hidden');
    
    // 移除按鈕容器的編輯模式類別
    document.querySelector('.button-container').classList.remove('edit-mode');
    
    // 隱藏拖拽提示
    if (dragHint) {
        dragHint.classList.remove('show');
    }
    
    // 轉換所有服務項目為檢視模式
    const serviceItems = document.querySelectorAll('.service-item');
    serviceItems.forEach(function(item) {
        convertToViewMode(item);
        // 移除拖拽功能
        removeDragAndDropFunctionality(item);
    });
    
    // 轉換所有卸甲選項為檢視模式
    const removalItems = document.querySelectorAll('.removal-item');
    removalItems.forEach(function(item) {
        convertToViewMode(item);
    });
    
    // 轉換延甲選項為檢視模式
    const extensionItems = document.querySelectorAll('.extension-item');
    extensionItems.forEach(function(item) {
        convertToViewMode(item);
    });
    
    // 隱藏延甲數量選項區域和新增按鈕
    if (extensionQuantitySection) {
        extensionQuantitySection.classList.add('hidden');
    }
    if (addQuantityContainer) {
        addQuantityContainer.classList.add('hidden');
    }
    
    // 轉換所有數量選項為檢視模式
    const quantityItems = document.querySelectorAll('.quantity-item');
    quantityItems.forEach(function(item) {
        convertToViewMode(item);
    });
    
    console.log('已離開編輯模式');
}

/**
 * 將服務項目轉換為編輯模式（支援多種項目類型）
 * @param {Element} item - 項目DOM元素（可以是 service-item, removal-item, extension-item, quantity-item）
 */
function convertToEditMode(item) {
    const serviceText = item.querySelector('.service-text');
    const editInput = item.querySelector('.service-edit-input');
    const editControls = item.querySelector('.edit-controls');
    const deleteBtn = item.querySelector('.delete-btn');
    
    // 如果是延甲主項目，添加特殊處理
    if (item.classList.contains('extension-item')) {
        // 顯示控制項
        if (editControls) {
            editControls.classList.remove('hidden');
        }
        
        // 設定開關狀態
        const isEnabled = item.getAttribute('data-enabled') === 'true';
        const checkbox = editControls.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = isEnabled;
            
            // 為開關添加事件監聽器 - 控制數量選項區域顯示
            const existingCheckboxHandler = checkbox.onchangeHandler;
            if (existingCheckboxHandler) {
                checkbox.removeEventListener('change', existingCheckboxHandler);
            }
            
            const checkboxHandler = function() {
                const isChecked = this.checked;
                item.setAttribute('data-enabled', isChecked);
                
                // 控制數量選項區域的顯示/隱藏
                if (isChecked) {
                    item.classList.remove('disabled');
                    if (extensionQuantitySection) {
                        extensionQuantitySection.classList.remove('hidden');
                    }
                    if (addQuantityContainer) {
                        addQuantityContainer.classList.remove('hidden');
                    }
                } else {
                    item.classList.add('disabled');
                    if (extensionQuantitySection) {
                        extensionQuantitySection.classList.add('hidden');
                    }
                    if (addQuantityContainer) {
                        addQuantityContainer.classList.add('hidden');
                    }
                }
                
                console.log('延甲功能啟用狀態變更:', isChecked);
            };
            checkbox.onchangeHandler = checkboxHandler;
            checkbox.addEventListener('change', checkboxHandler);
        }
        
        return; // 延甲主項目只需要開關功能，不需要輸入框
    }
    
    // 隱藏文字，顯示輸入框、控制項和刪除按鈕
    serviceText.classList.add('hidden');
    editInput.classList.remove('hidden');
    editControls.classList.remove('hidden');
    if (deleteBtn) {
        deleteBtn.classList.remove('hidden');
    }
    
    // 確保輸入框的值與顯示文字一致
    editInput.value = serviceText.textContent;
    
    // 根據 data-enabled 屬性設定開關狀態
    const isEnabled = item.getAttribute('data-enabled') === 'true';
    const checkbox = editControls.querySelector('input[type="checkbox"]');
    checkbox.checked = isEnabled;
    
    // 根據啟用狀態設定項目樣式
    if (!isEnabled) {
        item.classList.add('disabled');
    }
    
    // 為開關添加事件監聽器（移除舊的再添加新的）
    const existingCheckboxHandler = checkbox.onchangeHandler;
    if (existingCheckboxHandler) {
        checkbox.removeEventListener('change', existingCheckboxHandler);
    }
    
    const checkboxHandler = function() {
        const isChecked = this.checked;
        item.setAttribute('data-enabled', isChecked);
        
        if (isChecked) {
            item.classList.remove('disabled');
        } else {
            item.classList.add('disabled');
        }
        
        console.log('服務項目啟用狀態變更:', editInput.value, '啟用:', isChecked);
    };
    checkbox.onchangeHandler = checkboxHandler;
    checkbox.addEventListener('change', checkboxHandler);
    
    // 為輸入框添加實時更新事件（移除舊的再添加新的）
    const existingInputHandler = editInput.oninputHandler;
    if (existingInputHandler) {
        editInput.removeEventListener('input', existingInputHandler);
    }
    
    const inputHandler = function() {
        console.log('服務項目名稱變更:', this.value);
    };
    editInput.oninputHandler = inputHandler;
    editInput.addEventListener('input', inputHandler);
    
    // 為刪除按鈕添加事件監聽器（移除舊的再添加新的）
    if (deleteBtn) {
        const existingDeleteHandler = deleteBtn.onclickHandler;
        if (existingDeleteHandler) {
            deleteBtn.removeEventListener('click', existingDeleteHandler);
        }
        
        const deleteHandler = function(e) {
            e.stopPropagation(); // 防止觸發拖拽
            deleteServiceItem(item);
        };
        deleteBtn.onclickHandler = deleteHandler;
        deleteBtn.addEventListener('click', deleteHandler);
    }
}

/**
 * 將項目轉換為檢視模式（支援多種項目類型）
 * @param {Element} item - 項目DOM元素（可以是 service-item, removal-item, extension-item, quantity-item）
 */
function convertToViewMode(item) {
    const serviceText = item.querySelector('.service-text');
    const editInput = item.querySelector('.service-edit-input');
    const editControls = item.querySelector('.edit-controls');
    const deleteBtn = item.querySelector('.delete-btn');
    
    // 如果是延甲主項目，只需隱藏控制項
    if (item.classList.contains('extension-item')) {
        if (editControls) {
            editControls.classList.add('hidden');
        }
        
        // 根據啟用狀態更新樣式
        const isEnabled = item.getAttribute('data-enabled') === 'true';
        if (!isEnabled) {
            item.classList.add('disabled');
        } else {
            item.classList.remove('disabled');
        }
        
        return;
    }
    
    // 更新顯示文字為輸入框的值（如果有輸入框）
    if (editInput) {
        serviceText.textContent = editInput.value;
    }
    
    // 顯示文字，隱藏輸入框、控制項和刪除按鈕
    if (serviceText) {
        serviceText.classList.remove('hidden');
    }
    if (editInput) {
        editInput.classList.add('hidden');
    }
    if (editControls) {
        editControls.classList.add('hidden');
    }
    if (deleteBtn) {
        deleteBtn.classList.add('hidden');
    }
    
    // 根據啟用狀態更新樣式
    const isEnabled = item.getAttribute('data-enabled') === 'true';
    if (!isEnabled) {
        item.classList.add('disabled');
    } else {
        item.classList.remove('disabled');
    }
}

/**
 * 生成隨機 ID
 * @param {string} prefix - ID 前綴（例：SER, REM, EXT, EXT-Q）
 * @returns {string} 生成的 ID
 */
function generateRandomId(prefix) {
    // 生成 5 位隨機數字
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return prefix + randomNum;
}

/**
 * 檢查 ID 是否已存在
 * @param {string} id - 要檢查的 ID
 * @param {string} selector - 選擇器
 * @returns {boolean} ID 是否已存在
 */
function isIdExists(id, selector) {
    const items = document.querySelectorAll(selector);
    for (let item of items) {
        const existingId = item.getAttribute('data-service-id') || 
                          item.getAttribute('data-removal-id') || 
                          item.getAttribute('data-extension-id') || 
                          item.getAttribute('data-quantity-id');
        if (existingId === id) {
            return true;
        }
    }
    return false;
}

/**
 * 生成唯一的隨機 ID
 * @param {string} prefix - ID 前綴
 * @param {string} selector - 選擇器用於檢查重複
 * @returns {string} 唯一的 ID
 */
function generateUniqueId(prefix, selector) {
    let id;
    let attempts = 0;
    const maxAttempts = 100; // 防止無限迴圈
    
    do {
        id = generateRandomId(prefix);
        attempts++;
        if (attempts >= maxAttempts) {
            console.error('無法生成唯一 ID，已達到最大嘗試次數');
            // 使用時間戳作為後備方案
            id = prefix + Date.now().toString().slice(-5);
            break;
        }
    } while (isIdExists(id, selector));
    
    return id;
}

/**
 * 新增延甲數量選項
 */
function addNewQuantityOption() {
    // 生成唯一的數量選項 ID（EXT-Q + 5位數字）
    const newId = generateUniqueId('EXT-Q', '.quantity-item');
    
    // 創建新的數量選項HTML
    const newItemHTML = `
        <div class="quantity-item" data-quantity-id="${newId}" data-enabled="true">
            <button class="delete-btn hidden" title="刪除此選項">×</button>
            <span class="service-text">新數量選項</span>
            <input type="text" class="service-edit-input" value="新數量選項">
            <div class="edit-controls">
                <label class="switch">
                    <input type="checkbox" checked>
                    <span class="slider"></span>
                </label>
                <span class="switch-label">啟用</span>
            </div>
        </div>
    `;
    
    // 將新項目添加到容器中
    quantityOptionsList.insertAdjacentHTML('beforeend', newItemHTML);
    
    // 獲取新添加的項目並設定為編輯模式
    const newItem = quantityOptionsList.lastElementChild;
    convertToEditMode(newItem);
    
    // 自動聚焦到新項目的輸入框
    const newInput = newItem.querySelector('.service-edit-input');
    newInput.focus();
    newInput.select(); // 選中所有文字，方便用戶輸入
    
    console.log('已新增數量選項，ID:', newId);
}

/**
 * 新增服務項目
 */
function addNewServiceItem() {
    // 生成唯一的服務 ID（SER + 5位數字）
    const newId = generateUniqueId('SER', '.service-item');
    
    // 計算新項目的排序順序（服務項目區塊內獨立排序）
    const existingItems = document.querySelectorAll('.service-item');
    const nextSort = existingItems.length + 1;
    
    // 創建新的服務項目HTML
    const newItemHTML = `
        <div class="service-item" data-service-id="${newId}" data-enabled="true" data-sort="${nextSort}">
            <button class="delete-btn hidden" title="刪除此服務項目">×</button>
            <span class="service-text">新服務項目</span>
            <input type="text" class="service-edit-input" value="新服務項目">
            <div class="edit-controls">
                <label class="switch">
                    <input type="checkbox" checked>
                    <span class="slider"></span>
                </label>
                <span class="switch-label">啟用</span>
            </div>
        </div>
    `;
    
    // 將新項目添加到容器中
    serviceOptions.insertAdjacentHTML('beforeend', newItemHTML);
    
    // 獲取新添加的項目並設定為編輯模式
    const newItem = serviceOptions.lastElementChild;
    convertToEditMode(newItem);
    
    // 為新項目添加拖拽功能
    addDragAndDropFunctionality(newItem);
    
    // 自動聚焦到新項目的輸入框
    const newInput = newItem.querySelector('.service-edit-input');
    newInput.focus();
    newInput.select(); // 選中所有文字，方便用戶輸入
    
    console.log('已新增服務項目，ID:', newId);
}

/**
 * 儲存原始資料（包含所有選項）
 */
function saveOriginalData() {
    originalData = {
        services: [],
        removals: [],
        extension: null,
        quantities: []
    };
    
    // 儲存服務項目
    const serviceItems = document.querySelectorAll('.service-item');
    serviceItems.forEach(function(item) {
        const itemData = {
            id: item.getAttribute('data-service-id'),
            name: item.querySelector('.service-text').textContent,
            enabled: item.getAttribute('data-enabled') === 'true',
            sort: parseInt(item.getAttribute('data-sort')) || 0
        };
        originalData.services.push(itemData);
    });
    
    // 儲存卸甲選項
    const removalItems = document.querySelectorAll('.removal-item');
    removalItems.forEach(function(item) {
        const itemData = {
            id: item.getAttribute('data-removal-id'),
            name: item.querySelector('.service-text').textContent,
            enabled: item.getAttribute('data-enabled') === 'true'
        };
        originalData.removals.push(itemData);
    });
    
    // 儲存延甲功能啟用狀態
    const extensionMainItem = document.querySelector('.extension-item');
    if (extensionMainItem) {
        originalData.extension = {
            id: extensionMainItem.getAttribute('data-extension-id'),
            enabled: extensionMainItem.getAttribute('data-enabled') === 'true'
        };
    }
    
    // 儲存延甲數量選項
    const quantityItems = document.querySelectorAll('.quantity-item');
    quantityItems.forEach(function(item) {
        const itemData = {
            id: item.getAttribute('data-quantity-id'),
            name: item.querySelector('.service-text').textContent,
            enabled: item.getAttribute('data-enabled') === 'true'
        };
        originalData.quantities.push(itemData);
    });
    
    console.log('已儲存原始資料:', originalData);
}

/**
 * 復原原始資料（包含所有選項）
 */
function restoreOriginalData() {
    // 復原服務項目
    serviceOptions.innerHTML = '';
    originalData.services.forEach(function(itemData) {
        const itemHTML = `
            <div class="service-item" data-service-id="${itemData.id}" data-enabled="${itemData.enabled}" data-sort="${itemData.sort}">
                <button class="delete-btn hidden" title="刪除此服務項目">×</button>
                <span class="service-text">${itemData.name}</span>
                <input type="text" class="service-edit-input hidden" value="${itemData.name}">
                <div class="edit-controls hidden">
                    <label class="switch">
                        <input type="checkbox" ${itemData.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <span class="switch-label">啟用</span>
                </div>
            </div>
        `;
        serviceOptions.insertAdjacentHTML('beforeend', itemHTML);
    });
    
    // 復原卸甲選項
    removalOptions.innerHTML = '';
    originalData.removals.forEach(function(itemData) {
        const itemHTML = `
            <div class="removal-item" data-removal-id="${itemData.id}" data-enabled="${itemData.enabled}">
                <button class="delete-btn hidden" title="刪除此選項">×</button>
                <span class="service-text">${itemData.name}</span>
                <input type="text" class="service-edit-input hidden" value="${itemData.name}">
                <div class="edit-controls hidden">
                    <label class="switch">
                        <input type="checkbox" ${itemData.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <span class="switch-label">啟用</span>
                </div>
            </div>
        `;
        removalOptions.insertAdjacentHTML('beforeend', itemHTML);
    });
    
    // 復原延甲功能啟用狀態
    const extensionMainItem = document.querySelector('.extension-item');
    if (extensionMainItem && originalData.extension) {
        extensionMainItem.setAttribute('data-extension-id', originalData.extension.id);
        extensionMainItem.setAttribute('data-enabled', originalData.extension.enabled);
        if (!originalData.extension.enabled) {
            extensionMainItem.classList.add('disabled');
        } else {
            extensionMainItem.classList.remove('disabled');
        }
    }
    
    // 復原延甲數量選項
    quantityOptionsList.innerHTML = '';
    originalData.quantities.forEach(function(itemData) {
        const itemHTML = `
            <div class="quantity-item" data-quantity-id="${itemData.id}" data-enabled="${itemData.enabled}">
                <button class="delete-btn hidden" title="刪除此選項">×</button>
                <span class="service-text">${itemData.name}</span>
                <input type="text" class="service-edit-input hidden" value="${itemData.name}">
                <div class="edit-controls hidden">
                    <label class="switch">
                        <input type="checkbox" ${itemData.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <span class="switch-label">啟用</span>
                </div>
            </div>
        `;
        quantityOptionsList.insertAdjacentHTML('beforeend', itemHTML);
    });
    
    console.log('已復原原始資料');
}

/**
 * 顯示確認模態框
 */
function showConfirmModal() {
    confirmModal.classList.remove('hidden');
    
    // 防止背景滾動
    document.body.style.overflow = 'hidden';
}

/**
 * 隱藏確認模態框
 */
function hideConfirmModal() {
    confirmModal.classList.add('hidden');
    
    // 恢復背景滾動
    document.body.style.overflow = '';
}

/**
 * 儲存變更到 Google Sheets
 */
async function saveChanges() {
    try {
        console.log('🚀 開始儲存變更...');
        
        // 1. 收集所有資料
        const settingsData = {
            services: collectServiceItems(),
            removals: collectRemovalOptions(),
            extension: collectExtensionSettings()
        };
        
        // 2. 驗證資料
        if (!validateSettings(settingsData)) {
            return; // 驗證失敗，不繼續
        }
        
        console.log('📦 準備儲存的資料:', settingsData);
        
        // 3. 取得 CSRF Token
        let csrfToken = '';
        if (typeof getCSRFToken === 'function') {
            csrfToken = getCSRFToken();
            console.log('🔒 已取得 CSRF Token');
        } else {
            console.warn('⚠️ csrf-protection.js 未載入，無 CSRF 保護');
        }
        
        // 4. 取得用戶 ID（暫時使用固定值，實際應從 LIFF 取得）
        const userId = 'admin'; // TODO: 從 LIFF 取得實際用戶 ID
        
        // 5. 顯示載入狀態
        showLoadingState();
        
        // 6. 呼叫 API 更新設定
        const result = await updateAdminSettings(settingsData, userId, csrfToken);
        
        // 7. 處理結果
        if (result.success) {
            console.log('✅ 儲存成功！更新了', result.itemsUpdated, '筆資料');
            
            // 更新本地的原始資料
            saveOriginalData();
            
            // 隱藏載入狀態並顯示成功訊息
            hideLoadingState();
            showSuccessMessage('設定已成功儲存到 Google Sheets！');
        } else {
            throw new Error(result.error || '儲存失敗');
        }
        
    } catch (error) {
        console.error('❌ 儲存變更時發生錯誤:', error);
        hideLoadingState();
        showErrorMessage('儲存失敗：' + error.message);
    }
}

/**
 * 收集服務項目資料
 * @returns {Array} 服務項目陣列
 */
function collectServiceItems() {
    const items = [];
    const serviceItems = document.querySelectorAll('.service-item');
    
    serviceItems.forEach(function(item, index) {
        const serviceId = item.getAttribute('data-service-id');
        const serviceName = item.querySelector('.service-edit-input').value.trim();
        const isEnabled = item.querySelector('.edit-controls input[type="checkbox"]').checked;
        const sortOrder = index + 1; // 根據目前順序設定排序
        
        items.push({
            id: serviceId,
            name: serviceName,
            enabled: isEnabled,
            sort: sortOrder
        });
        
        // 更新 DOM 屬性
        item.setAttribute('data-enabled', isEnabled);
        item.setAttribute('data-sort', sortOrder);
    });
    
    return items;
}

/**
 * 收集卸甲選項資料
 * @returns {Array} 卸甲選項陣列
 */
function collectRemovalOptions() {
    const options = [];
    const removalItems = document.querySelectorAll('.removal-item');
    
    removalItems.forEach(function(item) {
        const removalId = item.getAttribute('data-removal-id');
        const removalName = item.querySelector('.service-edit-input').value.trim();
        const isEnabled = item.querySelector('.edit-controls input[type="checkbox"]').checked;
        
        options.push({
            id: removalId,
            name: removalName,
            enabled: isEnabled
        });
        
        // 更新 DOM 屬性
        item.setAttribute('data-enabled', isEnabled);
    });
    
    return options;
}

/**
 * 收集延甲設定資料
 * @returns {Object} 延甲設定物件
 */
function collectExtensionSettings() {
    const mainItem = document.querySelector('.extension-item');
    const extensionEnabled = mainItem ? (mainItem.getAttribute('data-enabled') === 'true') : false;
    const extensionId = mainItem ? mainItem.getAttribute('data-extension-id') : 'EXT10001';
    
    const quantities = [];
    const quantityItems = document.querySelectorAll('.quantity-item');
    
    quantityItems.forEach(function(item, index) {
        const quantityId = item.getAttribute('data-quantity-id');
        const quantityName = item.querySelector('.service-edit-input').value.trim();
        const isEnabled = item.querySelector('.edit-controls input[type="checkbox"]').checked;
        
        quantities.push({
            id: quantityId,
            name: quantityName,
            enabled: isEnabled,
            sort: index + 1
        });
        
        // 更新 DOM 屬性
        item.setAttribute('data-enabled', isEnabled);
    });
    
    return {
        enabled: extensionEnabled,
        id: extensionId,  // 包含延甲的 ID
        quantities: quantities
    };
}

/**
 * 驗證設定資料
 * @param {Object} settings - 設定資料
 * @returns {boolean} 驗證是否通過
 */
function validateSettings(settings) {
    // 驗證服務項目名稱不能為空
    for (let service of settings.services) {
        if (!service.name || service.name.trim() === '') {
            showErrorMessage('服務項目名稱不能為空！');
            return false;
        }
    }
    
    // 驗證卸甲選項名稱不能為空
    for (let removal of settings.removals) {
        if (!removal.name || removal.name.trim() === '') {
            showErrorMessage('卸甲選項名稱不能為空！');
            return false;
        }
    }
    
    // 驗證延甲數量選項名稱不能為空
    for (let quantity of settings.extension.quantities) {
        if (!quantity.name || quantity.name.trim() === '') {
            showErrorMessage('延甲數量選項名稱不能為空！');
            return false;
        }
    }
    
    return true;
}

/**
 * 顯示載入狀態
 */
function showLoadingState() {
    // 停用所有按鈕
    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    
    // 變更按鈕文字
    submitBtn.textContent = '儲存中...';
    
    console.log('⏳ 顯示載入狀態');
}

/**
 * 隱藏載入狀態
 */
function hideLoadingState() {
    // 啟用所有按鈕
    submitBtn.disabled = false;
    cancelBtn.disabled = false;
    
    // 恢復按鈕文字
    submitBtn.textContent = '送出';
    
    console.log('✅ 隱藏載入狀態');
}

/**
 * 顯示錯誤訊息
 * @param {string} message - 錯誤訊息
 */
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #e6b3ba;
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        font-weight: 600;
        z-index: 2000;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 4px 12px rgba(230, 179, 186, 0.3);
        max-width: 300px;
    `;
    errorDiv.innerHTML = `❌ ${message}`;
    
    document.body.appendChild(errorDiv);
    
    // 5秒後自動移除
    setTimeout(function() {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

/**
 * 模擬API儲存 (將來替換為真實的API呼叫)
 * @param {Array} data - 要儲存的服務項目資料
 */
function simulateSaveToAPI(data) {
    console.log('模擬API儲存中...');
    
    // 模擬網路延遲
    setTimeout(function() {
        console.log('儲存成功！', data);
        
        // 更新原始資料為當前資料
        originalData = [...data];
        
        // 顯示成功訊息 (可選)
        showSuccessMessage();
    }, 500);
}

/**
 * 刪除服務項目
 * @param {Element} item - 要刪除的服務項目DOM元素
 */
function deleteServiceItem(item) {
    const serviceName = item.querySelector('.service-edit-input').value || 
                       item.querySelector('.service-text').textContent;
    
    console.log('刪除服務項目:', serviceName);
    
    // 添加刪除動畫
    item.style.transition = 'all 0.3s ease';
    item.style.opacity = '0';
    item.style.transform = 'translateX(-100%)';
    
    // 動畫完成後移除元素
    setTimeout(function() {
        if (item.parentNode) {
            item.parentNode.removeChild(item);
        }
    }, 300);
    
    // 顯示刪除成功訊息
    showDeleteMessage(serviceName);
}

/**
 * 顯示刪除成功訊息
 * @param {string} serviceName - 被刪除的服務項目名稱
 */
function showDeleteMessage(serviceName) {
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #e6b3ba;
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        font-weight: 600;
        z-index: 2000;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 4px 12px rgba(230, 179, 186, 0.3);
    `;
    message.innerHTML = `已刪除「${serviceName}」`;
    
    document.body.appendChild(message);
    
    // 3秒後自動移除
    setTimeout(function() {
        if (message.parentNode) {
            message.parentNode.removeChild(message);
        }
    }, 3000);
}

/**
 * 顯示成功訊息
 */
function showSuccessMessage() {
    // 簡單的成功提示
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #a8c8a8;
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        font-weight: 600;
        z-index: 2000;
        animation: slideInRight 0.3s ease;
    `;
    message.textContent = '儲存成功！';
    
    document.body.appendChild(message);
    
    // 3秒後自動移除
    setTimeout(function() {
        if (message.parentNode) {
            message.parentNode.removeChild(message);
        }
    }, 3000);
}

/**
 * 鍵盤快捷鍵支援
 */
document.addEventListener('keydown', function(e) {
    // Ctrl+S 或 Cmd+S 儲存變更
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isEditMode) {
            showConfirmModal();
        }
    }
    
    // ESC 取消編輯
    if (e.key === 'Escape') {
        if (isEditMode) {
            exitEditMode();
            restoreOriginalData();
        } else if (!confirmModal.classList.contains('hidden')) {
            hideConfirmModal();
        }
    }
});

/**
 * 工具函數：debounce 防抖動
 * @param {Function} func - 要執行的函數
 * @param {number} wait - 等待時間(毫秒)
 * @returns {Function} - 防抖動後的函數
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 為服務項目添加拖拽功能
 * @param {Element} item - 服務項目DOM元素
 */
function addDragAndDropFunctionality(item) {
    // 添加可拖拽的視覺提示
    item.classList.add('draggable');
    
    // 觸控事件（手機）- 使用passive模式以支持更好的滾動性能
    item.addEventListener('touchstart', handleTouchStart, { passive: true });
    item.addEventListener('touchmove', handleTouchMove, { passive: false }); // 仍需要能夠阻止預設行為
    item.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // 滑鼠事件（桌面）
    item.addEventListener('mousedown', handleMouseDown);
}

/**
 * 移除服務項目的拖拽功能
 * @param {Element} item - 服務項目DOM元素
 */
function removeDragAndDropFunctionality(item) {
    // 移除可拖拽的視覺提示
    item.classList.remove('draggable');
    
    // 移除所有事件監聽器
    item.removeEventListener('touchstart', handleTouchStart);
    item.removeEventListener('touchmove', handleTouchMove);
    item.removeEventListener('touchend', handleTouchEnd);
    item.removeEventListener('mousedown', handleMouseDown);
}

/**
 * 處理觸控開始（手機）
 */
function handleTouchStart(e) {
    // 防止在點擊輸入框、開關或刪除按鈕時觸發拖拽
    if (e.target.matches('input, .slider, .switch, .delete-btn') || 
        e.target.closest('.switch, .delete-btn')) {
        return;
    }
    
    // 不要阻止預設行為，允許正常的頁面滾動
    // e.preventDefault(); // 移除這行，讓頁面可以正常滾動
    
    const touch = e.touches[0];
    startDragSequence(e.currentTarget, touch.clientX, touch.clientY);
}

/**
 * 處理滑鼠按下（桌面）
 */
function handleMouseDown(e) {
    // 防止在點擊輸入框、開關或刪除按鈕時觸發拖拽
    if (e.target.matches('input, .slider, .switch, .delete-btn') || 
        e.target.closest('.switch, .delete-btn')) {
        return;
    }
    
    // 防止文字選擇
    e.preventDefault();
    
    startDragSequence(e.currentTarget, e.clientX, e.clientY);
    
    // 為文檔添加全域滑鼠事件監聽器
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // 為文檔添加防止文字選擇的事件監聽器
    document.addEventListener('selectstart', preventSelection);
    document.addEventListener('dragstart', preventSelection);
}

/**
 * 開始拖拽序列
 * @param {Element} item - 項目元素
 * @param {number} startX - 開始X座標
 * @param {number} startY - 開始Y座標
 */
function startDragSequence(item, startX, startY) {
    draggedItem = item;
    dragStartX = startX;
    dragStartY = startY;
    isDragging = false;
    
    // 計算拖拽偏移量（滑鼠/手指相對於元素的位置）
    const rect = item.getBoundingClientRect();
    dragOffset.x = startX - rect.left;
    dragOffset.y = startY - rect.top;
    
    // 添加長按視覺效果
    item.classList.add('long-pressing');
    
    // 設定長按計時器
    longPressTimer = setTimeout(function() {
        if (draggedItem) {
            // 只有長按計時器完成才開始拖拽
            console.log('長按時間完成，開始拖拽');
            startDragging(startX, startY);
        }
    }, longPressDelay);
    
    console.log('開始長按檢測 (需保持100ms不移動，可正常滾動):', item.querySelector('.service-text').textContent);
}

/**
 * 處理觸控移動（手機）
 */
function handleTouchMove(e) {
    if (!draggedItem) {
        // 如果沒有拖拽項目，允許正常滾動
        return;
    }
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - dragStartX);
    const deltaY = Math.abs(touch.clientY - dragStartY);
    const totalDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (isDragging) {
        // 只有在已經進入拖拽狀態後才阻止滾動並移動項目
        e.preventDefault(); // 防止頁面滾動
        updateDragPosition(touch.clientX, touch.clientY);
    } else if (totalDelta > dragThreshold) {
        // 移動超過閾值，判斷是否為垂直滾動
        if (deltaY > deltaX * 1.5) {
            // 垂直移動較明顯，可能是想滾動頁面，取消長按但不阻止滾動
            clearLongPressTimer();
            endDragSequence();
            // 允許正常的垂直滾動
        } else {
            // 水平移動較明顯，也取消長按
            clearLongPressTimer();
            endDragSequence();
        }
    }
    // 如果還在長按檢測階段且移動距離不大，允許正常滾動
}

/**
 * 處理滑鼠移動（桌面）
 */
function handleMouseMove(e) {
    if (!draggedItem) return;
    
    const deltaX = Math.abs(e.clientX - dragStartX);
    const deltaY = Math.abs(e.clientY - dragStartY);
    const totalDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (isDragging) {
        // 只有在已經進入拖拽狀態後才能移動
        e.preventDefault();
        updateDragPosition(e.clientX, e.clientY);
    } else if (totalDelta > dragThreshold) {
        // 移動超過閾值，取消長按（不自動開始拖拽）
        clearLongPressTimer();
        endDragSequence();
    }
}

/**
 * 開始拖拽
 * @param {number} clientX - 當前X座標
 * @param {number} clientY - 當前Y座標
 */
function startDragging(clientX, clientY) {
    if (!draggedItem || isDragging) return;
    
    console.log('長按完成，項目開始黏在滑鼠/手指上');
    
    isDragging = true;
    draggedItem.classList.remove('long-pressing');
    
    // 為整個頁面添加防止選擇的樣式
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.mozUserSelect = 'none';
    document.body.style.msUserSelect = 'none';
    
    // 創建原位置佔位符
    createOriginalPlaceholder();
    
    // 設定拖拽樣式和位置
    draggedItem.classList.add('dragging');
    updateDragPosition(clientX, clientY);
    
    console.log('項目已黏在游標上，可以開始拖拽排序:', draggedItem.querySelector('.service-text').textContent);
}

/**
 * 創建原位置佔位符
 */
function createOriginalPlaceholder() {
    // 複製原始項目作為佔位符
    originalPlaceholder = draggedItem.cloneNode(true);
    originalPlaceholder.classList.add('drag-placeholder');
    originalPlaceholder.classList.remove('dragging', 'long-pressing');
    
    // 將佔位符插入到原位置
    draggedItem.parentNode.insertBefore(originalPlaceholder, draggedItem);
}

/**
 * 更新拖拽位置
 * @param {number} clientX - 當前X座標
 * @param {number} clientY - 當前Y座標
 */
function updateDragPosition(clientX, clientY) {
    if (!draggedItem) return;
    
    // 將拖拽項目定位到滑鼠/手指位置
    draggedItem.style.left = (clientX - dragOffset.x) + 'px';
    draggedItem.style.top = (clientY - dragOffset.y) + 'px';
    
    // 檢查是否需要重新排序
    checkAndUpdateOrder(clientY);
}

/**
 * 檢查並更新排序
 * @param {number} clientY - 當前Y座標
 */
function checkAndUpdateOrder(clientY) {
    const container = serviceOptions;
    const items = Array.from(container.children).filter(child => 
        child.classList.contains('service-item') && 
        child !== draggedItem && 
        !child.classList.contains('drag-placeholder')
    );
    
    let insertPosition = null;
    
    // 找到應該插入的位置
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rect = item.getBoundingClientRect();
        const itemCenter = rect.top + rect.height / 2;
        
        if (clientY < itemCenter) {
            insertPosition = item;
            break;
        }
    }
    
    // 移動原位置佔位符到新位置
    if (insertPosition) {
        container.insertBefore(originalPlaceholder, insertPosition);
    } else {
        container.appendChild(originalPlaceholder);
    }
}

/**
 * 處理觸控結束（手機）
 */
function handleTouchEnd(e) {
    endDragSequence();
}

/**
 * 處理滑鼠釋放（桌面）
 */
function handleMouseUp(e) {
    // 移除全域滑鼠事件監聽器
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // 移除防止文字選擇的事件監聽器
    document.removeEventListener('selectstart', preventSelection);
    document.removeEventListener('dragstart', preventSelection);
    
    endDragSequence();
}

/**
 * 結束拖拽序列
 */
function endDragSequence() {
    clearLongPressTimer();
    
    // 恢復頁面的文字選擇功能（只有在拖拽狀態下才需要恢復）
    if (isDragging) {
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
        document.body.style.mozUserSelect = '';
        document.body.style.msUserSelect = '';
    }
    
    if (draggedItem) {
        draggedItem.classList.remove('long-pressing', 'dragging');
        
        if (isDragging && originalPlaceholder) {
            // 重置拖拽項目的樣式
            draggedItem.style.position = '';
            draggedItem.style.left = '';
            draggedItem.style.top = '';
            
            // 將拖拽項目移動到佔位符位置
            originalPlaceholder.parentNode.insertBefore(draggedItem, originalPlaceholder);
            originalPlaceholder.remove();
            
            // 更新排序
            updateSortOrder();
            
            console.log('拖拽完成，已更新排序');
        } else {
            // 如果沒有進入拖拽狀態，重置樣式並清理佔位符
            draggedItem.style.position = '';
            draggedItem.style.left = '';
            draggedItem.style.top = '';
            
            if (originalPlaceholder && originalPlaceholder.parentNode) {
                originalPlaceholder.remove();
            }
            
            console.log('長按被取消或未完成');
        }
    }
    
    // 重置狀態
    draggedItem = null;
    isDragging = false;
    originalPlaceholder = null;
    dragOffset = { x: 0, y: 0 };
}

/**
 * 清除長按計時器
 */
function clearLongPressTimer() {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}

/**
 * 更新排序順序
 */
function updateSortOrder() {
    const serviceItems = document.querySelectorAll('.service-item');
    serviceItems.forEach(function(item, index) {
        item.setAttribute('data-sort', index + 1);
    });
    
    console.log('已更新服務項目排序順序');
}

/**
 * 防止文字選擇和拖拽
 * @param {Event} e - 事件對象
 */
function preventSelection(e) {
    // 允許輸入框、開關和刪除按鈕的正常操作
    if (e.target.matches('input, .slider, .switch, .delete-btn') || 
        e.target.closest('.switch, .delete-btn, .service-edit-input')) {
        return true;
    }
    
    e.preventDefault();
    return false;
}

// 添加成功訊息的動畫CSS（動態注入）
const styleElement = document.createElement('style');
styleElement.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
`;
document.head.appendChild(styleElement); 