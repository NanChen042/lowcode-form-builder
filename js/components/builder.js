import { getUniqueId, state } from '../core/state.js';
import { optionTypes, valueTypes, defaultCountryOptions, defaultNationalityOptions } from './registry.js';
import { readOptions, writeOptions, safeCreateIcons } from '../utils/helpers.js';
import { initDropzone, checkEmptyState, refreshNestedEmptyStates, selectElement } from '../ui/canvas.js';
import { canvasWorld } from '../ui/dom.js';

// 各类表单组件的默认配置数据，包含标题、占位符、帮助说明和预设选项等
export const componentDefaults = {
    input: {
        label: '单行文本',
        placeholder: '请输入内容',
        help: '',
        defaultValue: ''
    },
    textarea: {
        label: '多行文本',
        placeholder: '请输入详细描述...',
        help: '',
        defaultValue: ''
    },
    select: {
        label: '下拉选择',
        placeholder: '请选择选项',
        help: '',
        defaultValue: '',
        options: [
            { label: '选项一', value: 'option_1' },
            { label: '选项二', value: 'option_2' }
        ]
    },
    country: {
        label: '国家选择',
        placeholder: '请选择国家',
        help: '',
        defaultValue: '',
        maxSelections: 3,
        options: defaultCountryOptions
    },
    nationality: {
        label: '国籍选择',
        placeholder: '请选择国籍',
        help: '',
        defaultValue: '',
        maxSelections: 3,
        options: defaultNationalityOptions
    },
    signature: {
        label: '声明与签名',
        placeholder: '',
        help: '',
        options: [
            { label: '本人保证以上填写的信息真实、准确、有效。', value: 'dec_1' }
        ]
    },
    radio: {
        label: '单选框组',
        help: '',
        defaultValue: 'option_1',
        layout: 'inline',
        options: [
            { label: '选项一', value: 'option_1' },
            { label: '选项二', value: 'option_2' }
        ]
    },
    checkbox: {
        label: '多选框组',
        help: '',
        defaultValue: 'option_1',
        layout: 'inline',
        maxSelections: 3,
        options: [
            { label: '选项一', value: 'option_1' },
            { label: '选项二', value: 'option_2' }
        ]
    },
    date: {
        label: '日期选择',
        help: '',
        defaultValue: ''
    },
    grid: {
        label: '双列布局容器',
        layout: 'grid'
    },
    alert: {
        label: '提示',
        options: [
            { label: '您将作为以下公司的授权代表，完成KYC问卷填写。', value: 'opt_1' },
            { label: '请确认以下信息是否准确，如需修改，请联系服务商修改后再进行下一步。', value: 'opt_2' }
        ]
    }
};

// 根据组件类型和唯一ID生成对应的字段Key
export function makeFieldKey(type, id) {
    return `${type}_${String(id).replace('cmp_', '')}`;
}

// 设置画布元素的标签文本（Label），同时保留必填项的星号标记
export function setLabelText(el, value) {
    const labelNode = el.querySelector('.component-label');
    if (!labelNode) return;

    // 保存现有的必填红星节点
    const reqStar = labelNode.querySelector('.req-star');
    
    // 查找或创建可编辑的文本节点
    let textSpan = labelNode.querySelector('.label-text');
    if (!textSpan) {
        textSpan = document.createElement('span');
        textSpan.className = 'label-text outline-none transition-all duration-200 hover:text-[#1677ff] cursor-text';
        textSpan.contentEditable = "plaintext-only";
        textSpan.spellcheck = false;
        
        // 极简焦点效果：仅保留底部强调线和主题色
        const focusClasses = [
            'shadow-[0_2px_0_0_#1677ff]', 
            'text-[#1677ff]'
        ];
        textSpan.addEventListener('focus', () => textSpan.classList.add(...focusClasses));
        textSpan.addEventListener('blur', () => {
            textSpan.classList.remove(...focusClasses);
            if (!textSpan.textContent.trim()) {
                textSpan.textContent = '未命名字段';
                el.dataset.label = '未命名字段';
            }
        });

        // 当在画布上直接修改文字时，同步更新数据和右侧属性面板
        textSpan.addEventListener('input', e => {
            el.dataset.label = e.target.textContent;
            const propLabelInput = document.getElementById('prop-label-input');
            if (propLabelInput && el.classList.contains('is-selected')) {
                propLabelInput.value = e.target.textContent;
            }
        });
        
        // 回车键确认完成编辑
        textSpan.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                textSpan.blur();
            }
        });
    }

    // 仅在值不同时更新，避免光标跳动
    if (value !== undefined && textSpan.textContent !== value) {
        textSpan.textContent = value || '未命名字段';
    }

    labelNode.innerHTML = ''; // 清空当前内容
    labelNode.appendChild(textSpan);
    
    // 如果存在必填红星节点，则重新添加回去
    labelNode.appendChild(document.createTextNode(' '));
    if (reqStar) labelNode.appendChild(reqStar);
}

