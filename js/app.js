// 全局变量
// 开发者固定配置的数据源列表（通过 window.ACTIVE_SOURCES 注入）
// 用户在前端无法修改，只能由开发者在代码中调整
const ACTIVE_SOURCES = (window.ACTIVE_SOURCES && Array.isArray(window.ACTIVE_SOURCES) && window.ACTIVE_SOURCES.length)
    ? window.ACTIVE_SOURCES
    : Object.keys(window.API_SITES || {});
// 为兼容后续代码，仍然使用 selectedAPIs 变量名，但不再从 localStorage 读取
let selectedAPIs = ACTIVE_SOURCES.slice();

// 添加当前播放的集数索引
let currentEpisodeIndex = 0;
// 添加当前视频的所有集数
let currentEpisodes = [];
// 添加当前视频的标题
let currentVideoTitle = '';
// 全局变量用于倒序状态
let episodesReversed = false;

// 详情列表统一分页配置：每页 16 个卡片，用于首页推荐和分类筛选的“翻页补齐”
const DETAIL_PAGE_SIZE = 16;
// 为了性能限制向后最多翻多少个 API 页（通常真实页数不会太大）
const DETAIL_MAX_BACKFILL_PAGES = 20;

// 页面初始化
document.addEventListener('DOMContentLoaded', function () {
    // 渲染搜索历史
    renderSearchHistory();

    // 设置事件监听器
    setupEventListeners();

    // 初始化返回顶部按钮
    initBackToTopBtn();
});

// ========== 返回顶部按钮 ==========
// 初始化返回顶部按钮
function initBackToTopBtn() {
    const btn = document.getElementById('backToTopBtn');
    if (!btn) return;

    // 监听滚动事件，控制按钮显示/隐藏
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            btn.classList.remove('opacity-0', 'invisible');
            btn.classList.add('opacity-100', 'visible');
        } else {
            btn.classList.remove('opacity-100', 'visible');
            btn.classList.add('opacity-0', 'invisible');
        }
    });
}

// 滚动到顶部
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}



// 渲染自定义API列表
function renderCustomAPIsList() {
    const container = document.getElementById('customApisList');
    if (!container) return;

    if (customAPIs.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-500 text-center my-2">未添加自定义API</p>';
        return;
    }

    container.innerHTML = '';
    customAPIs.forEach((api, index) => {
        const apiItem = document.createElement('div');
        apiItem.className = 'flex items-center justify-between p-1 mb-1 bg-[#222] rounded';
        const textColorClass = api.isAdult ? 'text-pink-400' : 'text-white';
        const adultTag = api.isAdult ? '<span class="text-xs text-pink-400 mr-1">(18+)</span>' : '';
        // 新增 detail 地址显示
        const detailLine = api.detail ? `<div class="text-xs text-gray-400 truncate">detail: ${api.detail}</div>` : '';
        apiItem.innerHTML = `
            <div class="flex items-center flex-1 min-w-0">
                <input type="checkbox" id="custom_api_${index}" 
                       class="form-checkbox h-3 w-3 text-blue-600 mr-1 ${api.isAdult ? 'api-adult' : ''}" 
                       ${selectedAPIs.includes('custom_' + index) ? 'checked' : ''} 
                       data-custom-index="${index}">
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium ${textColorClass} truncate">
                        ${adultTag}${api.name}
                    </div>
                    <div class="text-xs text-gray-500 truncate">${api.url}</div>
                    ${detailLine}
                </div>
            </div>
            <div class="flex items-center">
                <button class="text-blue-500 hover:text-blue-700 text-xs px-1" onclick="editCustomApi(${index})">✎</button>
                <button class="text-red-500 hover:text-red-700 text-xs px-1" onclick="removeCustomApi(${index})">✕</button>
            </div>
        `;
        container.appendChild(apiItem);
        apiItem.querySelector('input').addEventListener('change', function () {
            updateSelectedAPIs();
            checkAdultAPIsSelected();
        });
    });
}

// 编辑自定义API
function editCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;
    const api = customAPIs[index];
    document.getElementById('customApiName').value = api.name;
    document.getElementById('customApiUrl').value = api.url;
    document.getElementById('customApiDetail').value = api.detail || '';
    const isAdultInput = document.getElementById('customApiIsAdult');
    if (isAdultInput) isAdultInput.checked = api.isAdult || false;
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        form.classList.remove('hidden');
        const buttonContainer = form.querySelector('div:last-child');
        buttonContainer.innerHTML = `
            <button onclick="updateCustomApi(${index})" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">更新</button>
            <button onclick="cancelEditCustomApi()" class="bg-[#444] hover:bg-[#555] text-white px-3 py-1 rounded text-xs">取消</button>
        `;
    }
}

// 更新自定义API
function updateCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;
    const nameInput = document.getElementById('customApiName');
    const urlInput = document.getElementById('customApiUrl');
    const detailInput = document.getElementById('customApiDetail');
    const isAdultInput = document.getElementById('customApiIsAdult');
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    const detail = detailInput ? detailInput.value.trim() : '';
    const isAdult = isAdultInput ? isAdultInput.checked : false;
    if (!name || !url) {
        showToast('请输入API名称和链接', 'warning');
        return;
    }
    if (!/^https?:\/\/.+/.test(url)) {
        showToast('API链接格式不正确，需以http://或https://开头', 'warning');
        return;
    }
    if (url.endsWith('/')) url = url.slice(0, -1);
    // 保存 detail 字段
    customAPIs[index] = { name, url, detail, isAdult };
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
    renderCustomAPIsList();
    checkAdultAPIsSelected();
    restoreAddCustomApiButtons();
    nameInput.value = '';
    urlInput.value = '';
    if (detailInput) detailInput.value = '';
    if (isAdultInput) isAdultInput.checked = false;
    document.getElementById('addCustomApiForm').classList.add('hidden');
    showToast('已更新自定义API: ' + name, 'success');
}

// 取消编辑自定义API
function cancelEditCustomApi() {
    // 清空表单
    document.getElementById('customApiName').value = '';
    document.getElementById('customApiUrl').value = '';
    document.getElementById('customApiDetail').value = '';
    const isAdultInput = document.getElementById('customApiIsAdult');
    if (isAdultInput) isAdultInput.checked = false;

    // 隐藏表单
    document.getElementById('addCustomApiForm').classList.add('hidden');

    // 恢复添加按钮
    restoreAddCustomApiButtons();
}

// 恢复自定义API添加按钮
function restoreAddCustomApiButtons() {
    const form = document.getElementById('addCustomApiForm');
    const buttonContainer = form.querySelector('div:last-child');
    buttonContainer.innerHTML = `
        <button onclick="addCustomApi()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">添加</button>
        <button onclick="cancelAddCustomApi()" class="bg-[#444] hover:bg-[#555] text-white px-3 py-1 rounded text-xs">取消</button>
    `;
}

