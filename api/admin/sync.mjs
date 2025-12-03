import { kv } from '@vercel/kv';
import { verifyAdmin } from './verify.mjs';

// 默认配置
const DEFAULT_SOURCE_API = 'https://subocj.com/api.php/provide/vod/';
const DEFAULT_BANNED_TYPES = [
  '伦理片', '福利', '里番动漫', '门事件', '萝莉少女', '制服诱惑',
  '国产传媒', 'cosplay', '黑丝诱惑', '无码', '日本无码', '有码',
  '日本有码', 'SWAG', '网红主播', '色情片', '同性片', '福利视频',
  '福利片', '国产动漫', '大陆综艺', '国产剧', '短剧', '大陆剧', '中国动漫'
];
const DEFAULT_BANNED_AREAS = ['大陆', '中国大陆', '内地'];

// 获取过滤规则
async function getFilterConfig() {
  try {
    const config = await kv.get('filter-config');
    return {
      bannedTypes: config?.bannedTypes || DEFAULT_BANNED_TYPES,
      bannedAreas: config?.bannedAreas || DEFAULT_BANNED_AREAS
    };
  } catch {
    return { bannedTypes: DEFAULT_BANNED_TYPES, bannedAreas: DEFAULT_BANNED_AREAS };
  }
}

function simplifyVideo(item) {
  return {
    vod_id: item.vod_id,
    vod_name: item.vod_name || '未知',
    vod_pic: item.vod_pic || '',
    vod_remarks: item.vod_remarks || '',
    type_id: item.type_id,
    type_name: item.type_name || ''
  };
}

// 获取数据源 URL
async function getSourceUrl() {
  try {
    const config = await kv.get('source-config');
    return config?.sourceUrl || DEFAULT_SOURCE_API;
  } catch {
    return DEFAULT_SOURCE_API;
  }
}

// 检查是否需要停止同步
async function shouldStopSync() {
  try {
    const control = await kv.get('sync-control');
    return control?.shouldStop === true;
  } catch {
    return false;
  }
}

// 更新同步进度
async function updateProgress(data) {
  try {
    await kv.set('sync-progress', { ...data, updatedAt: Date.now() });
  } catch (e) {
    console.error('更新进度失败:', e.message);
  }
}

