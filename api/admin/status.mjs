import { kv } from '@vercel/kv';
import { verifyAdmin } from './verify.mjs';

export default async function handler(req, res) {
  // 验证管理员身份
  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: '请先登录' });
  }

  try {
    const status = await kv.get('sync-status');
    
    if (!status) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'never',
          message: '尚未进行过同步'
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('获取状态失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

