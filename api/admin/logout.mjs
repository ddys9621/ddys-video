export default async function handler(req, res) {
  // 清除 session cookie
  res.setHeader('Set-Cookie', [
    'admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
  ]);

  return res.status(200).json({
    success: true,
    message: '已退出登录'
  });
}