async function fetchFromSource(sourceUrl, params = '') {
  const url = sourceUrl + params;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export default async function handler(req, res) {
  // 验证管理员身份
  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: '请先登录' });
  }

  // GET: 获取同步状态和进度
  if (req.method === 'GET') {
    try {
      const status = await kv.get('sync-status');
      const progress = await kv.get('sync-progress');

      if (!status) {
        return res.status(200).json({
          success: true,
          data: { status: 'never', message: '尚未进行过同步' },
          progress: null
        });
      }

      return res.status(200).json({
        success: true,
        data: status,
        progress: status.status === 'syncing' ? progress : null
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST: 执行同步
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();

    // 清除停止标记和进度
    await kv.del('sync-control');
    await kv.del('sync-progress');

    // 获取配置
    const sourceUrl = await getSourceUrl();
    const { bannedTypes, bannedAreas } = await getFilterConfig();

    // 创建过滤函数
    const isBannedContent = (item) => {
      const typeName = item.type_name || '';
      const areaName = item.vod_area || '';
      if (bannedTypes.some(keyword => typeName.includes(keyword))) return true;
      if (bannedAreas.some(keyword => areaName.includes(keyword))) return true;
      return false;
    };

    // 更新状态为同步中
    await kv.set('sync-status', { status: 'syncing', startTime, sourceUrl });
    await updateProgress({ phase: '获取分类列表', processedCategories: 0, totalCategories: 0, videosCount: 0 });

    // 1. 拉取分类
    const categoryData = await fetchFromSource(sourceUrl, '?ac=list');
    const allCategories = categoryData.class || [];

    // 过滤：排除禁止分类 + 只保留子分类（type_pid > 0）
    const safeCategories = allCategories.filter(cat => {
      const typeName = cat.type_name || '';
      const typePid = parseInt(cat.type_pid, 10) || 0;
      // 排除禁止的分类类型
      if (bannedTypes.some(keyword => typeName.includes(keyword))) return false;
      // 只保留子分类（type_pid > 0），跳过顶级分类
      if (typePid === 0) return false;
      return true;
    });
    await kv.set('categories', { list: safeCategories, updatedAt: Date.now() });

    const totalCategories = safeCategories.length;
    await updateProgress({ phase: '开始同步视频', processedCategories: 0, totalCategories, videosCount: 0 });

    // 检查是否需要停止
    if (await shouldStopSync()) {
      await kv.set('sync-status', { lastSync: Date.now(), status: 'stopped', message: '同步已被用户停止' });
      return res.status(200).json({ success: false, stopped: true, message: '同步已停止' });
    }

    // 2. 按分类拉取视频（全量抓取，直到无数据为止）
    const allVideos = [];
    let processedCategories = 0;
    const MAX_PAGES_PER_CATEGORY = 1000; // 安全上限，防止死循环

    for (const cat of safeCategories) {
      // 检查是否需要停止
      if (await shouldStopSync()) {
        await kv.set('sync-status', { lastSync: Date.now(), status: 'stopped', message: '同步已被用户停止', processedCategories, totalCategories });
        return res.status(200).json({ success: false, stopped: true, message: '同步已停止' });
      }

      try {
        const categoryVideos = [];
        let currentPage = 1;
        let totalPages = 1;

        // 无限循环抓取，直到没有数据
        while (currentPage <= MAX_PAGES_PER_CATEGORY) {
          // 检查是否需要停止
          if (await shouldStopSync()) {
            await kv.set('sync-status', { lastSync: Date.now(), status: 'stopped', message: '同步已被用户停止', processedCategories, totalCategories });
            return res.status(200).json({ success: false, stopped: true, message: '同步已停止' });
          }

          // 更新进度（每页更新）
          await updateProgress({
            phase: '同步中',
            currentCategory: cat.type_name,
            currentPage,
            totalPages,
            processedCategories,
            totalCategories,
            videosCount: allVideos.length + categoryVideos.length
          });

          const data = await fetchFromSource(sourceUrl, `?ac=detail&t=${cat.type_id}&pg=${currentPage}`);
          const list = Array.isArray(data.list) ? data.list : [];
          totalPages = data.pagecount || 1;

          // 如果没有数据，退出循环
          if (list.length === 0) break;

          const safeList = list.filter(item => !isBannedContent(item)).map(simplifyVideo);
          categoryVideos.push(...safeList);

          // 如果已到达最后一页，退出循环
          if (currentPage >= totalPages) break;

          currentPage++;
        }

        // 存储该分类的所有视频
        await kv.set(`category:${cat.type_id}`, {
          list: categoryVideos, total: categoryVideos.length, updatedAt: Date.now()
        });
        allVideos.push(...categoryVideos);

        console.log(`分类 ${cat.type_name} 同步完成: ${categoryVideos.length} 个视频, ${currentPage} 页`);
      } catch (e) {
        console.error(`分类 ${cat.type_name} 同步失败:`, e.message);
      }

      processedCategories++;
    }

    // 更新进度 - 处理数据
    await updateProgress({ phase: '处理首页数据', processedCategories, totalCategories, videosCount: allVideos.length });

    // 3. 首页数据
    const homeData = allVideos.sort((a, b) => (b.vod_id || 0) - (a.vod_id || 0)).slice(0, 40);
    await kv.set('home-data', { list: homeData, updatedAt: Date.now() });

    // 更新进度 - 建立索引
    await updateProgress({ phase: '建立搜索索引', processedCategories, totalCategories, videosCount: allVideos.length });

    // 4. 搜索索引
    const uniqueVideos = [];
    const seenIds = new Set();
    for (const v of allVideos) {
      if (!seenIds.has(v.vod_id)) { seenIds.add(v.vod_id); uniqueVideos.push(v); }
    }
    await kv.set('search-index', { list: uniqueVideos, updatedAt: Date.now() });

    // 5. 更新状态
    const syncStatus = {
      lastSync: Date.now(),
      totalVideos: uniqueVideos.length,
      categories: safeCategories.length,
      status: 'success',
      duration: Date.now() - startTime,
      sourceUrl
    };
    await kv.set('sync-status', syncStatus);
    await kv.del('sync-progress'); // 清除进度

    return res.status(200).json({ success: true, ...syncStatus });
  } catch (error) {
    await kv.set('sync-status', { lastSync: Date.now(), status: 'error', error: error.message });
    await kv.del('sync-progress');
    return res.status(500).json({ success: false, error: error.message });
  }
}