// 渲染字段下方的帮助说明文本
export function renderHelpText(el) {
    const existing = el.querySelector(':scope > .field-help');
    const text = el.dataset.help || '';
    // 如果没有帮助文本，则移除已有的 DOM 节点
    if (!text) {
        if (existing) existing.remove();
        return;
    }

    // 更新或创建帮助文本节点
    const helpNode = existing || document.createElement('p');
    helpNode.className = 'field-help';
    helpNode.textContent = text;
    if (!existing) el.appendChild(helpNode);
}

// 渲染带有选项的组件的内容（如：下拉、单选、多选、签名）
export function renderOptions(el) {
    const type = el.dataset.type;
    const options = readOptions(el);

    // 处理下拉选择、国家、国籍等 Select 类型的组件
    if (['select', 'country', 'nationality'].includes(type)) {
        const select = el.querySelector('select');
        if (!select) return;

        select.innerHTML = '';
        // 对于普通下拉菜单，先添加一个占位符选项
        if (type === 'select') {
            const placeholderOption = document.createElement('option');
            placeholderOption.textContent = el.dataset.placeholder || '请选择选项';
            placeholderOption.value = '';
            select.appendChild(placeholderOption);
        }

        // 渲染所有具体选项
        options.forEach(option => {
            const optionNode = document.createElement('option');
            optionNode.textContent = option.label || option.value || '未命名选项';
            optionNode.value = option.value || '';
            select.appendChild(optionNode);
        });

        // 针对国家或国籍类型，特殊处理其默认值和占位符显示逻辑
        if (type === 'country' || type === 'nationality') {
            const placeholderOption = document.createElement('option');
            let values = [];
            try {
                values = JSON.parse(el.dataset.defaultValue || '[]');
                if (!Array.isArray(values)) values = (el.dataset.defaultValue || '').split(',').filter(Boolean);
            } catch (e) {
                values = (el.dataset.defaultValue || '').split(',').filter(Boolean);
            }
            if (values.length === 0) {
                placeholderOption.textContent = el.dataset.placeholder || '请选择';
            } else {
                const labels = values.map(v => {
                    const found = options.find(o => o.value === v);
                    return found ? (found.label || found.value) : v;
                });
                placeholderOption.textContent = labels.join(', ');
            }
            placeholderOption.value = '';
            select.insertBefore(placeholderOption, select.firstChild);
            select.value = '';
        } else {
            // 普通下拉菜单设置默认选中值
            select.value = el.dataset.defaultValue || '';
        }
        return;
    }

    // 处理签名与声明组件
    if (type === 'signature') {
        const optionsContainer = el.querySelector('.signature-options-container');
        if (optionsContainer) {
            optionsContainer.innerHTML = '';
            // 将每一个签名选项渲染为一个复选框
            options.forEach((opt, index) => {
                const label = document.createElement('label');
                label.className = 'flex items-start gap-2.5 cursor-pointer';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.className = 'mt-1 flex-shrink-0 rounded text-[#1677ff] focus:ring-[#1677ff]';
                input.value = opt.value || '';
                input.tabIndex = -1;

                const span = document.createElement('span');
                span.className = 'option-text signature-declaration-text text-sm text-black/85 leading-5 outline-none transition-all duration-200 hover:text-[#1677ff] cursor-text';
                span.dataset.index = index;
                span.contentEditable = "plaintext-only";
                span.spellcheck = false;
                span.textContent = opt.label || opt.value || '';

                const focusClasses = [
                    'shadow-[0_2px_0_0_#1677ff]', 
                    'text-[#1677ff]'
                ];
                span.addEventListener('focus', () => span.classList.add(...focusClasses));
                span.addEventListener('blur', () => {
                    span.classList.remove(...focusClasses);
                    if (!span.textContent.trim()) {
                        span.textContent = opt.label || opt.value || '';
                        span.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    const optData = readOptions(el);
                    if (optData[index]) {
                        optData[index].label = span.textContent;
                        writeOptions(el, optData);
                    }
                });
                
                span.addEventListener('mousedown', e => e.stopPropagation());
                span.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                });
                
                span.addEventListener('keydown', e => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        span.blur();
                    }
                });

                label.appendChild(input);
                label.appendChild(span);
                optionsContainer.appendChild(label);
            });
        }
        return;
    }
    // 处理提示区块组件
    if (type === 'alert') {
        const wrapper = el.querySelector('.alert-content-wrapper');
        if (wrapper) {
            wrapper.innerHTML = '';
            options.forEach((opt, index) => {
                const p = document.createElement('p');
                p.className = 'relative';
                
                const dot = document.createElement('span');
                dot.className = 'absolute -left-[14px] top-[7px] flex h-1.5 w-1.5 rounded-sm bg-blue-400';
                
                const span = document.createElement('span');
                span.className = 'option-text outline-none transition-all duration-200 cursor-text';
                span.dataset.index = index;
                span.contentEditable = "plaintext-only";
                span.spellcheck = false;
                span.textContent = opt.label || opt.value || '';
                
                const focusClasses = [
                    'shadow-[0_2px_0_0_#1677ff]', 
                    'text-[#1677ff]'
                ];
                span.addEventListener('focus', () => span.classList.add(...focusClasses));
                
                span.addEventListener('blur', () => {
                    span.classList.remove(...focusClasses);
                    if (!span.textContent.trim()) {
                        span.textContent = opt.label || opt.value || '';
                        span.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    const optData = readOptions(el);
                    if (optData[index]) {
                        optData[index].label = span.textContent;
                        writeOptions(el, optData);
                    }
                });
                
                span.addEventListener('mousedown', e => e.stopPropagation());
                span.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
                span.addEventListener('keydown', e => {
                    if (e.key === 'Enter') { e.preventDefault(); span.blur(); }
                });

                p.appendChild(dot);
                p.appendChild(span);
                wrapper.appendChild(p);
            });
        }
        return;
    }

    // 接下来仅处理单选和多选框组
    if (type !== 'radio' && type !== 'checkbox') return;

    const group = el.querySelector('.choice-group');
    if (!group) return;

    group.innerHTML = '';
    // 根据数据属性设置内联排布或垂直排布
    group.classList.toggle('choice-stack', el.dataset.layout === 'stack');

    // 遍历渲染单选/多选的各个选项
    options.forEach((option, index) => {
        const optionValue = option.value || `option_${index + 1}`;
        const label = document.createElement('label');

        const input = document.createElement('input');
        input.type = type;
        input.value = optionValue;

        // 根据默认值数据决定该选项是否被选中
        if (type === 'radio') {
            input.name = `${el.id}_preview`;
            input.checked = (el.dataset.defaultValue || '') === optionValue;
        } else {
            let selectedValues = [];
            try {
                selectedValues = JSON.parse(el.dataset.defaultValue || '[]');
                if (!Array.isArray(selectedValues)) selectedValues = (el.dataset.defaultValue || '').split(',').map(item => item.trim()).filter(Boolean);
            } catch (e) {
                selectedValues = (el.dataset.defaultValue || '').split(',').map(item => item.trim()).filter(Boolean);
            }
            input.checked = selectedValues.includes(optionValue);
        }

        const span = document.createElement('span');
        span.className = 'option-text outline-none transition-all duration-200 hover:text-[#1677ff] cursor-text';
        span.dataset.index = index;
        span.contentEditable = "plaintext-only";
        span.spellcheck = false;
        span.textContent = option.label || optionValue;

        // 极简焦点效果：仅保留底部强调线和主题色
        const focusClasses = [
            'shadow-[0_2px_0_0_#1677ff]', 
            'text-[#1677ff]'
        ];
        span.addEventListener('focus', () => span.classList.add(...focusClasses));
        span.addEventListener('blur', () => {
            span.classList.remove(...focusClasses);
            if (!span.textContent.trim()) {
                span.textContent = option.label || optionValue;
            }
            // 失去焦点时同步数据到右侧属性面板
            const optData = readOptions(el);
            if (optData[index]) {
                optData[index].label = span.textContent;
                writeOptions(el, optData);
            }
        });
        
        // 阻止点击事件触发父级 label 的默认行为（会导致焦点被强制转移给 radio/checkbox，引发光标瞬间闪退）
        span.addEventListener('mousedown', e => {
            // 如果不阻止冒泡，部分浏览器可能会在 mousedown 阶段就开始转移焦点
            e.stopPropagation();
        });
        span.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
        });
        
        span.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                span.blur();
            }
        });

        label.appendChild(input);
        label.appendChild(span);
        group.appendChild(label);
    });
}

