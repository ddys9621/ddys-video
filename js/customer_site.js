const CUSTOMER_SITES = {
    // 可在此添加更多自定义API源
};

// 调用全局方法合并，并声明开发者固定启用的数据源列表
if (window.extendAPISites) {
    window.extendAPISites(CUSTOMER_SITES);

    // 由开发者配置的固定数据源列表（前端用户无法修改）
    // 如需启用更多接口，只需在此数组中添加对应的 key
    window.ACTIVE_SOURCES = ['ffzy'];
} else {
    console.error("错误：请先加载 config.js！");
}
