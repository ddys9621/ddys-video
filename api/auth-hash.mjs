// /api/auth-hash.mjs - 返回密码哈希的 API 端点
import crypto from 'crypto';

export default async function handler(req, res) {
    // 设置 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    
    const password = process.env.PASSWORD;
    
    if (!password) {
        res.status(200).json({ 
            success: false, 
            error: '服务器未配置密码' 
        });
        return;
    }
    
    // 计算 SHA-256 哈希
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    
    // 设置 cookie
    res.setHeader('Set-Cookie', `_auth_hash=${hash}; Path=/; Max-Age=86400; SameSite=Lax`);
    
    res.status(200).json({ 
        success: true, 
        hash: hash 
    });
}

