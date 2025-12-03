import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // 设置缓存头
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
  
  const { id } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 40;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: '缺少分类 ID'
    });
  }

  try {
    const data = await kv.get(`category:${id}`);
    
    if (!data) {
      return res.status(404).json({
        success: false,
        error: '该分类数据未找到'
      });
    }

    // 分页处理
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const pagedList = data.list.slice(startIndex, endIndex);
    const totalPages = Math.ceil(data.list.length / limit);

    return res.status(200).json({
      success: true,
      list: pagedList,
      total: data.list.length,
      page: page,
      pagecount: totalPages,
      limit: limit,
      updatedAt: data.updatedAt
    });

  } catch (error) {
    console.error('读取分类数据失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

