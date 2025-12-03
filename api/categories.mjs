import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // 设置缓存头
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  
  try {
    const data = await kv.get('categories');
    
    if (!data) {
      return res.status(404).json({
        success: false,
        error: '分类数据未同步'
      });
    }

    return res.status(200).json({
      success: true,
      ...data
    });

  } catch (error) {
    console.error('读取分类数据失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