// 渲染输入框等组件的默认值
export function renderDefaultValue(el) {
    const type = el.dataset.type;
    const defaultValue = el.dataset.defaultValue || '';

    // 对于单行文本和日期
    if (type === 'input' || type === 'date') {
        const node = el.querySelector('input.component-placeholder');
        if (node) node.value = defaultValue;
    }

    // 对于多行文本
    if (type === 'textarea') {
        const node = el.querySelector('textarea.component-placeholder');
        if (node) node.value = defaultValue;
    }
}

// 统一更新画布元素的界面呈现（标签、占位符、必填等），保持和数据一致
export function updateElementFromData(el) {
    setLabelText(el, el.dataset.label || '');

    const placeholderNode = el.querySelector('.component-placeholder');
    if (placeholderNode && el.dataset.type !== 'select') {
        placeholderNode.setAttribute('placeholder', el.dataset.placeholder || '');
    }

    // 处理必填星号的显示和隐藏
    const reqStar = el.querySelector('.req-star');
    if (reqStar) reqStar.classList.toggle('hidden', el.dataset.required !== 'true');

    // 处理日期组件的具体类型（如日期、年月等）
    if (el.dataset.type === 'date') {
        const dateInput = el.querySelector('.component-placeholder');
        if (dateInput) dateInput.type = el.dataset.dateType || 'date';
    }

    renderDefaultValue(el);
    renderOptions(el);
    renderHelpText(el);
    safeCreateIcons();
}

