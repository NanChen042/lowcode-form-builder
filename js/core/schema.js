import { state, getUniqueId } from './state.js';
import { readOptions, writeOptions, safeCreateIcons } from '../utils/helpers.js';
import { updateElementFromData, setLabelText } from '../components/builder.js';
import { initDropzone, addPage, checkEmptyState, refreshNestedEmptyStates, focusOnPage, initPages, clearSelection } from '../ui/canvas.js';
import { canvasWorld } from '../ui/dom.js';

// 获取整个表单的元数据（标题和描述）
export function getFormMeta() {
    // 尝试获取第一页的Frame元素
    const firstPageFrame = document.getElementById(state.pages[0] ? `frame_${state.pages[0].id}` : null);
    // 从第一页中获取标题输入框
    const titleInput = firstPageFrame ? firstPageFrame.querySelector('.page-title-input') : null;
    // 从第一页中获取描述输入框
    const descInput = firstPageFrame ? firstPageFrame.querySelector('.page-desc-input') : null;
    return {
        title: titleInput ? titleInput.value.trim() || '未命名表单' : '未命名表单',
        description: descInput ? descInput.value.trim() : ''
    };
}

// 序列化单个画布元素，将其转换为 Schema 数据结构
export function serializeElement(el) {
    const type = el.dataset.type;
    // 提取基础属性
    const base = {
        id: el.id,
        type,
        label: el.dataset.label || '',
        key: el.dataset.key || '',
        required: el.dataset.required === 'true'
    };
    
    // 提取可选的基础属性
    if (el.dataset.help) base.help = el.dataset.help;
    if (el.dataset.defaultValue) base.defaultValue = el.dataset.defaultValue;

    // 处理栅格布局类型，递归序列化其内部的列和元素
    if (type === 'grid') {
        const columns = Array.from(el.querySelectorAll(':scope > .grid-columns > .nested-dropzone'));
        base.columns = columns.map(col => {
            const children = Array.from(col.querySelectorAll(':scope > .canvas-element'));
            return {
                id: col.id || 'col_' + Math.random().toString(36).substr(2,9),
                elements: children.map(serializeElement) // 递归调用
            };
        });
        return base;
    }

    // 处理带有选项的类型
    if (['select', 'radio', 'checkbox', 'country', 'nationality', 'signature'].includes(type)) {
        base.options = readOptions(el);
    }
    
    // 处理占位符
    if (type === 'input' || type === 'textarea' || type === 'date' || type === 'signature') {
        base.placeholder = el.dataset.placeholder || '';
    }
    
    // 处理日期类型的特定属性
    if (type === 'date') {
        base.dateType = el.dataset.dateType || 'date';
    }

    // 处理布局类型（内联或垂直）
    if (type === 'checkbox' || type === 'radio' || type === 'signature') {
        base.layout = el.dataset.layout || 'inline';
    }

    // 处理复选框的最大选择数量
    if (type === 'checkbox') {
        base.maxSelections = el.dataset.maxSelections ? parseInt(el.dataset.maxSelections, 10) : null;
    }

    return base;
}

// 构建整个表单的 JSON Schema
export function buildSchema() {
    // 遍历所有页面并序列化其中的元素
    const pagesSchema = state.pages.map(page => {
        const frame = document.getElementById(`frame_${page.id}`);
        const pageDropzone = frame ? frame.querySelector('.canvas-dropzone') : null;
        // 获取页面中的直接子元素并进行序列化
        const fields = pageDropzone ? Array.from(pageDropzone.querySelectorAll(':scope > .canvas-element')).map(serializeElement) : [];
        return {
            id: page.id,
            title: page.title,
            fields
        };
    });

    // 返回完整的 Schema 结构
    return {
        schemaVersion: '1.0.0', // Schema 版本号
        meta: getFormMeta(),    // 表单元数据
        pages: pagesSchema      // 页面及字段数据
    };
}

