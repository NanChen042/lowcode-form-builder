import { buildSchema } from '../core/schema.js';
import * as DOM from './dom.js';
import { safeCreateIcons } from '../utils/helpers.js';

let currentPreviewStep = 0;
let previewSchema = null;

// 递归创建预览模式下的表单字段DOM节点
export function createPreviewField(field) {
    const wrapper = document.createElement('div');
    wrapper.className = field.type === 'grid' ? 'preview-grid' : 'preview-field';

    if (field.type === 'grid') {
        field.columns.forEach(column => {
            const columnNode = document.createElement('div');
            columnNode.className = 'preview-grid-column';
            const elements = column.elements || [];
            elements.forEach(childField => columnNode.appendChild(createPreviewField(childField)));
            wrapper.appendChild(columnNode);
        });
        return wrapper;
    }

    const label = document.createElement('label');
    label.className = 'mb-2 block text-sm font-medium text-black/85';
    label.textContent = field.label || '未命名字段';
    if (field.required) {
        const star = document.createElement('span');
        star.className = 'text-[#ff4d4f]';
        star.textContent = ' *';
        label.appendChild(star);
    }
    wrapper.appendChild(label);

    if (field.type === 'signature') {
        const sigDiv = document.createElement('div');
        sigDiv.className = 'mt-2 bg-white border border-[#e5e7eb] rounded-lg p-4 shadow-sm';
        const options = field.options || [];
            
        const labelsHtml = options.map(opt => `
            <label class="flex items-start gap-2.5 cursor-pointer group">
                <input type="checkbox" class="mt-1 flex-shrink-0 rounded text-[#1677ff] preview-input-checkbox" value="${opt.value}" required>
                <span class="text-sm text-black/75 leading-5 group-hover:text-black/85 transition-colors">${opt.label || opt.value || ''}</span>
            </label>
        `).join('');

        sigDiv.innerHTML = `
            <div class="flex flex-col gap-3 mb-5">
                ${labelsHtml}
            </div>
            <div class="w-full h-32 bg-[#f8fafc] border-2 border-dashed border-[#cbd5e1] rounded-lg flex flex-col items-center justify-center text-[#94a3b8] cursor-pointer hover:border-[#1677ff] hover:bg-[#f0f7ff] hover:text-[#1677ff] transition-all relative overflow-hidden group">
                <i data-lucide="pen-tool" class="h-6 w-6 mb-2"></i>
                <span class="text-sm font-medium">点击此处进行手写签名</span>
            </div>
        `;
        wrapper.appendChild(sigDiv);
    }

    if (field.type === 'input' || field.type === 'date') {
        const input = document.createElement('input');
        input.type = field.type === 'date' ? (field.dateType || 'date') : 'text';
        input.placeholder = field.placeholder || '';
        input.value = field.defaultValue || '';
        input.className = 'preview-input';
        wrapper.appendChild(input);
    }

    if (field.type === 'textarea') {
        const textarea = document.createElement('textarea');
        textarea.rows = 3;
        textarea.placeholder = field.placeholder || '';
        textarea.value = field.defaultValue || '';
        textarea.className = 'preview-input';
        wrapper.appendChild(textarea);
    }

    if (['select', 'country', 'nationality'].includes(field.type)) {
        const select = document.createElement('select');
        select.className = 'preview-input';
        
        if (field.type === 'country' || field.type === 'nationality') {
            const fakeSelect = document.createElement('div');
            fakeSelect.className = 'preview-input flex items-center gap-1.5 flex-wrap min-h-[32px] cursor-pointer relative bg-white';
            fakeSelect.style.paddingRight = '28px';
            
            let selectedValues = (field.defaultValue || '').split(',').filter(Boolean);
            const maxSelections = field.maxSelections ? parseInt(field.maxSelections, 10) : null;
            
            const menu = document.createElement('div');
            menu.className = 'absolute left-0 right-0 top-[calc(100%+4px)] bg-white border border-[#f0f0f0] rounded-lg shadow-lg z-50 hidden max-h-[200px] overflow-auto py-1';
            
            const renderTags = () => {
                Array.from(fakeSelect.children).forEach(child => {
                    if (child !== menu) child.remove();
                });
                
                if (selectedValues.length === 0) {
                    const placeholder = document.createElement('span');
                    placeholder.className = 'text-black/45';
                    placeholder.textContent = field.placeholder || '请选择';
                    fakeSelect.appendChild(placeholder);
                } else {
                    selectedValues.forEach(val => {
                        const opt = field.options.find(o => o.value === val);
                        const tag = document.createElement('span');
                        tag.className = 'bg-[#f5f5f5] text-[12px] border border-[#f0f0f0] rounded px-2 py-0.5 whitespace-nowrap leading-[18px] flex items-center gap-1';
                        tag.textContent = opt ? (opt.label || opt.value) : val;
                        
                        const removeIcon = document.createElement('i');
                        removeIcon.setAttribute('data-lucide', 'x');
                        removeIcon.className = 'h-3 w-3 hover:text-red-500';
                        tag.appendChild(removeIcon);
                        
                        tag.addEventListener('click', (e) => {
                            e.stopPropagation();
                            selectedValues = selectedValues.filter(v => v !== val);
                            const checkIcon = menu.querySelector(`[data-val="${val}"] i`);
                            if (checkIcon) checkIcon.classList.add('hidden');
                            renderTags();
                        });
                        
                        fakeSelect.appendChild(tag);
                    });
                }
                
                const icon = document.createElement('i');
                icon.setAttribute('data-lucide', 'chevron-down');
                icon.className = 'absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-black/25 pointer-events-none transition-transform duration-200';
                if (!menu.classList.contains('hidden')) {
                    icon.classList.add('rotate-180');
                }
                fakeSelect.appendChild(icon);
                
                if (typeof lucide !== 'undefined') lucide.createIcons({ root: fakeSelect });
            };
            
            field.options.forEach(opt => {
                const item = document.createElement('div');
                item.className = 'px-3 py-2 text-sm text-black/85 hover:bg-[#f5f5f5] cursor-pointer flex items-center justify-between';
                item.dataset.val = opt.value;
                
                const label = document.createElement('span');
                label.textContent = opt.label || opt.value;
                item.appendChild(label);
                
                const check = document.createElement('i');
                check.setAttribute('data-lucide', 'check');
                check.className = `h-4 w-4 text-[#1677ff] ${selectedValues.includes(opt.value) ? '' : 'hidden'}`;
                item.appendChild(check);
                
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (selectedValues.includes(opt.value)) {
                        selectedValues = selectedValues.filter(v => v !== opt.value);
                        check.classList.add('hidden');
                    } else {
                        if (maxSelections && selectedValues.length >= maxSelections) {
                            return;
                        }
                        selectedValues.push(opt.value);
                        check.classList.remove('hidden');
                    }
                    renderTags();
                });
                menu.appendChild(item);
            });
            
            fakeSelect.appendChild(menu);
            
            fakeSelect.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = menu.classList.contains('hidden');
                document.querySelectorAll('.preview-fake-menu').forEach(m => {
                    m.classList.add('hidden');
                    const parentIcon = m.parentElement.querySelector('[data-lucide="chevron-down"]');
                    if (parentIcon) parentIcon.classList.remove('rotate-180');
                });
                if (isHidden) {
                    menu.classList.remove('hidden');
                    menu.classList.add('preview-fake-menu');
                    const icon = fakeSelect.querySelector('[data-lucide="chevron-down"]');
                    if (icon) icon.classList.add('rotate-180');
                }
            });
            
            document.addEventListener('click', () => {
                if (!menu.classList.contains('hidden')) {
                    menu.classList.add('hidden');
                    const icon = fakeSelect.querySelector('[data-lucide="chevron-down"]');
                    if (icon) icon.classList.remove('rotate-180');
                }
            });
            
            renderTags();
            wrapper.appendChild(fakeSelect);
        } else {
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = field.placeholder || '请选择选项';
            select.appendChild(placeholderOption);

            field.options.forEach(option => {
                const optionNode = document.createElement('option');
                optionNode.value = option.value || '';
                optionNode.textContent = option.label || option.value || '未命名选项';
                select.appendChild(optionNode);
            });
            
            select.value = field.defaultValue || '';
            wrapper.appendChild(select);
        }
    }

    if (field.type === 'radio' || field.type === 'checkbox') {
        const group = document.createElement('div');
        group.className = field.layout === 'stack' ? 'flex flex-col gap-2' : 'flex flex-wrap gap-4';
        const selectedValues = String(field.defaultValue || '').split(',').map(item => item.trim()).filter(Boolean);

        field.options.forEach(option => {
            const optionValue = option.value || '';
            const optionLabel = document.createElement('label');
            optionLabel.className = 'inline-flex items-center gap-2 text-sm text-black/65';

            const input = document.createElement('input');
            input.type = field.type;
            input.name = field.type === 'radio' ? `${field.id}_preview` : field.key;
            input.value = optionValue;
            input.checked = field.type === 'radio'
                ? field.defaultValue === optionValue
                : selectedValues.includes(optionValue);

            const span = document.createElement('span');
            span.textContent = option.label || optionValue;
            optionLabel.appendChild(input);
            optionLabel.appendChild(span);
            group.appendChild(optionLabel);
        });
        wrapper.appendChild(group);
    }

    if (field.help) {
        const help = document.createElement('p');
        help.className = 'field-help';
        help.textContent = field.help;
        wrapper.appendChild(help);
    }

    return wrapper;
}

