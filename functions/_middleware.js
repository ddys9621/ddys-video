// Netlify Edge Middleware
// 之前用于向 HTML 注入密码哈希，现在站点已取消密码访问限制，
// 因此中间件只需按默认流程放行请求。
export async function onRequest(context) {
	const { next } = context;
	return next();
}