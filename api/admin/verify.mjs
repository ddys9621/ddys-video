import crypto from 'crypto';

// 验证 session token
function verifyToken(sessionValue, secret) {
  if (!sessionValue || !secret) return false;
  
  const parts = sessionValue.split('.');
  if (parts.length !== 2) return false;
  
  const [token, signature] = parts;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(token);
  const expectedSignature = hmac.digest('hex');
  
  return signature === expectedSignature;
}

// 从 cookie 中解析 session
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.trim().split('=');
    if (parts.length >= 2) {
      cookies[parts[0]] = parts.slice(1).join('=');
    }
  });
  return cookies;
}

// 验证管理员身份
export function verifyAdmin(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionValue = cookies['admin_session'];
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  return verifyToken(sessionValue, adminPassword);
}

export default async function handler(req, res) {
  const isValid = verifyAdmin(req);
  
  return res.status(200).json({
    authenticated: isValid
  });
}

