import { buildSchema } from '../core/schema.js';
import { FormAPI } from '../core/api.js';
import * as DOM from './dom.js';
import { parseMultiValue, safeCreateIcons } from '../utils/helpers.js';

let currentPreviewStep = 0;
let previewSchema = null;

// JSON 语法高亮实现，仿 One Dark 风格
function highlightJSON(jsonStr) {
    let str = jsonStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return str.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'text-[#d19a66]'; // number/boolean (orange)
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'text-[#e06c75]'; // key (red)
            } else {
                cls = 'text-[#98c379]'; // string (green)
            }
        } else if (/null/.test(match)) {
            cls = 'text-[#5c6370] italic'; // null (grey italic)
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

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

    if (field.type === 'alert') {
        const options = field.options || [];

        const section = document.createElement('section');
        section.className = 'overflow-hidden rounded-xl bg-blue-50/40 shadow-sm ring-1 ring-blue-100/80';

        const bar = document.createElement('div');
        bar.className = 'h-1 w-full bg-blue-500';
        section.appendChild(bar);

        const content = document.createElement('div');
        content.className = 'p-4 sm:p-5';

        const header = document.createElement('div');
        header.className = 'mb-3 flex items-center gap-2';
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'info');
        icon.className = 'h-4 w-4 text-blue-600 stroke-[2.5px]';
        const title = document.createElement('h3');
        title.className = 'text-[14px] font-bold text-blue-900 m-0';
        title.textContent = field.label || '提示';
        header.appendChild(icon);
        header.appendChild(title);

        const items = document.createElement('div');
        items.className = 'space-y-2 pl-6 text-[13px] leading-relaxed text-blue-800';
        options.forEach(opt => {
            const p = document.createElement('p');
            p.className = 'relative';
            const dot = document.createElement('span');
            dot.className = 'absolute -left-[14px] top-[7px] flex h-1.5 w-1.5 rounded-sm bg-blue-400';
            p.appendChild(dot);
            p.appendChild(document.createTextNode(opt.label || opt.value || ''));
            items.appendChild(p);
        });

        content.appendChild(header);
        content.appendChild(items);
        section.appendChild(content);
        wrapper.appendChild(section);
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

        const checks = document.createElement('div');
        checks.className = 'flex flex-col gap-3 mb-5';
        options.forEach(opt => {
            const checkLabel = document.createElement('label');
            checkLabel.className = 'flex items-start gap-2.5 cursor-pointer group';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'mt-1 flex-shrink-0 rounded text-[#1677ff] preview-input-checkbox';
            input.value = opt.value || '';
            input.required = true;

            const text = document.createElement('span');
            text.className = 'text-sm text-black/75 leading-5 group-hover:text-black/85 transition-colors';
            text.textContent = opt.label || opt.value || '';

            checkLabel.appendChild(input);
            checkLabel.appendChild(text);
            checks.appendChild(checkLabel);
        });

        const signArea = document.createElement('div');
        signArea.className = 'w-full h-32 bg-[#f8fafc] border-2 border-dashed border-[#cbd5e1] rounded-lg flex flex-col items-center justify-center text-[#94a3b8] cursor-pointer hover:border-[#1677ff] hover:bg-[#f0f7ff] hover:text-[#1677ff] transition-all relative overflow-hidden group';
        const penIcon = document.createElement('i');
        penIcon.setAttribute('data-lucide', 'pen-tool');
        penIcon.className = 'h-6 w-6 mb-2';
        const signText = document.createElement('span');
        signText.className = 'text-sm font-medium';
        signText.textContent = '点击此处进行手写签名';
        signArea.appendChild(penIcon);
        signArea.appendChild(signText);

        sigDiv.appendChild(checks);
        sigDiv.appendChild(signArea);
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
            
            let selectedValues = parseMultiValue(field.defaultValue);
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
        const selectedValues = parseMultiValue(field.defaultValue);

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
    
    // 动态切换预览表单顶部的标题和描述为当前页面的独立数据
    DOM.previewFormTitle.textContent = page.title || previewSchema.meta.title;
    DOM.previewFormDesc.textContent = page.description || previewSchema.meta.description || '暂无描述';
    
    if (previewSchema.pages.length > 1) {
        DOM.previewStepperContainer.classList.remove('hidden');
        DOM.previewStepperContainer.classList.add('flex');
        
        DOM.previewStepperContainer.innerHTML = '';
        previewSchema.pages.forEach((p, i) => {
            const step = document.createElement('div');
            step.className = `preview-step-item cursor-pointer flex items-start gap-3 transition hover:opacity-80 ${i === currentPreviewStep ? 'text-[#1677ff]' : 'text-black/45'}`;

            const markerWrap = document.createElement('div');
            markerWrap.className = 'flex flex-col items-center';
            const marker = document.createElement('span');
            marker.className = `flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${i === currentPreviewStep ? 'border-current font-medium bg-[#e6f4ff]' : 'border-gray-300'}`;
            marker.textContent = String(i + 1);
            markerWrap.appendChild(marker);

            if (i < previewSchema.pages.length - 1) {
                const line = document.createElement('div');
                line.className = 'w-px h-8 bg-gray-200 my-1';
                markerWrap.appendChild(line);
            }

            const title = document.createElement('span');
            title.className = 'pt-1 text-sm font-medium leading-5';
            title.textContent = p.title || `第 ${i + 1} 页`;

            step.appendChild(markerWrap);
            step.appendChild(title);
            step.addEventListener('click', () => {
                if (currentPreviewStep !== i) {
                    currentPreviewStep = i;
                    renderPreviewStep();
                }
            });
            DOM.previewStepperContainer.appendChild(step);
        });

        // 更新手机端内部的极简进度指示器
        if (DOM.previewMobileProgress) {
            DOM.previewMobileProgress.classList.remove('hidden');
            DOM.previewMobileProgress.textContent = `第 ${currentPreviewStep + 1} 步 / 共 ${previewSchema.pages.length} 步`;
        }
    } else {
        DOM.previewStepperContainer.classList.add('hidden');
        DOM.previewStepperContainer.classList.remove('flex');
        if (DOM.previewMobileProgress) {
            DOM.previewMobileProgress.classList.add('hidden');
        }
    }
    
    if (!page.fields || page.fields.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'py-8 text-center text-black/45 text-sm';
        empty.textContent = '当前页面为空';
        DOM.previewFormBody.appendChild(empty);
    } else {
        page.fields.forEach(field => DOM.previewFormBody.appendChild(createPreviewField(field)));
    }
    
    const hasPrev = !isFirst;
    const hasNext = !isLast;
    
    if (hasPrev || hasNext) {
        const footer = document.createElement('div');
        footer.className = 'mt-8 flex items-center justify-end gap-3 pt-6 border-t border-[#f0f0f0]';
        
        if (hasPrev) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'rounded-md border border-[#d9d9d9] bg-white px-4 py-1.5 text-sm font-medium transition hover:border-[#1677ff] hover:text-[#1677ff]';
            prevBtn.textContent = '上一步';
            prevBtn.onclick = () => {
                currentPreviewStep--;
                renderPreviewStep();
            };
            footer.appendChild(prevBtn);
        }
        
        if (hasNext) {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'rounded-md bg-[#1677ff] px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#4096ff]';
            nextBtn.textContent = '下一步';
            nextBtn.onclick = () => {
                currentPreviewStep++;
                renderPreviewStep();
            };
            footer.appendChild(nextBtn);
        }
        
        DOM.previewFormBody.appendChild(footer);
    }
    
    safeCreateIcons();
}