// 渲染预览弹窗的当前步骤（页面）内容
export function renderPreviewStep() {
    if (!previewSchema || !previewSchema.pages) return;
    DOM.previewFormBody.innerHTML = '';
    
    const page = previewSchema.pages[currentPreviewStep];
    const isFirst = currentPreviewStep === 0;
    const isLast = currentPreviewStep === previewSchema.pages.length - 1;
    
    if (previewSchema.pages.length > 1) {
        const header = document.createElement('div');
        // 使用水平滚动防止步骤挤压
        header.className = 'mb-6 flex items-center text-sm font-medium overflow-x-auto pb-2';
        const stepsHtml = previewSchema.pages.map((p, i) => `
            <div class="preview-step-item cursor-pointer flex shrink-0 items-center gap-2 transition hover:opacity-80 ${i === currentPreviewStep ? 'text-[#1677ff]' : 'text-black/45'}">
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${i === currentPreviewStep ? 'border-current' : 'border-gray-300'}">${i + 1}</span>
                <span class="whitespace-nowrap">${p.title}</span>
            </div>
            ${i < previewSchema.pages.length - 1 ? '<div class="h-[1px] w-8 shrink-0 bg-gray-200 mx-3"></div>' : ''}
        `).join('');
        header.innerHTML = stepsHtml;
        
        // 为每一个步骤绑定点击事件，实现随时切换预览
        const stepElements = header.querySelectorAll('.preview-step-item');
        stepElements.forEach((el, index) => {
            el.addEventListener('click', () => {
                if (currentPreviewStep !== index) {
                    currentPreviewStep = index;
                    renderPreviewStep();
                }
            });
        });
        
        DOM.previewFormBody.appendChild(header);
    }
    
    if (!page.fields || page.fields.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'py-8 text-center text-black/45 text-sm';
        empty.textContent = '当前页面为空';
        DOM.previewFormBody.appendChild(empty);
    } else {
        page.fields.forEach(field => DOM.previewFormBody.appendChild(createPreviewField(field)));
    }
    
    const footer = document.createElement('div');
    footer.className = 'mt-8 flex items-center justify-end gap-3 pt-6 border-t border-[#f0f0f0]';
    
    if (!isFirst) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'rounded-md border border-[#d9d9d9] bg-white px-4 py-1.5 text-sm font-medium transition hover:border-[#1677ff] hover:text-[#1677ff]';
        prevBtn.textContent = '上一步';
        prevBtn.onclick = () => {
            currentPreviewStep--;
            renderPreviewStep();
        };
        footer.appendChild(prevBtn);
    }
    
    if (!isLast) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'rounded-md bg-[#1677ff] px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#4096ff]';
        nextBtn.textContent = '下一步';
        nextBtn.onclick = () => {
            currentPreviewStep++;
            renderPreviewStep();
        };
        footer.appendChild(nextBtn);
    } else {
        const submitBtn = document.createElement('button');
        submitBtn.className = 'rounded-md bg-[#1677ff] px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#4096ff]';
        submitBtn.textContent = '提交表单';
        submitBtn.onclick = () => alert('表单提交成功！');
        footer.appendChild(submitBtn);
    }
    
    DOM.previewFormBody.appendChild(footer);
    safeCreateIcons();
}

