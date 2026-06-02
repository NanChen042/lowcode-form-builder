// 安全地创建 Lucide 图标，避免因库未加载导致的错误
export function safeCreateIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// 生成一个随机的唯一ID字符串
export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// 从画布元素的 dataset 中读取选项数据并解析为对象数组
export function readOptions(canvasElement) {
    if (!canvasElement.dataset.options) return [];
    try {
        return JSON.parse(canvasElement.dataset.options);
    } catch (e) {
        // 如果解析失败则返回空数组
        return [];
    }
}

// 将选项数据序列化为 JSON 字符串并写入画布元素的 dataset
export function writeOptions(canvasElement, options) {
    canvasElement.dataset.options = JSON.stringify(options);
}