// 根据指定模式（'preview'或'deploy'）初始化并打开预览弹窗
export function renderPreview(mode) {
    previewSchema = buildSchema();
    currentPreviewStep = 0;
    DOM.previewModalTitle.textContent = mode === 'deploy' ? '发布结构' : '表单预览';
    DOM.previewModalSubtitle.textContent = mode === 'deploy' ? '当前表单已生成可保存的结构数据' : '检查最终填写体验和结构';
    
    // 生成带语法高亮的 JSON
    const jsonStr = JSON.stringify(previewSchema, null, 2);
    DOM.schemaOutput.innerHTML = highlightJSON(jsonStr);
    
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

window.toggleSchemaSidebar = function() {
    const sidebar = document.getElementById('schema-sidebar');
    const uiSection = document.getElementById('preview-ui-section');
    
    // Check if sidebar is currently hidden (opacity-0)
    if (sidebar.classList.contains('opacity-0')) {
        // Fade in schema, fade out UI
        sidebar.classList.remove('opacity-0', 'pointer-events-none');
        sidebar.classList.add('opacity-100');
        
        uiSection.classList.remove('opacity-100');
        uiSection.classList.add('opacity-0', 'pointer-events-none');
    } else {
        // Fade out schema, fade in UI
        sidebar.classList.remove('opacity-100');
        sidebar.classList.add('opacity-0', 'pointer-events-none');
        
        uiSection.classList.remove('opacity-0', 'pointer-events-none');
        uiSection.classList.add('opacity-100');
    }
};

window.publishForm = async function(event) {
    const btn = event ? event.currentTarget : null;
    const originalHtml = btn ? btn.innerHTML : '';
    
    if (btn) {
        btn.innerHTML = `<i data-lucide="loader-2" class="h-4 w-4 animate-spin"></i>发布中...`;
        btn.classList.add('opacity-80', 'pointer-events-none');
        if (window.lucide) window.lucide.createIcons({ root: btn });
    }
    
    try {
        const response = await FormAPI.publishForm(previewSchema);
        if (response.success) {
            alert('表单发布成功！\n线上访问地址: ' + response.data.url);
            closePreviewModal();
        } else {
            throw new Error('发布失败');
        }
    } catch (error) {
        alert('发布报错: ' + error.message);
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.classList.remove('opacity-80', 'pointer-events-none');
            if (window.lucide) window.lucide.createIcons({ root: btn });
        }
    }
};

