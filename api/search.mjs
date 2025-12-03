import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // 设置缓存头
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
  
  const query = (req.query.q || req.query.wd || '').trim().toLowerCase();
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 40;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: '请输入搜索关键词'
    });
  }

  try {
    const data = await kv.get('search-index');
    
    if (!data || !data.list) {
      return res.status(404).json({
        success: false,
        error: '搜索数据未同步'
      });
    }

    // 搜索匹配
    const results = data.list.filter(item => {
      const name = (item.vod_name || '').toLowerCase();
      return name.includes(query);
    });

    // 分页处理
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const pagedList = results.slice(startIndex, endIndex);
    const totalPages = Math.ceil(results.length / limit);

    return res.status(200).json({
      success: true,
      list: pagedList,
      total: results.length,
      page: page,
      pagecount: totalPages,
      limit: limit,
      query: query
    });

  } catch (error) {
    console.error('搜索失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

