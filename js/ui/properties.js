import { state } from '../core/state.js';
import { optionTypes } from '../components/registry.js';
import { notifySchemaChange, parseMultiValue, stringifyMultiValue, readOptions, writeOptions, safeCreateIcons } from '../utils/helpers.js';
import { renderDefaultValue, renderOptions } from '../components/builder.js';
import { setLabelText, renderHelpText } from '../components/builder.js';
import * as DOM from './dom.js';

// 同步和验证最大选择数量，并更新 UI 和组件数据
export function syncMaxSelectionsUI(val) {
    if (!state.selectedElement || !DOM.inputMaxSelections) return;
    
    // 如果没有传入值或是无效数字，强制默认回落到 3
    let num = parseInt(val, 10);
    if (isNaN(num)) {
        num = 3; 
    }
    
    // 强制限制在 1 到 5 之间
    const clampedNum = Math.max(1, Math.min(5, num));
    
    // 更新数据和输入框
    state.selectedElement.dataset.maxSelections = clampedNum;
    DOM.inputMaxSelections.value = clampedNum;
    
    // 同步按钮状态：最小值1时禁用减号，最大值5时禁用加号
    if (DOM.btnMaxMinus && DOM.btnMaxPlus) {
        DOM.btnMaxMinus.disabled = clampedNum <= 1;
        DOM.btnMaxPlus.disabled = clampedNum >= 5;
    }
}

