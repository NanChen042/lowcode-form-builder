import { state } from '../core/state.js';
import { optionTypes } from '../components/registry.js';
import { readOptions, writeOptions, safeCreateIcons } from '../utils/helpers.js';
import { renderDefaultValue, renderOptions } from '../components/builder.js';
import { setLabelText, renderHelpText } from '../components/builder.js';
import * as DOM from './dom.js';

// 根据选中的组件数据更新右侧面板中的默认值设置界面
export function updateDefaultValueUI(el) {
    if (!el) return;
    const type = el.dataset.type;
    const isOptions = optionTypes.includes(type);
    
    // 如果是带选项的组件
    if (isOptions) {
        DOM.inputDefault.style.display = 'none'; // 隐藏普通的文本输入框
        
        const options = readOptions(el);
        const values = (el.dataset.defaultValue || '').split(',').filter(v => v);

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
                        state.selectedElement.dataset.defaultValue = newVals.join(',');
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

    const isSignature = state.selectedElement.dataset.type === 'signature';

    options.forEach((option, index) => {
        const row = document.createElement('div');
        row.className = 'option-row';
        if (isSignature) {
            row.style.gridTemplateColumns = 'minmax(0, 1fr) 32px';
            row.style.alignItems = 'flex-start';
        }

        let labelInput;
        // 签名组件使用文本域作为选项名称输入，以容纳较长的声明内容
        if (isSignature) {
            labelInput = document.createElement('textarea');
            labelInput.rows = 2;
            labelInput.className = 'ant-input text-xs resize-y';
            labelInput.style.minHeight = '48px';
            labelInput.placeholder = '请输入声明条款内容...';
        } else {
            labelInput = document.createElement('input');
            labelInput.type = 'text';
            labelInput.className = 'ant-input text-xs';
            labelInput.placeholder = 'Label';
        }
        labelInput.value = option.label || '';
        
        // 虚拟焦点映射：当选中右侧输入框时，高亮左边对应的选项文本
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

        // 选项值输入框
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.value = option.value || '';
        valueInput.placeholder = 'Value';
        valueInput.className = 'ant-input text-xs';
        // 签名组件不需要独立的 value 输入框，因为其 value 在内部自动生成或隐藏
        if (isSignature) {
            valueInput.style.display = 'none';
        }

        // 删除选项的按钮
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'icon-btn';
        if (isSignature) {
            removeButton.style.marginTop = '6px';
        }
        removeButton.innerHTML = '<i data-lucide="x" class="h-3.5 w-3.5"></i>';
        removeButton.setAttribute('aria-label', '删除选项');

        // 监听选项标签变化并更新组件数据
        labelInput.addEventListener('input', e => {
            const latestOptions = readOptions(state.selectedElement);
            latestOptions[index] = { ...latestOptions[index], label: e.target.value };
            writeOptions(state.selectedElement, latestOptions);
            renderOptions(state.selectedElement);
            updateDefaultValueUI(state.selectedElement);
        });

        // 监听选项值变化并更新组件数据
        valueInput.addEventListener('input', e => {
            const latestOptions = readOptions(state.selectedElement);
            latestOptions[index] = { ...latestOptions[index], value: e.target.value };
            writeOptions(state.selectedElement, latestOptions);
            renderOptions(state.selectedElement);
            updateDefaultValueUI(state.selectedElement);
        });

        // 处理选项的删除操作
        removeButton.addEventListener('click', () => {
            const latestOptions = readOptions(state.selectedElement);
            latestOptions.splice(index, 1);
            writeOptions(state.selectedElement, latestOptions);
            renderOptions(state.selectedElement);
            renderOptionsEditor();
            updateDefaultValueUI(state.selectedElement);
        });

        row.appendChild(labelInput);
        row.appendChild(valueInput);
        row.appendChild(removeButton);
        DOM.optionsEditor.appendChild(row);
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

    // 绑定标签输入事件
    DOM.inputLabel.addEventListener('input', e => {
        if (!state.selectedElement) return;
        state.selectedElement.dataset.label = e.target.value;
        setLabelText(state.selectedElement, e.target.value);
    });

    // 绑定字段标识（Key）输入事件
    DOM.inputKey.addEventListener('input', e => {
        if (state.selectedElement) state.selectedElement.dataset.key = e.target.value;
    });

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
                state.selectedElement.dataset.defaultValue = values.join(',');
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

    // 绑定最大选择数量的输入事件
    if (DOM.inputMaxSelections) {
        DOM.inputMaxSelections.addEventListener('input', e => {
            if (state.selectedElement) state.selectedElement.dataset.maxSelections = e.target.value;
        });
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
        const nextIndex = options.length + 1;
        const isSignature = state.selectedElement.dataset.type === 'signature';
        const prefix = isSignature ? 'dec_' : 'option_';
        const labelPrefix = isSignature ? '声明' : '选项';
        options.push({ label: `${labelPrefix}${nextIndex}`, value: `${prefix}${nextIndex}` });
        writeOptions(state.selectedElement, options);
        renderOptions(state.selectedElement);
        renderOptionsEditor();
        updateDefaultValueUI(state.selectedElement);
    });
}
