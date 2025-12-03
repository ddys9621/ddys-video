import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // 设置缓存头
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  
  try {
    const data = await kv.get('home-data');
    
    if (!data) {
      return res.status(404).json({
        success: false,
        error: '数据未同步，请先在后台执行同步操作'
      });
    }

    return res.status(200).json({
      success: true,
      ...data
    });

  } catch (error) {
    console.error('读取首页数据失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