// 根据选中的组件数据更新右侧面板中的默认值设置界面
export function updateDefaultValueUI(el) {
    if (!el) return;
    const type = el.dataset.type;
    const isOptions = optionTypes.includes(type);
    
    // 如果是带选项的组件
    if (isOptions) {
        DOM.inputDefault.style.display = 'none'; // 隐藏普通的文本输入框
        
        const options = readOptions(el);
        const values = parseMultiValue(el.dataset.defaultValue);

        // 判断是否是支持多选的类型
        const isMultiChoice = type === 'checkbox' || type === 'country' || type === 'nationality';

        if (isMultiChoice) {
            if (DOM.selectDefault) DOM.selectDefault.style.display = 'none';
            if (DOM.checkboxDefaultGroup) {
                DOM.checkboxDefaultGroup.style.display = 'flex';
                DOM.checkboxDefaultGroup.innerHTML = '';
                // 渲染每个选项作为复选框，用于设置多选默认值
                options.forEach(opt => {
                    const label = document.createElement('label');
                    label.className = 'flex items-center gap-2 text-[13px] text-black/85 cursor-pointer';
                    
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.value = opt.value;
                    cb.checked = values.includes(opt.value);
                    
                    cb.addEventListener('change', () => {
                        if (!state.selectedElement) return;
                        const checkedCbs = DOM.checkboxDefaultGroup.querySelectorAll('input[type="checkbox"]:checked');
                        
                        // 强制在 UI 层面限制最大选择数量
                        const maxStr = state.selectedElement.dataset.maxSelections;
                        if (maxStr) {
                            const max = parseInt(maxStr, 10);
                            if (checkedCbs.length > max) {
                                cb.checked = false; // 撤销选择
                                return; // 终止更新
                            }
                        }

                        const newVals = Array.from(DOM.checkboxDefaultGroup.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
                        state.selectedElement.dataset.defaultValue = stringifyMultiValue(newVals);
                        renderDefaultValue(state.selectedElement);
                        renderOptions(state.selectedElement);
                    });
                    
                    label.appendChild(cb);
                    label.appendChild(document.createTextNode(opt.label || ' '));
                    DOM.checkboxDefaultGroup.appendChild(label);
                });
            }
        } else {
            // 单选类型（如下拉选择或单选框）使用 select 设置默认值
            if (DOM.checkboxDefaultGroup) DOM.checkboxDefaultGroup.style.display = 'none';
            if (DOM.selectDefault) {
                DOM.selectDefault.style.display = '';
                DOM.selectDefault.multiple = false;
                DOM.selectDefault.innerHTML = '<option value="">无默认值</option>';
                options.forEach(opt => {
                    const optEl = document.createElement('option');
                    optEl.value = opt.value;
                    optEl.textContent = opt.label || ' ';
                    DOM.selectDefault.appendChild(optEl);
                });
                DOM.selectDefault.value = el.dataset.defaultValue || '';
            }
        }
    } else {
        // 对于普通文本或日期类型的组件，显示普通的文本输入框用于设置默认值
        DOM.inputDefault.style.display = '';
        if (DOM.selectDefault) DOM.selectDefault.style.display = 'none';
        if (DOM.checkboxDefaultGroup) DOM.checkboxDefaultGroup.style.display = 'none';
        DOM.inputDefault.value = el.dataset.defaultValue || '';
    }
}

// 渲染选项编辑器列表（用于增加、删除、编辑每个选项的内容）
export function renderOptionsEditor() {
    // 只有带有选项的组件才需要渲染选项编辑器
    if (!state.selectedElement || !optionTypes.includes(state.selectedElement.dataset.type)) {
        DOM.optionsEditor.innerHTML = '';
        return;
    }

    const options = readOptions(state.selectedElement);
    DOM.optionsEditor.innerHTML = '';

    const isDisplayOnly = state.selectedElement.dataset.type === 'signature' || state.selectedElement.dataset.type === 'alert';

    DOM.optionsEditor.className = 'options-editor custom-scrollbar max-h-[300px] overflow-y-auto pr-1';

    options.forEach((option, index) => {
        const row = document.createElement('div');
        // 缩紧行间距与元素间距
        row.className = 'flex items-start gap-1.5 mb-2';
        
        // 输入区容器
        const inputContainer = document.createElement('div');
        inputContainer.className = 'relative flex-1 min-w-0 flex items-start gap-1.5';

        let labelInput;
        if (isDisplayOnly) {
            labelInput = document.createElement('textarea');
            labelInput.rows = 3;
            labelInput.className = 'ant-input resize-y w-full min-h-[64px] !text-[12px] !px-[10px] !py-[6px] !rounded-[6px] !leading-[20px] shadow-sm transition-shadow hover:shadow-md hover:shadow-slate-200/20';
            labelInput.placeholder = '请输入提示或声明内容...';
        } else {
            labelInput = document.createElement('input');
            labelInput.type = 'text';
            labelInput.className = 'ant-input w-full !min-h-[32px] !h-[32px] !text-[12px] !px-[10px] !py-[4px] !rounded-[6px] shadow-sm transition-shadow hover:shadow-md hover:shadow-slate-200/20';
            labelInput.placeholder = '选项名称';
        }
        labelInput.value = option.label || '';
        inputContainer.appendChild(labelInput);
        
        // Value 标识 (仅普通选项展示)
        let valueInput = null;
        if (!isDisplayOnly) {
            valueInput = document.createElement('input');
            valueInput.type = 'text';
            valueInput.value = option.value || '';
            valueInput.readOnly = true;
            valueInput.title = '选项底层提交值 (Value)';
            // 极简微标签
            valueInput.className = 'ant-input !h-[32px] !min-h-[32px] text-[10px] font-mono text-slate-400 bg-slate-50/50 border-slate-200/60 w-[60px] shrink-0 !px-[6px] !py-[4px] !rounded-[6px] text-center focus:!border-slate-200 focus:!shadow-none';
            inputContainer.appendChild(valueInput);
        }
        
        // 删除按钮 (常驻显示，但保持极其克制的颜色)
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.setAttribute('title', '删除');
        removeButton.className = 'mt-[4px] flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500';
        removeButton.innerHTML = '<i data-lucide="trash-2" class="h-[14px] w-[14px]"></i>';

        row.appendChild(inputContainer);
        row.appendChild(removeButton);

        removeButton.addEventListener('click', () => {
            const latestOptions = readOptions(state.selectedElement);
            latestOptions.splice(index, 1);
            writeOptions(state.selectedElement, latestOptions);
            renderOptions(state.selectedElement);
            renderOptionsEditor();
            updateDefaultValueUI(state.selectedElement);
            notifySchemaChange();
        });

        DOM.optionsEditor.appendChild(row);

        // 虚拟焦点映射
        let focusedTarget = null;
        labelInput.addEventListener('focus', () => {
            if (!state.selectedElement) return;
            const targets = state.selectedElement.querySelectorAll('.option-text, .signature-declaration-text');
            focusedTarget = targets[index];
            if (focusedTarget) focusedTarget.classList.add('canvas-text-focus');
        });
        labelInput.addEventListener('blur', () => {
            if (focusedTarget) focusedTarget.classList.remove('canvas-text-focus');
            focusedTarget = null;
        });

        // 监听选项标签变化并更新组件数据
        labelInput.addEventListener('input', e => {
            const latestOptions = readOptions(state.selectedElement);
            latestOptions[index] = { ...latestOptions[index], label: e.target.value };
            writeOptions(state.selectedElement, latestOptions);
            renderOptions(state.selectedElement);
            updateDefaultValueUI(state.selectedElement);
            notifySchemaChange();
        });
    });

    safeCreateIcons();
}

// 绑定属性面板内部各个输入控件的事件监听
export function bindPropEvents() {
    // 阻止表单默认提交行为
    DOM.propEditor.addEventListener('submit', e => {
        e.preventDefault();
    });

    // 虚拟焦点映射辅助函数：当右侧输入框聚焦时，高亮左侧画布中对应的元素
    const textFocusClass = 'canvas-text-focus';
    const inputFocusClass = 'canvas-control-focus';
    const isControlTarget = target => ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    const setMappedFocus = (target, isFocused) => {
        if (!target) return;
        target.classList.toggle(isControlTarget(target) ? inputFocusClass : textFocusClass, isFocused);
    };

    const bindVirtualFocus = (propInput, selector) => {
        let focusedTarget = null;

        propInput.addEventListener('focus', () => {
            if (!state.selectedElement) return;
            focusedTarget = state.selectedElement.querySelector(selector);
            setMappedFocus(focusedTarget, true);
        });
        propInput.addEventListener('blur', () => {
            setMappedFocus(focusedTarget, false);
            focusedTarget = null;
        });
    };

    bindVirtualFocus(DOM.inputLabel, '.label-text');
    bindVirtualFocus(DOM.inputPlaceholder, '.component-placeholder');
    bindVirtualFocus(DOM.inputHelp, '.field-help');
    bindVirtualFocus(DOM.inputDefault, '.component-placeholder');
    
    // 绑定页面属性相关事件
    const propPageTitle = document.getElementById('page-prop-title-input');
    const propPageDesc = document.getElementById('page-prop-desc-input');
    
    bindVirtualFocus(propPageTitle, '.page-title-input');
    bindVirtualFocus(propPageDesc, '.page-desc-input');
    
    propPageTitle.addEventListener('input', e => {
        if (!state.selectedElement || !state.selectedElement.classList.contains('mobile-frame')) return;
        const titleInput = state.selectedElement.querySelector('.page-title-input');
        if (titleInput) {
            titleInput.value = e.target.value;
            titleInput.dispatchEvent(new Event('input'));
        }
    });

    propPageDesc.addEventListener('input', e => {
        if (!state.selectedElement || !state.selectedElement.classList.contains('mobile-frame')) return;
        const descInput = state.selectedElement.querySelector('.page-desc-input');
        if (descInput) {
            descInput.value = e.target.value;
            descInput.dispatchEvent(new Event('input'));
        }
    });

    // 绑定标签输入事件
    DOM.inputLabel.addEventListener('input', e => {
        if (!state.selectedElement) return;
        state.selectedElement.dataset.label = e.target.value;
        setLabelText(state.selectedElement, e.target.value);
    });

    // 字段标识（Key）现在是只读的，所以不需要监听 input 事件

    // 绑定占位符输入事件
    DOM.inputPlaceholder.addEventListener('input', e => {
        if (!state.selectedElement) return;
        state.selectedElement.dataset.placeholder = e.target.value;
        const node = state.selectedElement.querySelector('.component-placeholder');
        if (node) node.setAttribute('placeholder', e.target.value);
        if (['select', 'country', 'nationality'].includes(state.selectedElement.dataset.type)) {
            renderOptions(state.selectedElement);
        }
    });

    // 绑定帮助说明文本输入事件
    DOM.inputHelp.addEventListener('input', e => {
        if (!state.selectedElement) return;
        state.selectedElement.dataset.help = e.target.value;
        renderHelpText(state.selectedElement);
    });

    // 绑定文本默认值输入事件
    DOM.inputDefault.addEventListener('input', e => {
        if (!state.selectedElement) return;
        state.selectedElement.dataset.defaultValue = e.target.value;
        renderDefaultValue(state.selectedElement);
        renderOptions(state.selectedElement);
    });

    // 绑定选择类型的默认值切换事件
    if (DOM.selectDefault) {
        DOM.selectDefault.addEventListener('change', e => {
            if (!state.selectedElement) return;
            if (state.selectedElement.dataset.type === 'checkbox') {
                const values = Array.from(e.target.selectedOptions).map(o => o.value).filter(v => v !== "");
                state.selectedElement.dataset.defaultValue = stringifyMultiValue(values);
            } else {
                state.selectedElement.dataset.defaultValue = e.target.value;
            }
            renderDefaultValue(state.selectedElement);
            renderOptions(state.selectedElement);
        });
    }

    // 绑定必填开关切换事件
    DOM.toggleRequired.addEventListener('change', e => {
        if (!state.selectedElement) return;
        state.selectedElement.dataset.required = String(e.target.checked);
        const reqStar = state.selectedElement.querySelector('.req-star');
        if (reqStar) reqStar.classList.toggle('hidden', !e.target.checked);
    });

    // 绑定排布方向（内联或堆叠）的选择事件
    DOM.propLayoutSelect.addEventListener('change', e => {
        if (!state.selectedElement) return;
        state.selectedElement.dataset.layout = e.target.value;
        renderOptions(state.selectedElement);
    });

    // 绑定最大选择数量的输入事件 (Stepper Logic)
    if (DOM.inputMaxSelections) {
        DOM.inputMaxSelections.addEventListener('change', e => {
            let val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val > 5) val = 5;
            syncMaxSelectionsUI(val);
        });

        if (DOM.btnMaxMinus) {
            DOM.btnMaxMinus.addEventListener('click', () => {
                const current = parseInt(DOM.inputMaxSelections.value, 10) || 3;
                syncMaxSelectionsUI(current - 1);
            });
        }

        if (DOM.btnMaxPlus) {
            DOM.btnMaxPlus.addEventListener('click', () => {
                const current = parseInt(DOM.inputMaxSelections.value, 10) || 3;
                syncMaxSelectionsUI(current + 1);
            });
        }
    }

    // 绑定日期具体类型（如日期、年月）的切换事件
    DOM.propDateTypeSelect.addEventListener('change', e => {
        if (!state.selectedElement || state.selectedElement.dataset.type !== 'date') return;
        state.selectedElement.dataset.dateType = e.target.value;
        const input = state.selectedElement.querySelector('.component-placeholder');
        if (input) {
            input.type = e.target.value;
        }
    });

    // 绑定添加新选项按钮的点击事件
    DOM.addOptionBtn.addEventListener('click', () => {
        if (!state.selectedElement) return;
        const options = readOptions(state.selectedElement);
        
        const isAlert = state.selectedElement.dataset.type === 'alert';
        const isSignature = state.selectedElement.dataset.type === 'signature';
        const prefix = isAlert ? 'tip_' : (isSignature ? 'dec_' : 'option_');
        const labelPrefix = isAlert ? '提示' : (isSignature ? '声明' : '选项');
        
        // 查找当前最大的后缀序号（实现自增ID效果）
        let maxIndex = 0;
        options.forEach(o => {
            if (o.value && o.value.startsWith(prefix)) {
                const num = parseInt(o.value.slice(prefix.length), 10);
                if (!isNaN(num) && num > maxIndex) {
                    maxIndex = num;
                }
            }
        });
        
        // 生成下一个序号，并确保绝对不重复
        let nextIndex = Math.max(maxIndex + 1, options.length + 1);
        const existingValues = new Set(options.map(o => o.value));
        while(existingValues.has(`${prefix}${nextIndex}`)) {
            nextIndex++;
        }

        options.push({ label: `${labelPrefix}${nextIndex}`, value: `${prefix}${nextIndex}` });
        writeOptions(state.selectedElement, options);
        renderOptions(state.selectedElement);
        renderOptionsEditor();
        updateDefaultValueUI(state.selectedElement);
        notifySchemaChange();
    });
}