// 更新选中的API列表
function updateSelectedAPIs() {
    // 获取所有内置API复选框
    const builtInApiCheckboxes = document.querySelectorAll('#apiCheckboxes input:checked');

    // 获取选中的内置API
    const builtInApis = Array.from(builtInApiCheckboxes).map(input => input.dataset.api);

    // 获取选中的自定义API
    const customApiCheckboxes = document.querySelectorAll('#customApisList input:checked');
    const customApiIndices = Array.from(customApiCheckboxes).map(input => 'custom_' + input.dataset.customIndex);

    // 合并内置和自定义API
    selectedAPIs = [...builtInApis, ...customApiIndices];

    // 保存到localStorage
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

    // 更新显示选中的API数量
    updateSelectedApiCount();
}

// 更新选中的API数量显示
function updateSelectedApiCount() {
    const countEl = document.getElementById('selectedApiCount');
    if (countEl) {
        countEl.textContent = selectedAPIs.length;
    }
}

// 全选或取消全选API
function selectAllAPIs(selectAll = true, excludeAdult = false) {
    const checkboxes = document.querySelectorAll('#apiCheckboxes input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        if (excludeAdult && checkbox.classList.contains('api-adult')) {
            checkbox.checked = false;
        } else {
            checkbox.checked = selectAll;
        }
    });

    updateSelectedAPIs();
    checkAdultAPIsSelected();
}

// 显示添加自定义API表单
function showAddCustomApiForm() {
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        form.classList.remove('hidden');
    }
}

// 取消添加自定义API - 修改函数来重用恢复按钮逻辑
function cancelAddCustomApi() {
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        form.classList.add('hidden');
        document.getElementById('customApiName').value = '';
        document.getElementById('customApiUrl').value = '';
        document.getElementById('customApiDetail').value = '';
        const isAdultInput = document.getElementById('customApiIsAdult');
        if (isAdultInput) isAdultInput.checked = false;

        // 确保按钮是添加按钮
        restoreAddCustomApiButtons();
    }
}

// 添加自定义API
function addCustomApi() {
    const nameInput = document.getElementById('customApiName');
    const urlInput = document.getElementById('customApiUrl');
    const detailInput = document.getElementById('customApiDetail');
    const isAdultInput = document.getElementById('customApiIsAdult');
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    const detail = detailInput ? detailInput.value.trim() : '';
    const isAdult = isAdultInput ? isAdultInput.checked : false;
    if (!name || !url) {
        showToast('请输入API名称和链接', 'warning');
        return;
    }
    if (!/^https?:\/\/.+/.test(url)) {
        showToast('API链接格式不正确，需以http://或https://开头', 'warning');
        return;
    }
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    // 保存 detail 字段
    customAPIs.push({ name, url, detail, isAdult });
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
    const newApiIndex = customAPIs.length - 1;
    selectedAPIs.push('custom_' + newApiIndex);
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

    // 重新渲染自定义API列表
    renderCustomAPIsList();
    updateSelectedApiCount();
    checkAdultAPIsSelected();
    nameInput.value = '';
    urlInput.value = '';
    if (detailInput) detailInput.value = '';
    if (isAdultInput) isAdultInput.checked = false;
    document.getElementById('addCustomApiForm').classList.add('hidden');
    showToast('已添加自定义API: ' + name, 'success');
}

// 移除自定义API
function removeCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;

    const apiName = customAPIs[index].name;

    // 从列表中移除API
    customAPIs.splice(index, 1);
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));

    // 从选中列表中移除此API
    const customApiId = 'custom_' + index;
    selectedAPIs = selectedAPIs.filter(id => id !== customApiId);

    // 更新大于此索引的自定义API索引
    selectedAPIs = selectedAPIs.map(id => {
        if (id.startsWith('custom_')) {
            const currentIndex = parseInt(id.replace('custom_', ''));
            if (currentIndex > index) {
                return 'custom_' + (currentIndex - 1);
            }
        }
        return id;
    });

    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

    // 重新渲染自定义API列表
    renderCustomAPIsList();

    // 更新选中的API数量
    updateSelectedApiCount();

    showToast('已移除自定义API: ' + apiName, 'info');
}

// 设置事件监听器
function setupEventListeners() {
    // 回车搜索
    document.getElementById('searchInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            search();
        }
    });

    // 点击外部关闭历史记录面板
    document.addEventListener('click', function (e) {
        // 关闭历史记录面板
        const historyPanel = document.querySelector('#historyPanel.show');
        const historyButton = document.querySelector('#historyPanel .close-btn');

        if (historyPanel && historyButton &&
            !historyPanel.contains(e.target) &&
            !historyButton.contains(e.target)) {
            historyPanel.classList.remove('show');
        }
    });
}

// 重置搜索区域
function resetSearchArea() {
    // 清理搜索结果
    document.getElementById('results').innerHTML = '';
    document.getElementById('searchInput').value = '';

    // 恢复搜索区域的样式
    document.getElementById('searchArea').classList.add('flex-1');
    document.getElementById('searchArea').classList.remove('mb-8');
    document.getElementById('resultsArea').classList.add('hidden');

    // 确保页脚正确显示，移除相对定位
    const footer = document.querySelector('.footer');
    if (footer) {
        footer.style.position = '';
    }

    // 重置URL为主页
    try {
        window.history.pushState(
            {},
            `LibreTV - 免费在线视频搜索与观看平台`,
            `/`
        );
        // 更新页面标题
        document.title = `LibreTV - 免费在线视频搜索与观看平台`;
    } catch (e) {
        console.error('更新浏览器历史失败:', e);
    }
}

// 获取自定义API信息
function getCustomApiInfo(customApiIndex) {
    const index = parseInt(customApiIndex);
    if (isNaN(index) || index < 0 || index >= customAPIs.length) {
        return null;
    }
    return customAPIs[index];
}

