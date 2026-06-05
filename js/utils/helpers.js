// 安全地创建 Lucide 图标，避免因库未加载导致的错误
export function safeCreateIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
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

// 读取多选默认值，兼容历史逗号字符串和新的 JSON 数组格式
export function parseMultiValue(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);

    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed.map(String).filter(Boolean);
        }
    } catch (e) {
        // 兼容旧数据：option_1,option_2
    }

    return String(value)
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

// 多选默认值统一写成 JSON 数组，避免与逗号文本混用
export function stringifyMultiValue(values) {
    return JSON.stringify(Array.from(new Set(values.filter(Boolean))));
}

// 通知 schema 发生了结构性变化，例如增删组件、排序或修改选项集合
export function notifySchemaChange() {
    document.dispatchEvent(new CustomEvent('schemachange'));
}