// 根据指定模式（'preview'或'deploy'）初始化并打开预览弹窗
export function renderPreview(mode) {
    previewSchema = buildSchema();
    currentPreviewStep = 0;
    DOM.previewModalTitle.textContent = mode === 'deploy' ? '发布结构' : '表单预览';
    DOM.previewModalSubtitle.textContent = mode === 'deploy' ? '当前表单已生成可保存的结构数据' : '检查最终填写体验和结构';
    DOM.previewFormTitle.textContent = previewSchema.title;
    DOM.previewFormDesc.textContent = previewSchema.description || '暂无描述';
    
    DOM.schemaOutput.textContent = JSON.stringify(previewSchema, null, 2);
    
    const totalFields = previewSchema.pages.reduce((sum, page) => sum + page.fields.length, 0);
    DOM.schemaFieldCount.textContent = `共 ${previewSchema.pages.length} 页，包含 ${totalFields} 个字段`;
    
    renderPreviewStep();
    // 等待 DOM 更新后应用弹窗动画
    requestAnimationFrame(() => {
        DOM.previewModal.classList.remove('opacity-0', 'pointer-events-none');
        DOM.previewModalContent.classList.remove('scale-95', 'opacity-0');
    });
    safeCreateIcons();
}

// 关闭预览弹窗
export function closePreviewModal() {
    DOM.previewModal.classList.add('opacity-0', 'pointer-events-none');
    DOM.previewModalContent.classList.add('scale-95', 'opacity-0');
}

// 触发普通预览模式
export function previewForm() {
    renderPreview('preview');
}

// 触发部署（保存）预览模式
export function saveForm() {
    renderPreview('deploy');
}

// 将预览相关函数绑定到全局 window 对象供 HTML 中直接调用
export function bindPreviewEvents() {
    window.closePreviewModal = closePreviewModal;
    window.previewForm = previewForm;
    window.saveForm = saveForm;
}