// 绑定 Schema 复制功能
if (DOM.copySchemaBtn) {
    DOM.copySchemaBtn.addEventListener('click', async () => {
        if (!previewSchema) return;
        try {
            await navigator.clipboard.writeText(JSON.stringify(previewSchema, null, 2));
            const originalHTML = DOM.copySchemaBtn.innerHTML;
            DOM.copySchemaBtn.innerHTML = '<i data-lucide="check" class="h-3.5 w-3.5"></i><span class="text-[11px] font-medium whitespace-nowrap">复制成功</span>';
            DOM.copySchemaBtn.classList.add('text-green-600', 'w-auto', 'px-2', 'gap-1');
            DOM.copySchemaBtn.classList.remove('w-6', 'text-black/45');
            if (window.lucide) window.lucide.createIcons({ root: DOM.copySchemaBtn });
            
            setTimeout(() => {
                DOM.copySchemaBtn.innerHTML = originalHTML;
                DOM.copySchemaBtn.classList.remove('text-green-600', 'w-auto', 'px-2', 'gap-1');
                DOM.copySchemaBtn.classList.add('w-6', 'text-black/45');
                if (window.lucide) window.lucide.createIcons({ root: DOM.copySchemaBtn });
            }, 2000);
        } catch (err) {
            console.error('Failed to copy: ', err);
        }
    });
}

// 将预览相关函数绑定到全局 window 对象供 HTML 中直接调用
export function bindPreviewEvents() {
    window.closePreviewModal = closePreviewModal;
    window.previewForm = previewForm;
    window.saveForm = saveForm;
}