// 搜索功能 - 从 KV 缓存搜索
async function search() {
    const query = document.getElementById('searchInput').value.trim();

    if (!query) {
        showToast('请输入搜索内容', 'info');
        return;
    }

    showLoading();

    try {
        // 保存搜索历史
        saveSearchHistory(query);

        // 从 KV 缓存 API 搜索
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);

        if (!response.ok) {
            throw new Error('搜索服务暂不可用');
        }

        const data = await response.json();
        let allResults = data.success && data.list ? data.list : [];

        // 更新搜索结果计数
        const searchResultsCount = document.getElementById('searchResultsCount');
        if (searchResultsCount) {
            searchResultsCount.textContent = allResults.length;
        }

        // 显示结果区域，调整搜索区域，隐藏最近更新区域
        document.getElementById('searchArea').classList.remove('flex-1');
        document.getElementById('searchArea').classList.add('mb-8');
        document.getElementById('resultsArea').classList.remove('hidden');
        document.getElementById('recentUpdatesArea').classList.add('hidden');

        const resultsDiv = document.getElementById('results');

        // 如果没有结果
        if (!allResults || allResults.length === 0) {
            resultsDiv.innerHTML = `
                <div class="col-span-full text-center py-16">
                    <svg class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 class="mt-2 text-lg font-medium text-gray-400">没有找到匹配的结果</h3>
                    <p class="mt-1 text-sm text-gray-500">请尝试其他关键词</p>
                </div>
            `;
            hideLoading();
            return;
        }

        // 有搜索结果时，才更新URL
        try {
            const encodedQuery = encodeURIComponent(query);
            window.history.pushState(
                { search: query },
                `搜索: ${query} - LibreTV`,
                `/s=${encodedQuery}`
            );
            document.title = `搜索: ${query} - LibreTV`;
        } catch (e) {
            console.error('更新浏览器历史失败:', e);
        }

        // 使用第一个可用的 API 源 ID（用于点击详情时传递）
        const apiId = selectedAPIs.length > 0 ? selectedAPIs[0] : Object.keys(API_SITES)[0];

        // 添加XSS保护，使用textContent和属性转义
        const safeResults = allResults.map(item => {
            const safeId = item.vod_id ? item.vod_id.toString().replace(/[^\w-]/g, '') : '';
            const safeName = (item.vod_name || '').toString()
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');

            // 竖版卡片布局，与分类筛选统一样式
            const hasCover = item.vod_pic && item.vod_pic.startsWith('http');

            return `
                <div class="video-card" onclick="showDetails('${safeId}','${safeName}','${apiId}')"
                    <div class="poster-container">
                        ${hasCover ? `
                            <img src="${item.vod_pic}" alt="${safeName}"
                                 onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'poster-placeholder\\'>🎬</div>';"
                                 loading="lazy">
                        ` : '<div class="poster-placeholder">🎬</div>'}
                        <div class="play-overlay">
                            <div class="play-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                        </div>
                        <div class="badge-container">
                            <span class="badge">${(item.vod_remarks || '').toString().replace(/</g, '&lt;') || 'HD'}</span>
                        </div>
                    </div>
                    <div class="card-info">
                        <h3 class="card-title" title="${safeName}">${safeName}</h3>
                    </div>
                </div>
            `;
        }).join('');

        resultsDiv.innerHTML = safeResults;
    } catch (error) {
        console.error('搜索错误:', error);
        if (error.name === 'AbortError') {
            showToast('搜索请求超时，请检查网络连接', 'error');
        } else {
            showToast('搜索请求失败，请稍后重试', 'error');
        }
    } finally {
        hideLoading();
    }
}

// 切换清空按钮的显示状态
function toggleClearButton() {
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearSearchInput');
    if (searchInput.value !== '') {
        clearButton.classList.remove('hidden');
    } else {
        clearButton.classList.add('hidden');
    }
}

// 清空搜索框内容
function clearSearchInput() {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '';
    const clearButton = document.getElementById('clearSearchInput');
    clearButton.classList.add('hidden');
}

