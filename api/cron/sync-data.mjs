import { kv } from '@vercel/kv';

// 源配置
const SOURCE_API = 'https://subocj.com/api.php/provide/vod/';

// 过滤规则 - 这些分类和地区的内容不会存入 KV
const BANNED_TYPES = [
  '伦理片', '福利', '里番动漫', '门事件', '萝莉少女', '制服诱惑',
  '国产传媒', 'cosplay', '黑丝诱惑', '无码', '日本无码', '有码',
  '日本有码', 'SWAG', '网红主播', '色情片', '同性片', '福利视频',
  '福利片', '国产动漫', '大陆综艺', '国产剧', '短剧', '大陆剧', '中国动漫'
];
const BANNED_AREAS = ['大陆', '中国大陆', '内地'];

// 检查是否为敏感内容
function isBannedContent(item) {
  const typeName = item.type_name || '';
  const areaName = item.vod_area || '';
  if (BANNED_TYPES.some(keyword => typeName.includes(keyword))) return true;
  if (BANNED_AREAS.some(keyword => areaName.includes(keyword))) return true;
  return false;
}

// 精简视频数据，只保留必要字段
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

// 拉取数据的通用函数
async function fetchFromSource(params = '') {
  const url = SOURCE_API + params;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export default async function handler(req, res) {
  // 验证 CRON_SECRET
  const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
  if (cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('开始同步数据...');
    const startTime = Date.now();

    // 1. 拉取分类列表
    const categoryData = await fetchFromSource('?ac=list');
    const allCategories = categoryData.class || [];
    
    // 过滤敏感分类
    const safeCategories = allCategories.filter(cat => 
      !BANNED_TYPES.some(keyword => (cat.type_name || '').includes(keyword))
    );
    
    await kv.set('categories', {
      list: safeCategories,
      updatedAt: Date.now()
    });
    console.log(`分类同步完成: ${safeCategories.length} 个`);

    // 2. 按分类拉取视频并存储
    const allVideos = [];
    
    for (const cat of safeCategories) {
      try {
        // 每个分类拉取前几页数据
        const categoryVideos = [];
        for (let page = 1; page <= 3; page++) {
          const data = await fetchFromSource(`?ac=detail&t=${cat.type_id}&pg=${page}`);
          const list = Array.isArray(data.list) ? data.list : [];
          if (list.length === 0) break;
          
          // 过滤并精简
          const safeList = list.filter(item => !isBannedContent(item)).map(simplifyVideo);
          categoryVideos.push(...safeList);
          
          if (page >= (data.pagecount || 1)) break;
        }
        
        // 存储该分类的视频
        await kv.set(`category:${cat.type_id}`, {
          list: categoryVideos,
          total: categoryVideos.length,
          updatedAt: Date.now()
        });
        
        allVideos.push(...categoryVideos);
        console.log(`分类 ${cat.type_name} 同步完成: ${categoryVideos.length} 条`);
        
      } catch (catError) {
        console.error(`分类 ${cat.type_name} 同步失败:`, catError.message);
      }
    }

    // 3. 生成首页数据（最新 40 条）
    const homeData = allVideos
      .sort((a, b) => (b.vod_id || 0) - (a.vod_id || 0))
      .slice(0, 40);
    
    await kv.set('home-data', {
      list: homeData,
      updatedAt: Date.now()
    });
    console.log(`首页数据同步完成: ${homeData.length} 条`);

    // 4. 生成搜索索引（去重）
    const uniqueVideos = [];
    const seenIds = new Set();
    for (const video of allVideos) {
      if (!seenIds.has(video.vod_id)) {
        seenIds.add(video.vod_id);
        uniqueVideos.push(video);
      }
    }
    
    await kv.set('search-index', {
      list: uniqueVideos,
      updatedAt: Date.now()
    });
    console.log(`搜索索引同步完成: ${uniqueVideos.length} 条`);

    // 5. 更新同步状态
    const syncStatus = {
      lastSync: Date.now(),
      totalVideos: uniqueVideos.length,
      categories: safeCategories.length,
      status: 'success',
      duration: Date.now() - startTime
    };
    await kv.set('sync-status', syncStatus);

    return res.status(200).json({
      success: true,
      ...syncStatus
    });

  } catch (error) {
    console.error('同步失败:', error);
    
    await kv.set('sync-status', {
      lastSync: Date.now(),
      status: 'error',
      error: error.message
    });

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

