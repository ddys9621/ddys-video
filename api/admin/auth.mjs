import crypto from 'crypto';

// 生成 session token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Token 签名
function signToken(token, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(token);
  return hmac.digest('hex');
}

export default async function handler(req, res) {
  const action = req.query.action || 'login';

  // 登出
  if (action === 'logout') {
    res.setHeader('Set-Cookie', [
      'admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
    ]);
    return res.status(200).json({
      success: true,
      message: '已退出登录'
    });
  }

  // 登录
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body || {};
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return res.status(500).json({ error: '服务器未配置管理员密码' });
    }

    if (!password || password !== adminPassword) {
      return res.status(401).json({ error: '密码错误' });
    }

    // 生成 token
    const token = generateToken();
    const signature = signToken(token, adminPassword);
    const sessionValue = `${token}.${signature}`;

    // 设置 HttpOnly Cookie
    res.setHeader('Set-Cookie', [
      `admin_session=${sessionValue}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
    ]);

    return res.status(200).json({
      success: true,
      message: '登录成功'
    });

  } catch (error) {
    console.error('登录失败:', error);
    return res.status(500).json({ error: error.message });
  }
}