// 在添加新组件时，将组件的默认配置数据写入到DOM的 dataset 中
export function setupElementData(el, type) {
    const defaults = componentDefaults[type] || {};
    el.dataset.type = type;
    el.dataset.label = defaults.label || '';
    el.dataset.key = makeFieldKey(type, el.id);
    el.dataset.placeholder = defaults.placeholder || '';
    el.dataset.help = defaults.help || '';
    el.dataset.defaultValue = defaults.defaultValue || '';
    el.dataset.required = 'false';
    el.dataset.layout = defaults.layout || 'inline';

    if ('maxSelections' in defaults) {
        el.dataset.maxSelections = defaults.maxSelections;
    }

    if (defaults.options) {
        writeOptions(el, defaults.options);
    }

    updateElementFromData(el);
}

// 将选定类型的组件添加到画布中
export function addComponentToCanvas(type) {
    // 查找对应组件的HTML模板
    const template = document.getElementById(`tpl-${type}`);
    if (!template) return;

    // 克隆模板内容以创建新的DOM节点
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(template.content.cloneNode(true));
    const rootDiv = tempDiv.querySelector('.canvas-element');

    // 初始化新的组件容器元素
    const itemEl = document.createElement('div');
    itemEl.className = rootDiv.className;
    itemEl.innerHTML = rootDiv.innerHTML;
    itemEl.id = `cmp_${getUniqueId()}`;

    // 使用默认配置设置该组件的数据属性
    setupElementData(itemEl, type);

    // 确定新组件要插入的目标容器（默认为最后一页的拖放区）
    let defaultDropzone = document.getElementById(state.pages[state.pages.length - 1].id);
    let targetContainer = defaultDropzone;
    let insertAfter = null;

    // 如果当前有选中的元素，则在其后方或其内部（如果是嵌套容器）插入新组件
    if (state.selectedElement && state.selectedElement.classList) {
        if (state.selectedElement.classList.contains('mobile-frame')) {
            targetContainer = state.selectedElement.querySelector('.canvas-dropzone');
        } else if (state.selectedElement.classList.contains('nested-dropzone')) {
            targetContainer = state.selectedElement;
        } else if (state.selectedElement.closest('.nested-dropzone')) {
            targetContainer = state.selectedElement.closest('.nested-dropzone');
            insertAfter = state.selectedElement;
        } else if (canvasWorld.contains(state.selectedElement)) {
            targetContainer = state.selectedElement.closest('.canvas-dropzone');
            insertAfter = state.selectedElement;
        }
    }
    
    if (!targetContainer) {
        targetContainer = document.querySelector('.canvas-dropzone');
    }

    // 执行插入操作
    if (insertAfter && insertAfter.nextSibling) {
        targetContainer.insertBefore(itemEl, insertAfter.nextSibling);
    } else {
        targetContainer.appendChild(itemEl);
    }

    // 渲染图标
    safeCreateIcons();

    // 如果是栅格布局容器，需要初始化其内部的拖放区域
    if (type === 'grid') {
        itemEl.querySelectorAll('.nested-dropzone').forEach(zone => initDropzone(zone));
    }

    // 更新各层级的空状态提示，并选中新添加的组件
    checkEmptyState();
    refreshNestedEmptyStates();
    selectElement(itemEl);
}
