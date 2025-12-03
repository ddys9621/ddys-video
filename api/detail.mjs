// 视频详情 API - 从统一数据源获取详情和播放链接

// 源配置（与 sync.mjs 保持一致）
const SOURCE_API = 'https://subocj.com/api.php/provide/vod/';
const SOURCE_NAME = '低端影视';

export default async function handler(req, res) {
  // 设置缓存头
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  
  const id = req.query.id;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      error: '缺少视频ID参数'
    });
  }
  
  // 验证ID格式 - 只允许数字和有限的特殊字符
  if (!/^[\w-]+$/.test(id)) {
    return res.status(400).json({
      success: false,
      error: '无效的视频ID格式'
    });
  }

  try {
    // 构建详情请求 URL
    const detailUrl = `${SOURCE_API}?ac=detail&ids=${id}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`详情请求失败: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 检查返回的数据是否有效
    if (!data || !data.list || !Array.isArray(data.list) || data.list.length === 0) {
      return res.status(404).json({
        success: false,
        error: '未找到视频详情'
      });
    }
    
    const videoDetail = data.list[0];
    
    // 提取播放地址
    let episodes = [];
    
    if (videoDetail.vod_play_url) {
      const playSources = videoDetail.vod_play_url.split('$$$');
      const playFroms = (videoDetail.vod_play_from || '').split('$$$');
      
      // 智能选择最佳播放源
      let mainSource = null;
      
      // 策略1: 查找链接中包含 .m3u8 的播放源
      for (let i = 0; i < playSources.length; i++) {
        if (playSources[i].includes('.m3u8')) {
          mainSource = playSources[i];
          break;
        }
      }
      
      // 策略2: 查找 vod_play_from 中包含 m3u8 关键词的源
      if (!mainSource) {
        for (let i = 0; i < playFroms.length; i++) {
          const fromName = playFroms[i].toLowerCase();
          if (fromName.includes('m3u8') || fromName.includes('hls')) {
            mainSource = playSources[i];
            break;
          }
        }
      }
      
      // 策略3: 排除已知的非直链格式
      if (!mainSource) {
        const nonDirectPatterns = ['subyun', 'yun', 'player', 'parse'];
        for (let i = 0; i < playSources.length; i++) {
          const fromName = (playFroms[i] || '').toLowerCase();
          const isNonDirect = nonDirectPatterns.some(p => fromName.includes(p) && !fromName.includes('m3u8'));
          if (!isNonDirect && playSources[i]) {
            mainSource = playSources[i];
            break;
          }
        }
      }
      
      // 兜底: 使用第一个源
      if (!mainSource) {
        mainSource = playSources[0];
      }
      
      if (mainSource) {
        const episodeList = mainSource.split('#');
        episodes = episodeList.map(ep => {
          const parts = ep.split('$');
          return parts.length > 1 ? parts[1] : '';
        }).filter(url => url && (url.startsWith('http://') || url.startsWith('https://')));
      }
    }

    return res.status(200).json({
      success: true,
      code: 200,
      episodes: episodes,
      videoInfo: {
        title: videoDetail.vod_name,
        cover: videoDetail.vod_pic,
        desc: videoDetail.vod_content,
        type: videoDetail.type_name,
        year: videoDetail.vod_year,
        area: videoDetail.vod_area,
        director: videoDetail.vod_director,
        actor: videoDetail.vod_actor,
        remarks: videoDetail.vod_remarks,
        source_name: SOURCE_NAME
      }
    });

  } catch (error) {
    console.error('获取详情失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '获取详情失败'
    });
  }
}

