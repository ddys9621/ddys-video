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

  const { action } = req.query;

  // GET: 获取分类列表或同步状态
  if (req.method === 'GET') {
    // 获取远程分类列表
    if (action === 'categories') {
      try {
        const sourceUrl = await getSourceUrl();
        const { bannedTypes } = await getFilterConfig();
        const categoryData = await fetchFromSource(sourceUrl, '?ac=list');
        const allCategories = categoryData.class || [];

        // 标记每个分类是否被过滤
        const categoriesWithStatus = allCategories.map(cat => {
          const typeName = cat.type_name || '';
          const typePid = parseInt(cat.type_pid, 10) || 0;
          const isBanned = bannedTypes.some(keyword => typeName.includes(keyword));
          const isParent = typePid === 0;
          return {
            type_id: cat.type_id,
            type_name: cat.type_name,
            type_pid: typePid,
            isBanned,
            isParent,
            selectable: !isBanned && !isParent
          };
        });

        return res.status(200).json({
          success: true,
          categories: categoriesWithStatus,
          total: categoriesWithStatus.length,
          selectable: categoriesWithStatus.filter(c => c.selectable).length
        });
      } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
      }
    }

    // 获取同步状态
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
        progress: progress
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST: 执行同步操作
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 单分类同步
  if (action === 'category') {
    try {
      const { categoryId, categoryName } = req.body;
      if (!categoryId) {
        return res.status(400).json({ success: false, error: '缺少分类ID' });
      }

      const sourceUrl = await getSourceUrl();
      const { bannedTypes, bannedAreas } = await getFilterConfig();

      const isBannedContent = (item) => {
        const typeName = item.type_name || '';
        const areaName = item.vod_area || '';
        if (bannedTypes.some(keyword => typeName.includes(keyword))) return true;
        if (bannedAreas.some(keyword => areaName.includes(keyword))) return true;
        return false;
      };

      const categoryVideos = [];
      let currentPage = 1;
      let totalPages = 1;
      const MAX_PAGES = 100; // 每个分类最多100页，避免超时

      while (currentPage <= MAX_PAGES) {
        const data = await fetchFromSource(sourceUrl, `?ac=detail&t=${categoryId}&pg=${currentPage}`);
        const list = Array.isArray(data.list) ? data.list : [];
        totalPages = data.pagecount || 1;

        if (list.length === 0) break;

        const safeList = list.filter(item => !isBannedContent(item)).map(simplifyVideo);
        categoryVideos.push(...safeList);

        if (currentPage >= totalPages) break;
        currentPage++;
      }

      // 存储该分类的视频
      await kv.set(`category:${categoryId}`, {
        list: categoryVideos,
        total: categoryVideos.length,
        updatedAt: Date.now()
      });

      return res.status(200).json({
        success: true,
        categoryId,
        categoryName,
        count: categoryVideos.length,
        pages: currentPage
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // 完成同步：汇总数据生成首页和搜索索引
  if (action === 'finalize') {
    try {
      const { syncedCategories } = req.body; // [{ type_id, type_name }, ...]
      if (!syncedCategories || !Array.isArray(syncedCategories)) {
        return res.status(400).json({ success: false, error: '缺少已同步分类列表' });
      }

      const allVideos = [];

      // 从 KV 读取每个分类的数据
      for (const cat of syncedCategories) {
        try {
          const catData = await kv.get(`category:${cat.type_id}`);
          if (catData && Array.isArray(catData.list)) {
            allVideos.push(...catData.list);
          }
        } catch (e) {
          console.error(`读取分类 ${cat.type_name} 失败:`, e.message);
        }
      }

      // 生成首页数据（最新40条）
      const homeData = allVideos
        .sort((a, b) => (b.vod_id || 0) - (a.vod_id || 0))
        .slice(0, 40);
      await kv.set('home-data', { list: homeData, updatedAt: Date.now() });

      // 生成搜索索引（去重）
      const uniqueVideos = [];
      const seenIds = new Set();
      for (const v of allVideos) {
        if (!seenIds.has(v.vod_id)) {
          seenIds.add(v.vod_id);
          uniqueVideos.push(v);
        }
      }
      await kv.set('search-index', { list: uniqueVideos, updatedAt: Date.now() });

      // 存储分类列表
      await kv.set('categories', { list: syncedCategories, updatedAt: Date.now() });

      // 更新同步状态
      const syncStatus = {
        lastSync: Date.now(),
        totalVideos: uniqueVideos.length,
        categories: syncedCategories.length,
        status: 'success'
      };
      await kv.set('sync-status', syncStatus);

      return res.status(200).json({
        success: true,
        totalVideos: uniqueVideos.length,
        categories: syncedCategories.length
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // 默认返回错误
  return res.status(400).json({ error: '未知操作' });
}

