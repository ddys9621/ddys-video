import { kv } from '@vercel/kv';
import { verifyAdmin } from './verify.mjs';

// 默认配置
const DEFAULT_SOURCE = 'https://subocj.com/api.php/provide/vod/';
const DEFAULT_BANNED_TYPES = [
  '伦理片', '福利', '里番动漫', '门事件', '萝莉少女', '制服诱惑',
  '国产传媒', 'cosplay', '黑丝诱惑', '无码', '日本无码', '有码',
  '日本有码', 'SWAG', '网红主播', '色情片', '同性片', '福利视频',
  '福利片', '国产动漫', '大陆综艺', '国产剧', '短剧', '大陆剧', '中国动漫'
];
const DEFAULT_BANNED_AREAS = ['大陆', '中国大陆', '内地'];

export default async function handler(req, res) {
  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: '请先登录' });
  }

  const { action } = req.query; // action: 'config' | 'filter' | 'stop' | 'clear'

  // GET: 获取配置
  if (req.method === 'GET') {
    try {
      const sourceConfig = await kv.get('source-config');
      const filterConfig = await kv.get('filter-config');
      return res.status(200).json({
        success: true,
        data: {
          sourceUrl: sourceConfig?.sourceUrl || DEFAULT_SOURCE,
          bannedTypes: filterConfig?.bannedTypes || DEFAULT_BANNED_TYPES,
          bannedAreas: filterConfig?.bannedAreas || DEFAULT_BANNED_AREAS
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST: 执行操作
  if (req.method === 'POST') {
    try {
      const body = req.body || {};

      // 保存数据源
      if (action === 'source') {
        const { sourceUrl } = body;
        if (!sourceUrl || typeof sourceUrl !== 'string') {
          return res.status(400).json({ success: false, error: '请提供有效的数据源 URL' });
        }
        try { new URL(sourceUrl); } catch { 
          return res.status(400).json({ success: false, error: 'URL 格式不正确' }); 
        }
        // 测试数据源
        try {
          const testRes = await fetch(sourceUrl + '?ac=list', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(10000)
          });
          if (!testRes.ok) return res.status(400).json({ success: false, error: `数据源不可访问` });
          const testData = await testRes.json();
          if (!testData.class && !testData.list) {
            return res.status(400).json({ success: false, error: '数据源格式不正确' });
          }
        } catch (e) {
          return res.status(400).json({ success: false, error: `无法连接: ${e.message}` });
        }
        await kv.set('source-config', { sourceUrl: sourceUrl.trim(), updatedAt: Date.now() });
        return res.status(200).json({ success: true, message: '数据源保存成功' });
      }

      // 保存过滤规则
      if (action === 'filter') {
        const { bannedTypes, bannedAreas } = body;
        await kv.set('filter-config', {
          bannedTypes: Array.isArray(bannedTypes) ? bannedTypes : DEFAULT_BANNED_TYPES,
          bannedAreas: Array.isArray(bannedAreas) ? bannedAreas : DEFAULT_BANNED_AREAS,
          updatedAt: Date.now()
        });
        return res.status(200).json({ success: true, message: '过滤规则保存成功' });
      }

      // 停止同步
      if (action === 'stop') {
        await kv.set('sync-control', { shouldStop: true, requestedAt: Date.now() });
        return res.status(200).json({ success: true, message: '已发送停止信号' });
      }

      // 清空数据
      if (action === 'clear') {
        let deletedCount = 0;

        // 1. 删除固定的键
        const fixedKeys = ['sync-status', 'categories', 'home-data', 'search-index', 'sync-control', 'sync-progress'];
        for (const key of fixedKeys) {
          try {
            await kv.del(key);
            deletedCount++;
          } catch (e) { }
        }

        // 2. 扫描并删除所有 category:* 键
        try {
          let cursor = 0;
          do {
            const result = await kv.scan(cursor, { match: 'category:*', count: 100 });
            cursor = result[0];
            const keys = result[1];
            for (const key of keys) {
              try {
                await kv.del(key);
                deletedCount++;
              } catch (e) { }
            }
          } while (cursor !== 0);
        } catch (e) {
          console.error('扫描 category:* 键失败:', e.message);
        }

        return res.status(200).json({ success: true, message: `已清空 ${deletedCount} 项数据` });
      }

      return res.status(400).json({ success: false, error: '无效的操作' });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