// 劫持搜索框的value属性以检测外部修改
function hookInput() {
    const input = document.getElementById('searchInput');
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    // 重写 value 属性的 getter 和 setter
    Object.defineProperty(input, 'value', {
        get: function () {
            // 确保读取时返回字符串（即使原始值为 undefined/null）
            const originalValue = descriptor.get.call(this);
            return originalValue != null ? String(originalValue) : '';
        },
        set: function (value) {
            // 显式将值转换为字符串后写入
            const strValue = String(value);
            descriptor.set.call(this, strValue);
            this.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    // 初始化输入框值为空字符串（避免初始值为 undefined）
    input.value = '';
}
document.addEventListener('DOMContentLoaded', hookInput);

// 显示详情 - 修改为支持自定义API
async function showDetails(id, vod_name, sourceCode) {
    // 密码保护校验
    if (window.isPasswordProtected && window.isPasswordVerified) {
        if (window.isPasswordProtected() && !window.isPasswordVerified()) {
            showPasswordModal && showPasswordModal();
            return;
        }
    }
    if (!id) {
        showToast('视频ID无效', 'error');
        return;
    }

    showLoading();
    try {
        // 构建API参数
        let apiParams = '';

        // 处理自定义API源
        if (sourceCode.startsWith('custom_')) {
            const customIndex = sourceCode.replace('custom_', '');
            const customApi = getCustomApiInfo(customIndex);
            if (!customApi) {
                showToast('自定义API配置无效', 'error');
                hideLoading();
                return;
            }
            // 传递 detail 字段
            if (customApi.detail) {
                apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&customDetail=' + encodeURIComponent(customApi.detail) + '&source=custom';
            } else {
                apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&source=custom';
            }
        } else {
            // 内置API
            apiParams = '&source=' + sourceCode;
        }

        // Add a timestamp to prevent caching
        const timestamp = new Date().getTime();
        const cacheBuster = `&_t=${timestamp}`;
        const response = await fetch(`/api/detail?id=${encodeURIComponent(id)}${apiParams}${cacheBuster}`);

        const data = await response.json();

        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');

        // 显示来源信息
        const sourceName = data.videoInfo && data.videoInfo.source_name ?
            ` <span class="text-sm font-normal text-gray-400">(${data.videoInfo.source_name})</span>` : '';

        // 不对标题进行截断处理，允许完整显示
        modalTitle.innerHTML = `<span class="break-words">${vod_name || '未知视频'}</span>${sourceName}`;
        currentVideoTitle = vod_name || '未知视频';

        if (data.episodes && data.episodes.length > 0) {
            // 构建详情信息HTML
            let detailInfoHtml = '';
            if (data.videoInfo) {
                // Prepare description text, strip HTML and trim whitespace
                const descriptionText = data.videoInfo.desc ? data.videoInfo.desc.replace(/<[^>]+>/g, '').trim() : '';

                // 保存视频信息到 localStorage，供播放页使用
                try {
                    localStorage.setItem('currentVodBlurb', descriptionText || '');
                    localStorage.setItem('currentVodYear', data.videoInfo.year || '');
                    localStorage.setItem('currentVodArea', data.videoInfo.area || '');
                    localStorage.setItem('currentVodDirector', data.videoInfo.director || '');
                    localStorage.setItem('currentVodActor', data.videoInfo.actor || '');
                    localStorage.setItem('currentVodType', data.videoInfo.type || '');
                } catch(e) {}

                // Check if there's any actual grid content
                const hasGridContent = data.videoInfo.type || data.videoInfo.year || data.videoInfo.area || data.videoInfo.director || data.videoInfo.actor || data.videoInfo.remarks;

                if (hasGridContent || descriptionText) { // Only build if there's something to show
                    detailInfoHtml = `
                <div class="modal-detail-info">
                    ${hasGridContent ? `
                    <div class="detail-grid">
                        ${data.videoInfo.type ? `<div class="detail-item"><span class="detail-label">类型:</span> <span class="detail-value">${data.videoInfo.type}</span></div>` : ''}
                        ${data.videoInfo.year ? `<div class="detail-item"><span class="detail-label">年份:</span> <span class="detail-value">${data.videoInfo.year}</span></div>` : ''}
                        ${data.videoInfo.area ? `<div class="detail-item"><span class="detail-label">地区:</span> <span class="detail-value">${data.videoInfo.area}</span></div>` : ''}
                        ${data.videoInfo.director ? `<div class="detail-item"><span class="detail-label">导演:</span> <span class="detail-value">${data.videoInfo.director}</span></div>` : ''}
                        ${data.videoInfo.actor ? `<div class="detail-item"><span class="detail-label">主演:</span> <span class="detail-value">${data.videoInfo.actor}</span></div>` : ''}
                        ${data.videoInfo.remarks ? `<div class="detail-item"><span class="detail-label">备注:</span> <span class="detail-value">${data.videoInfo.remarks}</span></div>` : ''}
                    </div>` : ''}
                    ${descriptionText ? `
                    <div class="detail-desc">
                        <p class="detail-label">简介:</p>
                        <p class="detail-desc-content">${descriptionText}</p>
                    </div>` : ''}
                </div>
                `;
                }
            }

            currentEpisodes = data.episodes;
            currentEpisodeIndex = 0;

            modalContent.innerHTML = `
                ${detailInfoHtml}
                <div class="episodes-header">
                    <div class="episode-stats">
                        <button onclick="toggleEpisodeOrder('${sourceCode}', '${id}')" class="episode-toggle-btn flex items-center gap-1">
                            <svg class="w-4 h-4 transform ${episodesReversed ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                            </svg>
                            <span>${episodesReversed ? '正序排列' : '倒序排列'}</span>
                        </button>
                        <span class="episode-count">共 ${data.episodes.length} 集</span>
                    </div>
                    <button onclick="copyLinks()" class="copy-btn">
                        复制链接
                    </button>
                </div>
                <div id="episodesGrid" class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    ${renderEpisodes(vod_name, sourceCode, id)}
                </div>
            `;
        } else {
            modalContent.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-red-400 mb-2">❌ 未找到播放资源</div>
                    <div class="text-gray-500 text-sm">该视频可能暂时无法播放，请尝试其他视频</div>
                </div>
            `;
        }

        modal.classList.remove('hidden');
    } catch (error) {
        console.error('获取详情错误:', error);
        showToast('获取详情失败，请稍后重试', 'error');
    } finally {
        hideLoading();
    }
}

// 更新播放视频函数，修改为使用/watch路径而不是直接打开player.html
function playVideo(url, vod_name, sourceCode, episodeIndex = 0, vodId = '') {
    // 密码保护校验
    if (window.isPasswordProtected && window.isPasswordVerified) {
        if (window.isPasswordProtected() && !window.isPasswordVerified()) {
            showPasswordModal && showPasswordModal();
            return;
        }
    }

    // 获取当前路径作为返回页面
    let currentPath = window.location.href;

    // 构建播放页面URL，直接跳转到player.html
    let playerUrl = `player.html?id=${vodId || ''}&source=${sourceCode || ''}&url=${encodeURIComponent(url)}&index=${episodeIndex}&title=${encodeURIComponent(vod_name || '')}`;

    // 添加返回URL参数
    if (currentPath.includes('index.html') || currentPath.endsWith('/')) {
        playerUrl += `&back=${encodeURIComponent(currentPath)}`;
    }

    // 保存当前状态到localStorage
    try {
        localStorage.setItem('currentVideoTitle', vod_name || '未知视频');
        localStorage.setItem('currentEpisodes', JSON.stringify(currentEpisodes));
        localStorage.setItem('currentEpisodeIndex', episodeIndex);
        localStorage.setItem('currentSourceCode', sourceCode || '');
        localStorage.setItem('lastPlayTime', Date.now());
        localStorage.setItem('lastSearchPage', currentPath);
        localStorage.setItem('lastPageUrl', currentPath);
    } catch (e) {
        console.error('保存播放状态失败:', e);
    }

    // 显示跳转动画遮罩
    showPageTransition(vod_name);

    // 延迟跳转，让动画显示
    setTimeout(() => {
        window.location.href = playerUrl;
    }, 500);
}

// 显示页面跳转动画
function showPageTransition(title) {
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.id = 'pageTransitionOverlay';
    overlay.innerHTML = `
        <div class="transition-content">
            <!-- 动画加载圈 -->
            <div class="transition-spinner">
                <div class="transition-ring-bg"></div>
                <div class="transition-ring-spin"></div>
                <div class="transition-ring-inner"></div>
            </div>
            <!-- 加载文字 -->
            <p class="transition-title">${title || '视频加载中...'}</p>
            <p class="transition-sub">精彩内容即将呈现</p>
        </div>
    `;
    document.body.appendChild(overlay);

    // 触发动画
    requestAnimationFrame(() => {
        overlay.classList.add('show');
    });
}

// 弹出播放器页面
function showVideoPlayer(url) {
    // 在打开播放器前，隐藏详情弹窗
    const detailModal = document.getElementById('modal');
    if (detailModal) {
        detailModal.classList.add('hidden');
    }
    // 临时隐藏搜索结果，防止高度超出播放器而出现滚动条
    document.getElementById('resultsArea').classList.add('hidden');
    // 在框架中打开播放页面
    videoPlayerFrame = document.createElement('iframe');
    videoPlayerFrame.id = 'VideoPlayerFrame';
    videoPlayerFrame.className = 'fixed w-full h-screen z-40';
    videoPlayerFrame.src = url;
    document.body.appendChild(videoPlayerFrame);
    // 将焦点移入iframe
    videoPlayerFrame.focus();
}

// 关闭播放器页面
function closeVideoPlayer(home = false) {
    videoPlayerFrame = document.getElementById('VideoPlayerFrame');
    if (videoPlayerFrame) {
        videoPlayerFrame.remove();
        // 恢复搜索结果显示
        document.getElementById('resultsArea').classList.remove('hidden');
        // 关闭播放器时也隐藏详情弹窗
        const detailModal = document.getElementById('modal');
        if (detailModal) {
            detailModal.classList.add('hidden');
        }
    }
    if (home) {
        // 刷新主页
        window.location.href = '/'
    }
}

// 播放上一集
function playPreviousEpisode(sourceCode) {
    if (currentEpisodeIndex > 0) {
        const prevIndex = currentEpisodeIndex - 1;
        const prevUrl = currentEpisodes[prevIndex];
        playVideo(prevUrl, currentVideoTitle, sourceCode, prevIndex);
    }
}

// 播放下一集
function playNextEpisode(sourceCode) {
    if (currentEpisodeIndex < currentEpisodes.length - 1) {
        const nextIndex = currentEpisodeIndex + 1;
        const nextUrl = currentEpisodes[nextIndex];
        playVideo(nextUrl, currentVideoTitle, sourceCode, nextIndex);
    }
}

// 处理播放器加载错误
function handlePlayerError() {
    hideLoading();
    showToast('视频播放加载失败，请尝试其他视频源', 'error');
}

// 辅助函数用于渲染剧集按钮（使用当前的排序状态）
function renderEpisodes(vodName, sourceCode, vodId) {
    const episodes = episodesReversed ? [...currentEpisodes].reverse() : currentEpisodes;
    return episodes.map((episode, index) => {
        // 根据倒序状态计算真实的剧集索引
        const realIndex = episodesReversed ? currentEpisodes.length - 1 - index : index;
        return `
            <button id="episode-${realIndex}" onclick="playVideo('${episode}','${vodName.replace(/"/g, '&quot;')}', '${sourceCode}', ${realIndex}, '${vodId}')"
                    class="episode-btn">
                ${realIndex + 1}
            </button>
        `;
    }).join('');
}

// 复制视频链接到剪贴板
function copyLinks() {
    const episodes = episodesReversed ? [...currentEpisodes].reverse() : currentEpisodes;
    const linkList = episodes.join('\r\n');
    navigator.clipboard.writeText(linkList).then(() => {
        showToast('播放链接已复制', 'success');
    }).catch(err => {
        showToast('复制失败，请检查浏览器权限', 'error');
    });
}

// 切换排序状态的函数
function toggleEpisodeOrder(sourceCode, vodId) {
    episodesReversed = !episodesReversed;
    // 重新渲染剧集区域，使用 currentVideoTitle 作为视频标题
    const episodesGrid = document.getElementById('episodesGrid');
    if (episodesGrid) {
        episodesGrid.innerHTML = renderEpisodes(currentVideoTitle, sourceCode, vodId);
    }

    // 更新按钮文本和箭头方向
    const toggleBtn = document.querySelector(`button[onclick="toggleEpisodeOrder('${sourceCode}', '${vodId}')"]`);
    if (toggleBtn) {
        toggleBtn.querySelector('span').textContent = episodesReversed ? '正序排列' : '倒序排列';
        const arrowIcon = toggleBtn.querySelector('svg');
        if (arrowIcon) {
            arrowIcon.style.transform = episodesReversed ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
}

// 从URL导入配置
async function importConfigFromUrl() {
    // 创建模态框元素
    let modal = document.getElementById('importUrlModal');
    if (modal) {
        document.body.removeChild(modal);
    }

    modal = document.createElement('div');
    modal.id = 'importUrlModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40';

    modal.innerHTML = `
        <div class="bg-[#191919] rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <button id="closeUrlModal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
            
            <h3 class="text-xl font-bold mb-4">从URL导入配置</h3>
            
            <div class="mb-4">
                <input type="text" id="configUrl" placeholder="输入配置文件URL" 
                       class="w-full px-3 py-2 bg-[#222] border border-[#333] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
            </div>
            
            <div class="flex justify-end space-x-2">
                <button id="confirmUrlImport" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">导入</button>
                <button id="cancelUrlImport" class="bg-[#444] hover:bg-[#555] text-white px-4 py-2 rounded">取消</button>
            </div>
        </div>`;

    document.body.appendChild(modal);

    // 关闭按钮事件
    document.getElementById('closeUrlModal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // 取消按钮事件
    document.getElementById('cancelUrlImport').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // 确认导入按钮事件
    document.getElementById('confirmUrlImport').addEventListener('click', async () => {
        const url = document.getElementById('configUrl').value.trim();
        if (!url) {
            showToast('请输入配置文件URL', 'warning');
            return;
        }

        // 验证URL格式
        try {
            const urlObj = new URL(url);
            if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                showToast('URL必须以http://或https://开头', 'warning');
                return;
            }
        } catch (e) {
            showToast('URL格式不正确', 'warning');
            return;
        }

        showLoading('正在从URL导入配置...');

        try {
            // 获取配置文件 - 直接请求URL
            const response = await fetch(url, {
                mode: 'cors',
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) throw '获取配置文件失败';

            // 验证响应内容类型
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw '响应不是有效的JSON格式';
            }

            const config = await response.json();
            if (config.name !== 'LibreTV-Settings') throw '配置文件格式不正确';

            // 验证哈希
            const dataHash = await sha256(JSON.stringify(config.data));
            if (dataHash !== config.hash) throw '配置文件哈希值不匹配';

	            // 导入配置（不允许通过配置文件修改数据源相关设置）
	            const blockedKeys = new Set(['selectedAPIs', 'customAPIs']);
	            for (let item in config.data) {
	                if (blockedKeys.has(item)) continue;
	                localStorage.setItem(item, config.data[item]);
	            }

            showToast('配置文件导入成功，3 秒后自动刷新本页面。', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } catch (error) {
            const message = typeof error === 'string' ? error : '导入配置失败';
            showToast(`从URL导入配置出错 (${message})`, 'error');
        } finally {
            hideLoading();
            document.body.removeChild(modal);
        }
    });

    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// 配置文件导入功能
async function importConfig() {
    showImportBox(async (file) => {
        try {
            // 检查文件类型
            if (!(file.type === 'application/json' || file.name.endsWith('.json'))) throw '文件类型不正确';

            // 检查文件大小
            if (file.size > 1024 * 1024 * 10) throw new Error('文件大小超过 10MB');

            // 读取文件内容
            const content = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject('文件读取失败');
                reader.readAsText(file);
            });

	        // 解析并验证配置
	        const config = JSON.parse(content);
	        if (config.name !== 'LibreTV-Settings') throw '配置文件格式不正确';

	        // 验证哈希
	        const dataHash = await sha256(JSON.stringify(config.data));
	        if (dataHash !== config.hash) throw '配置文件哈希值不匹配';

	        // 导入配置（不允许通过配置文件修改数据源相关设置）
	        const blockedKeys = new Set(['selectedAPIs', 'customAPIs']);
	        for (let item in config.data) {
	            if (blockedKeys.has(item)) continue;
	            localStorage.setItem(item, config.data[item]);
	        }

            showToast('配置文件导入成功，3 秒后自动刷新本页面。', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } catch (error) {
            const message = typeof error === 'string' ? error : '配置文件格式错误';
            showToast(`配置文件读取出错 (${message})`, 'error');
        }
    });
}

// 配置文件导出功能
async function exportConfig() {
    // 存储配置数据
    const config = {};
    const items = {};

    const settingsToExport = [
        'hasInitializedDefaults'
    ];

    // 导出设置项
    settingsToExport.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
            items[key] = value;
        }
    });

    // 导出历史记录
    const viewingHistory = localStorage.getItem('viewingHistory');
    if (viewingHistory) {
        items['viewingHistory'] = viewingHistory;
    }

    const searchHistory = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (searchHistory) {
        items[SEARCH_HISTORY_KEY] = searchHistory;
    }

    const times = Date.now().toString();
    config['name'] = 'LibreTV-Settings';  // 配置文件名，用于校验
    config['time'] = times;               // 配置文件生成时间
    config['cfgVer'] = '1.0.0';           // 配置文件版本
    config['data'] = items;               // 配置文件数据
    config['hash'] = await sha256(JSON.stringify(config['data']));  // 计算数据的哈希值，用于校验

    // 将配置数据保存为 JSON 文件
    saveStringAsFile(JSON.stringify(config), 'LibreTV-Settings_' + times + '.json');
}

// 将字符串保存为文件
function saveStringAsFile(content, fileName) {
    // 创建Blob对象并指定类型
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    // 生成临时URL
    const url = window.URL.createObjectURL(blob);
    // 创建<a>标签并触发下载
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    // 清理临时对象
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// 当前分类状态（用于分页/滚动加载）
let currentCategoryState = {
	typeId: null,
	typeName: null,
	page: 1,
	totalPages: 1
};

// 首页/分类 最近更新区域：加载中的状态标记
let isRecentScrollLoading = false;

// 跳转到指定页码
async function goToPage(page) {
    if (page < 1 || page > currentCategoryState.totalPages) return;

    if (currentCategoryState.typeId) {
        // 分类模式
        await searchByCategory(currentCategoryState.typeId, currentCategoryState.typeName, page);
    } else {
        // 首页模式
        await loadRecentUpdates(page);
    }
}

// 跳转到输入框指定的页码
function goToInputPage() {
    const pageInput = document.getElementById('pageInput');
    if (!pageInput) return;

    let page = parseInt(pageInput.value, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (page > currentCategoryState.totalPages) page = currentCategoryState.totalPages;

    goToPage(page);
}

// 更新分页控件状态
function updatePaginationUI() {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageInput = document.getElementById('pageInput');
    const totalPagesSpan = document.getElementById('totalPages');

    if (prevBtn) {
        prevBtn.disabled = currentCategoryState.page <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = currentCategoryState.page >= currentCategoryState.totalPages;
    }
    if (pageInput) {
        pageInput.value = currentCategoryState.page;
        pageInput.max = currentCategoryState.totalPages;
    }
    if (totalPagesSpan) {
        totalPagesSpan.textContent = currentCategoryState.totalPages;
    }
}

// 加载首页推荐视频（优先从 KV 缓存读取）
let recentUpdatesApiPage = 0;
let recentUpdatesHasMore = true;

async function loadRecentUpdates(page = 1, append = false) {
    // 更新分类状态（首页没有 typeId）
    currentCategoryState.typeId = null;
    currentCategoryState.typeName = null;
    currentCategoryState.page = page;

    const container = document.getElementById('recentUpdates');
    if (!container) return;

    const loadingMoreEl = document.getElementById('recentLoadingMore');
    const noMoreEl = document.getElementById('recentNoMore');

    // 如果是第一页，重置状态
    if (page === 1) {
        recentUpdatesApiPage = 0;
        recentUpdatesHasMore = false; // KV 模式下首页数据是固定的，无需加载更多
    }

    // 显示加载状态
    if (!append) {
        if (noMoreEl) noMoreEl.classList.add('hidden');
        container.innerHTML = `
            <div class="col-span-full flex justify-center items-center py-16">
                <div class="bg-white rounded-2xl p-8 shadow-lg flex flex-col items-center gap-4">
                    <div class="relative">
                        <div class="w-14 h-14 border-4 border-sky-100 rounded-full"></div>
                        <div class="absolute inset-0 w-14 h-14 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                        <div class="absolute inset-2 w-10 h-10 border-4 border-cyan-300 border-b-transparent rounded-full animate-spin-reverse"></div>
                    </div>
                    <div class="text-center">
                        <p class="text-sky-600 font-medium">加载推荐中...</p>
                        <p class="text-gray-400 text-sm mt-1">精彩内容即将呈现</p>
                    </div>
                </div>
            </div>
        `;
    }

    try {
        // 从 KV 缓存 API 获取首页数据
        const response = await fetch('/api/home-data');

        if (!response.ok) {
            throw new Error('数据未同步，请管理员先执行同步操作');
        }

        const data = await response.json();

        if (!data.success || !data.list || data.list.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <p class="text-gray-400 mb-2">暂无推荐内容</p>
                    <p class="text-gray-500 text-sm">请管理员在后台执行数据同步</p>
                </div>
            `;
            return;
        }

        const safeItems = data.list;

        // 首页数据是固定的，不需要分页
        currentCategoryState.totalPages = 1;
        currentCategoryState.page = 1;
        recentUpdatesHasMore = false;
        updatePaginationUI();

        // 使用第一个可用的 API 源 ID（用于点击详情时传递）
        const apiId = selectedAPIs.length > 0 ? selectedAPIs[0] : Object.keys(API_SITES)[0];

        // 渲染视频卡片
        const cardsHtml = safeItems.map(item => {
            const safeName = (item.vod_name || '未知').toString().replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const safeId = (item.vod_id || '').toString().replace(/"/g, '&quot;');
            const hasCover = item.vod_pic && item.vod_pic.startsWith('http');

            return `
                <div class="video-card" onclick="showDetails('${safeId}','${safeName}','${apiId}')">
                    <div class="poster-container">
                        ${hasCover ? `
                            <img src="${item.vod_pic}" alt="${safeName}"
                                 onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'poster-placeholder\\'>🎬</div>';"
                                 loading="lazy">
                        ` : '<div class="poster-placeholder">🎬</div>'}
                        <div class="play-overlay">
                            <div class="play-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                        </div>
                        <div class="badge-container">
                            <span class="badge">${(item.vod_remarks || '').toString().replace(/</g, '&lt;') || 'HD'}</span>
                        </div>
                    </div>
                    <div class="card-info">
                        <h3 class="card-title" title="${safeName}">${safeName}</h3>
                    </div>
                </div>
            `;
        }).join('');

        if (append && page > 1) {
            container.insertAdjacentHTML('beforeend', cardsHtml);
        } else {
            container.innerHTML = cardsHtml;
        }

        // 更新"加载更多"按钮状态
        updateLoadMoreUI();

    } catch (error) {
        console.error('加载推荐视频失败:', error);
        const errorMsg = error.name === 'AbortError' ? '加载超时' : (error.message || '加载失败');
        container.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <p class="text-gray-400 mb-2">${errorMsg}</p>
                    <button onclick="loadRecentUpdates()" class="text-sky-500 hover:text-sky-600 text-sm">点击重试</button>
                </div>
            `;
    } finally {
        if (loadingMoreEl) loadingMoreEl.classList.add('hidden');
    }
}

// 点击"加载更多"按钮时调用
function loadMoreRecent() {
    if (isRecentScrollLoading) return;
    if (!currentCategoryState || !currentCategoryState.page || !currentCategoryState.totalPages) return;
    if (currentCategoryState.page >= currentCategoryState.totalPages) return;

    const nextPage = currentCategoryState.page + 1;
    isRecentScrollLoading = true;

    const p = currentCategoryState.typeId
        ? searchByCategory(currentCategoryState.typeId, currentCategoryState.typeName, nextPage, true)
        : loadRecentUpdates(nextPage, true);

    Promise.resolve(p).finally(() => {
        isRecentScrollLoading = false;
    });
}

// 更新"加载更多"按钮和页码信息的显示状态
// 记录已加载的视频数量
let loadedVideoCount = 0;

function updateLoadMoreUI() {
    const loadMoreBtn = document.getElementById('recentLoadMoreBtn');
    const noMoreEl = document.getElementById('recentNoMore');
    const pageInfoEl = document.getElementById('recentPageInfo');

    // 计算已加载的卡片数量
    const container = document.getElementById('recentUpdates');
    if (container) {
        loadedVideoCount = container.querySelectorAll('.video-card').length;
    }

    // 更新已加载数量信息
    if (pageInfoEl) {
        if (loadedVideoCount > 0) {
            pageInfoEl.textContent = `已加载 ${loadedVideoCount} 条`;
        } else {
            pageInfoEl.textContent = '';
        }
    }

    // 判断是否还有更多内容
    const hasMore = currentCategoryState.typeId ? categoryHasMore : recentUpdatesHasMore;
    if (!hasMore) {
        // 已到最后
        if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
        if (noMoreEl && loadedVideoCount > 0) noMoreEl.classList.remove('hidden');
    } else {
        // 还有更多内容
        if (loadMoreBtn) loadMoreBtn.classList.remove('hidden');
        if (noMoreEl) noMoreEl.classList.add('hidden');
    }
}

// ========== 分类侧边栏 ==========
// 分类数据缓存
let categoryCache = null;

// 切换分类侧边栏
function toggleCategoryPanel() {
    const panel = document.getElementById('categoryPanel');
    const overlay = document.getElementById('categoryOverlay');
    if (!panel || !overlay) return;

    const isOpen = !panel.classList.contains('translate-x-full');

    if (isOpen) {
        panel.classList.add('translate-x-full');
        overlay.classList.add('hidden');
    } else {
        panel.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
        // 首次打开时加载分类
        if (!categoryCache) {
            loadCategories();
        }
    }
}

// 从 KV 缓存 API 加载分类列表
async function loadCategories() {
    const container = document.getElementById('categoryList');
    if (!container) return;

    // 显示加载状态
    container.innerHTML = `
        <div class="flex justify-center items-center py-6">
            <div class="flex flex-col items-center gap-3">
                <div class="relative">
                    <div class="w-10 h-10 border-3 border-sky-100 rounded-full"></div>
                    <div class="absolute inset-0 w-10 h-10 border-3 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <span class="text-sky-600 text-sm font-medium">加载分类中...</span>
            </div>
        </div>
    `;

    try {
        // 从 KV 缓存 API 获取分类
        const response = await fetch('/api/categories');

        if (!response.ok) {
            throw new Error('分类数据未同步');
        }

        const data = await response.json();

        if (!data.success || !data.list || data.list.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-400 py-8 text-sm">暂无分类数据，请先在后台同步</div>';
            return;
        }

        // 从返回的 list 获取分类（已经在后端过滤过敏感分类）
        const categories = data.list;

        // 缓存原始分类数据
        categoryCache = categories;

        // 前端额外过滤（双重保险）
        const banned = ['伦理片', '福利', '里番', '萝莉', '制服诱惑', '国产传媒', 'cosplay', '黑丝', '无码', '有码', 'SWAG', '网红主播', '色情', '同性', '福利', '国产动漫', '大陆综艺', '国产剧', '短剧', '大陆剧', '中国动漫'];

        // 使用 API 返回的 type_pid 来分组（基于父分类ID）
        // type_pid: 0 = 顶级分类, 1 = 电影, 2 = 连续剧, 3 = 综艺, 4 = 动漫
        const grouped = {
            movie: { icon: '🎬', name: '电影', items: [], pid: 1 },
            tv: { icon: '📺', name: '连续剧', items: [], pid: 2 },
            variety: { icon: '🎭', name: '综艺', items: [], pid: 3 },
            anime: { icon: '🎌', name: '动漫', items: [], pid: 4 },
            other: { icon: '📁', name: '其他', items: [] }
        };

        categories.forEach(cat => {
            const name = cat.type_name || '';
            const id = cat.type_id;
            // 确保 pid 是数字类型
            const pid = parseInt(cat.type_pid, 10) || 0;
            if (!name || !id) return;

            // 跳过顶级分类（type_pid: 0），只显示子分类
            if (pid === 0) return;

            // 过滤敏感分类（使用精确匹配或包含匹配）
            if (banned.some(b => name === b || name.includes(b))) return;

            // 根据 type_pid 分组
            if (pid === 1) {
                grouped.movie.items.push({ id, name });
            } else if (pid === 2) {
                grouped.tv.items.push({ id, name });
            } else if (pid === 3) {
                grouped.variety.items.push({ id, name });
            } else if (pid === 4) {
                grouped.anime.items.push({ id, name });
            } else {
                grouped.other.items.push({ id, name });
            }
        });

        // 渲染分类
        let html = '';
        for (const [key, group] of Object.entries(grouped)) {
            if (group.items.length === 0) continue;
            html += `
                <div class="space-y-3">
                    <h4 class="text-sm font-semibold text-gray-600 flex items-center gap-2 pb-1 border-b border-sky-100/80">
                        <span class="text-base">${group.icon}</span>
                        <span class="bg-gradient-to-r from-sky-600 to-cyan-600 bg-clip-text text-transparent">${group.name}</span>
                    </h4>
                    <div class="flex flex-wrap gap-2.5">
                        ${group.items.map(item => `
                            <button onclick="searchByCategory(${item.id}, '${item.name.replace(/'/g, "\\'")}')" class="filter-btn">
                                ${item.name}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html || '<div class="text-center text-gray-400 py-8 text-sm">暂无分类数据</div>';

    } catch (error) {
        console.error('加载分类失败:', error);
        const errorMsg = error.name === 'AbortError' ? '加载超时' : (error.message || '加载失败');
        container.innerHTML = `
            <div class="text-center py-8">
                <p class="text-gray-400 text-sm mb-2">${errorMsg}</p>
                <button onclick="loadCategories()" class="text-sky-500 hover:text-sky-600 text-sm">点击重试</button>
            </div>
        `;
    }
}

// 按分类搜索视频（支持翻页补齐：跨多页收集安全内容后再分页，支持瀑布流追加）
// 用于记录分类当前已请求到的 API 页码
let categoryApiPage = 0;
let categoryHasMore = true;

async function searchByCategory(typeId, typeName, page = 1, append = false) {
    // 关闭分类面板（仅首次点击时）
    if (page === 1) {
        toggleCategoryPanel();
        // 重置分类 API 页码状态
        categoryApiPage = 0;
        categoryHasMore = true;
    }

    // 更新分类状态
    currentCategoryState = { typeId, typeName, page, totalPages: currentCategoryState.totalPages || 1 };

    const container = document.getElementById('recentUpdates');
    const recentUpdatesArea = document.getElementById('recentUpdatesArea');
    const resultsArea = document.getElementById('resultsArea');
    const resultsDiv = document.getElementById('results');
    const loadingMoreEl = document.getElementById('recentLoadingMore');
    const noMoreEl = document.getElementById('recentNoMore');

    if (!container || !resultsDiv) return;

    // 显示最近更新区域（分类筛选使用此区域）
    if (recentUpdatesArea) recentUpdatesArea.classList.remove('hidden');

    // 更新标题
    const titleEl = recentUpdatesArea?.querySelector('h2');
    if (titleEl) {
        titleEl.textContent = typeName;
    }
    // 更新副标题（h2的父元素下的p）
    const subtitleEl = titleEl?.parentElement?.querySelector('p');
    if (subtitleEl) {
        subtitleEl.textContent = '精选影视内容';
    }

    // 显示加载状态
    if (append && page > 1) {
        if (loadingMoreEl) {
            loadingMoreEl.classList.remove('hidden');
            // 更新已加载数量显示
            const loadingCountText = document.getElementById('loadingCountText');
            if (loadingCountText) {
                loadingCountText.textContent = `已加载 ${loadedVideoCount} 条`;
            }
        }
    } else {
        if (noMoreEl) noMoreEl.classList.add('hidden');
        container.innerHTML = `
            <div class="col-span-full flex justify-center items-center py-16">
                <div class="bg-white rounded-2xl p-8 shadow-lg flex flex-col items-center gap-4">
                    <div class="relative">
                        <div class="w-14 h-14 border-4 border-sky-100 rounded-full"></div>
                        <div class="absolute inset-0 w-14 h-14 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                        <div class="absolute inset-2 w-10 h-10 border-4 border-cyan-300 border-b-transparent rounded-full animate-spin-reverse"></div>
                    </div>
                    <div class="text-center">
                        <p class="text-sky-600 font-medium">加载${typeName}中...</p>
                        <p class="text-gray-400 text-sm mt-1">精彩内容即将呈现</p>
                    </div>
                </div>
            </div>
        `;
    }

    // 隐藏搜索结果区域
    if (resultsArea) resultsArea.classList.add('hidden');

    try {
        // 从 KV 缓存 API 获取分类视频
        const limit = 40;
        const response = await fetch(`/api/category/${typeId}?page=${page}&limit=${limit}`);

        if (!response.ok) {
            throw new Error('分类数据未同步');
        }

        const data = await response.json();

        if (!data.success || !data.list || data.list.length === 0) {
            if (page === 1) {
                container.innerHTML = `<div class="col-span-full text-center text-gray-400 py-8">暂无${typeName}内容</div>`;
            }
            categoryHasMore = false;
            currentCategoryState.totalPages = page;
            updatePaginationUI();
            updateLoadMoreUI();
            return;
        }

        const safeItems = data.list;
        const totalPages = data.totalPages || 1;

        // 更新分页状态
        categoryHasMore = page < totalPages;
        currentCategoryState.totalPages = totalPages;
        currentCategoryState.page = page;
        updatePaginationUI();

        // 使用第一个可用的 API 源 ID（用于点击详情时传递）
        const apiId = selectedAPIs.length > 0 ? selectedAPIs[0] : Object.keys(API_SITES)[0];

        // 渲染视频卡片
        const cardsHtml = safeItems.map(item => {
            const safeName = (item.vod_name || '未知').toString().replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const safeId = (item.vod_id || '').toString().replace(/"/g, '&quot;');
            const hasCover = item.vod_pic && item.vod_pic.startsWith('http');

            return `
                <div class="video-card" onclick="showDetails('${safeId}','${safeName}','${apiId}')">
                    <div class="poster-container">
                        ${hasCover ? `
                            <img src="${item.vod_pic}" alt="${safeName}"
                                 onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'poster-placeholder\\'>🎬</div>';"
                                 loading="lazy">
                        ` : '<div class="poster-placeholder">🎬</div>'}
                        <div class="play-overlay">
                            <div class="play-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                        </div>
                        <div class="badge-container">
                            <span class="badge">${(item.vod_remarks || '').toString().replace(/</g, '&lt;') || 'HD'}</span>
                        </div>
                    </div>
                    <div class="card-info">
                        <h3 class="card-title" title="${safeName}">${safeName}</h3>
                    </div>
                </div>
            `;
        }).join('');

        if (append && page > 1) {
            container.insertAdjacentHTML('beforeend', cardsHtml);
        } else {
            container.innerHTML = cardsHtml;
        }

        // 更新"加载更多"按钮状态
        updateLoadMoreUI();

    } catch (error) {
        console.error(`加载${typeName}失败:`, error);
        const errorMsg = error.name === 'AbortError' ? '加载超时' : (error.message || '加载失败');
        container.innerHTML = `
            <div class="col-span-full text-center py-8">
                <p class="text-gray-400 mb-2">${errorMsg}</p>
                <button onclick="searchByCategory(${typeId}, '${typeName.replace(/'/g, "\\'")}')" class="text-sky-500 hover:text-sky-600 text-sm">点击重试</button>
            </div>
        `;
	    } finally {
	        if (loadingMoreEl) loadingMoreEl.classList.add('hidden');
	    }
	}

// 首页初始化：加载推荐
function initHomePage() {
    const recentUpdatesArea = document.getElementById('recentUpdatesArea');
    const noMoreEl = document.getElementById('recentNoMore');
    const loadingMoreEl = document.getElementById('recentLoadingMore');
    const loadMoreBtn = document.getElementById('recentLoadMoreBtn');
    // 重置标题
    const titleEl = recentUpdatesArea?.querySelector('h2');
    if (titleEl) {
        titleEl.textContent = '最近更新';
    }
    // 重置副标题（h2的父元素下的p）
    const subtitleEl = titleEl?.parentElement?.querySelector('p');
    if (subtitleEl) {
        subtitleEl.textContent = '每日精选好片推荐';
    }
    // 显示最近更新区域
    if (recentUpdatesArea) recentUpdatesArea.classList.remove('hidden');
    if (noMoreEl) noMoreEl.classList.add('hidden');
    if (loadingMoreEl) loadingMoreEl.classList.add('hidden');
    if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
    // 重置分类状态
    currentCategoryState = { typeId: null, typeName: null, page: 1, totalPages: 1 };
    // 回到顶部再加载
    window.scrollTo({ top: 0, behavior: 'auto' });
    // 加载首页推荐
    loadRecentUpdates(1, false);
}

// 重置回首页
function resetToHome() {
	    initHomePage();
	    // 隐藏搜索结果
	    const resultsArea = document.getElementById('resultsArea');
	    if (resultsArea) resultsArea.classList.add('hidden');
	    // 清空搜索框
	    const searchInput = document.getElementById('searchInput');
	    if (searchInput) searchInput.value = '';
	}

// 页面加载时自动加载推荐视频（如果不是搜索 URL）
function maybeInitHomePage() {
    // 检查是否是搜索 URL，如果是则跳过首页初始化
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    if (path.startsWith('/s=') || urlParams.get('s')) {
        // 是搜索 URL，跳过首页初始化，由 index-page.js 处理搜索
        return;
    }
    initHomePage();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeInitHomePage);
} else {
    maybeInitHomePage();
}

// 移除Node.js的require语句，因为这是在浏览器环境中运行的