// 根据 Schema 数据创建单个画布元素（递归处理嵌套）
export function createElementFromSchema(fieldData) {
    const type = fieldData.type;
    const template = document.getElementById(`tpl-${type}`);
    if (!template) return null;

    const tempDiv = document.createElement('div');
    tempDiv.appendChild(template.content.cloneNode(true));
    const rootDiv = tempDiv.querySelector('.canvas-element');

    const itemEl = document.createElement('div');
    itemEl.className = rootDiv.className;
    itemEl.innerHTML = rootDiv.innerHTML;
    itemEl.id = fieldData.id || `cmp_${getUniqueId()}`;

    // 恢复基础属性
    itemEl.dataset.type = type;
    itemEl.dataset.label = fieldData.label || '';
    itemEl.dataset.key = fieldData.key || '';
    itemEl.dataset.required = fieldData.required ? 'true' : 'false';
    
    // 恢复可选属性
    if (fieldData.help !== undefined) itemEl.dataset.help = fieldData.help;
    if (fieldData.defaultValue !== undefined) itemEl.dataset.defaultValue = fieldData.defaultValue;
    if (fieldData.placeholder !== undefined) itemEl.dataset.placeholder = fieldData.placeholder;
    if (fieldData.dateType !== undefined) itemEl.dataset.dateType = fieldData.dateType;
    if (fieldData.layout !== undefined) itemEl.dataset.layout = fieldData.layout;
    if (fieldData.maxSelections !== undefined) itemEl.dataset.maxSelections = fieldData.maxSelections;

    // 恢复选项列表
    if (fieldData.options) {
        writeOptions(itemEl, fieldData.options);
    }

    // 处理栅格布局内的子元素
    if (type === 'grid' && fieldData.columns) {
        const dropzones = itemEl.querySelectorAll('.nested-dropzone');
        fieldData.columns.forEach((colData, idx) => {
            if (dropzones[idx]) {
                dropzones[idx].id = colData.id || `col_${getUniqueId()}`;
                colData.elements.forEach(childSchema => {
                    const childEl = createElementFromSchema(childSchema);
                    if (childEl) dropzones[idx].appendChild(childEl);
                });
                initDropzone(dropzones[idx]);
            }
        });
    }

    updateElementFromData(itemEl);
    return itemEl;
}

// 加载完整的 Schema 模板数据，并渲染到整个工作区
export function loadSchema(schema) {
    // 1. 清空当前状态和画布
    canvasWorld.innerHTML = '<svg id="canvas-connections" class="absolute inset-0 pointer-events-none" style="overflow: visible; z-index: 0;"></svg>';
    state.pages = [];
    state.selectedElement = null;

    // 2. 根据模板构建页面结构
    if (schema.pages && schema.pages.length > 0) {
        schema.pages.forEach((pageSchema, index) => {
            addPage(); // 内部会自动 push 到 state.pages 并生成 DOM
            
            const page = state.pages[state.pages.length - 1];
            page.title = pageSchema.title || `页面 ${index + 1}`;
            
            // 更新该页面的标题 DOM
            const frame = document.getElementById(`frame_${page.id}`);
            if (frame) {
                const titleInput = frame.querySelector('.page-title-input');
                if (titleInput) titleInput.value = page.title;
            }

            // 3. 将该页面的所有组件递归创建并塞入对应的拖放区
            const dropzone = document.getElementById(page.id);
            if (dropzone && pageSchema.fields) {
                pageSchema.fields.forEach(fieldSchema => {
                    const el = createElementFromSchema(fieldSchema);
                    if (el) dropzone.appendChild(el);
                });
            }
        });
    } else {
        // 如果没有页面，至少兜底创建一个空页
        addPage();
    }

    // 4. 更新整个表单的元信息（标题和描述），默认应用到第一页
    const firstPageFrame = document.getElementById(`frame_${state.pages[0].id}`);
    if (firstPageFrame && schema.meta) {
        const titleInput = firstPageFrame.querySelector('.page-title-input');
        const descInput = firstPageFrame.querySelector('.page-desc-input');
        if (titleInput) titleInput.value = schema.meta.title || '';
        if (descInput) descInput.value = schema.meta.description || '';
    }

    // 5. 刷新整个画布界面和所有内部状态
    safeCreateIcons();
    checkEmptyState();
    refreshNestedEmptyStates();
    
    // 初始化或重置交互状态
    focusOnPage(state.pages[0].id, true);
    
    // 清除选中的属性面板数据并刷新UI
    clearSelection();
}
