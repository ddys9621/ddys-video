import { kv } from '@vercel/kv';
import { verifyAdmin } from './verify.mjs';

// 源配置
const SOURCE_API = 'https://subocj.com/api.php/provide/vod/';

// 过滤规则
const BANNED_TYPES = [
  '伦理片', '福利', '里番动漫', '门事件', '萝莉少女', '制服诱惑',
  '国产传媒', 'cosplay', '黑丝诱惑', '无码', '日本无码', '有码',
  '日本有码', 'SWAG', '网红主播', '色情片', '同性片', '福利视频',
  '福利片', '国产动漫', '大陆综艺', '国产剧', '短剧', '大陆剧', '中国动漫'
];
const BANNED_AREAS = ['大陆', '中国大陆', '内地'];

function isBannedContent(item) {
  const typeName = item.type_name || '';
  const areaName = item.vod_area || '';
  if (BANNED_TYPES.some(keyword => typeName.includes(keyword))) return true;
  if (BANNED_AREAS.some(keyword => areaName.includes(keyword))) return true;
  return false;
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

async function fetchFromSource(params = '') {
  const url = SOURCE_API + params;
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();

    // 更新状态为同步中
    await kv.set('sync-status', { status: 'syncing', startTime });

    // 1. 拉取分类
    const categoryData = await fetchFromSource('?ac=list');
    const allCategories = categoryData.class || [];
    const safeCategories = allCategories.filter(cat => 
      !BANNED_TYPES.some(keyword => (cat.type_name || '').includes(keyword))
    );
    await kv.set('categories', { list: safeCategories, updatedAt: Date.now() });

    // 2. 按分类拉取视频
    const allVideos = [];
    for (const cat of safeCategories) {
      try {
        const categoryVideos = [];
        for (let page = 1; page <= 3; page++) {
          const data = await fetchFromSource(`?ac=detail&t=${cat.type_id}&pg=${page}`);
          const list = Array.isArray(data.list) ? data.list : [];
          if (list.length === 0) break;
          const safeList = list.filter(item => !isBannedContent(item)).map(simplifyVideo);
          categoryVideos.push(...safeList);
          if (page >= (data.pagecount || 1)) break;
        }
        await kv.set(`category:${cat.type_id}`, {
          list: categoryVideos, total: categoryVideos.length, updatedAt: Date.now()
        });
        allVideos.push(...categoryVideos);
      } catch (e) {
        console.error(`分类 ${cat.type_name} 同步失败:`, e.message);
      }
    }

    // 3. 首页数据
    const homeData = allVideos.sort((a, b) => (b.vod_id || 0) - (a.vod_id || 0)).slice(0, 40);
    await kv.set('home-data', { list: homeData, updatedAt: Date.now() });

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
      duration: Date.now() - startTime
    };
    await kv.set('sync-status', syncStatus);

    return res.status(200).json({ success: true, ...syncStatus });
  } catch (error) {
    await kv.set('sync-status', { lastSync: Date.now(), status: 'error', error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
}

