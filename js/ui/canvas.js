import { state, setSelectedElement } from '../core/state.js';
import { safeCreateIcons, writeOptions, readOptions } from '../utils/helpers.js';
import { optionTypes, valueTypes } from '../components/registry.js';
import * as DOM from './dom.js';
import { updateDefaultValueUI, renderOptionsEditor, syncMaxSelectionsUI } from './properties.js';

const PAGE_WIDTH = 390;
const PAGE_GAP = 160;

// 检查并更新表单页面内是否为空的状态显示（显示或隐藏占位提示）
export function checkEmptyState() {
    state.pages.forEach(page => {
        const pageDropzone = document.getElementById(page.id);
        if (!pageDropzone) return;
        const elements = pageDropzone.querySelectorAll(':scope > .canvas-element');
        const hasElements = elements.length > 0;
        const emptyState = pageDropzone.querySelector('.canvas-empty-state');
        if (emptyState) emptyState.style.display = hasElements ? 'none' : 'flex';
        pageDropzone.classList.toggle('has-elements', hasElements);
    });
}

// 检查并更新嵌套容器（如双列布局）内的空状态显示
export function refreshNestedEmptyStates() {
    document.querySelectorAll('.nested-dropzone').forEach(zone => {
        const hasElements = Boolean(zone.querySelector(':scope > .canvas-element'));
        const hint = zone.querySelector(':scope > .empty-hint');
        if (hint) hint.style.display = hasElements ? 'none' : 'flex';
    });
}

// 绘制多个页面面板之间的连接连线（贝塞尔曲线）
export function drawConnections() {
    const canvasConnections = document.getElementById('canvas-connections');
    if (!canvasConnections) return;
    canvasConnections.innerHTML = '';
    
    for (let i = 0; i < state.pages.length - 1; i++) {
        const p1 = state.pages[i];
        const p2 = state.pages[i+1];
        
        const startX = p1.x + PAGE_WIDTH;
        const startY = p1.y + 360; 
        
        const endX = p2.x;
        const endY = p2.y + 360;
        
        const controlX1 = startX + PAGE_GAP / 2;
        const controlX2 = endX - PAGE_GAP / 2;
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`);
        path.setAttribute('class', 'canvas-connection-path');
        canvasConnections.appendChild(path);
    }
}

// 移动画布视角，聚焦并平滑过渡到指定的页面面板位置
export function focusOnPage(pageId, autoFit = false) {
    const page = state.pages.find(p => p.id === pageId);
    if (!page) return;
    
    const viewportWidth = DOM.canvasScrollArea.clientWidth;
    const viewportHeight = DOM.canvasScrollArea.clientHeight;
    
    const frameHeight = document.getElementById(`frame_${pageId}`)?.clientHeight || 720;
    
    let targetScale = state.canvasState.scale;
    if (autoFit) {
        const scaleX = (viewportWidth - 120) / PAGE_WIDTH;
        const scaleY = (viewportHeight - 120) / frameHeight;
        targetScale = Math.min(1.6, Math.max(0.1, Math.min(scaleX, scaleY)));
    } else if (state.isFirstFocus) {
        targetScale = 1;
        state.isFirstFocus = false;
    }
    
    const targetX = (viewportWidth / 2) - ((page.x + PAGE_WIDTH / 2) * targetScale);
    const targetY = (viewportHeight / 2) - ((page.y + frameHeight / 2) * targetScale);
    
    const duration = 400;
    const startX = state.canvasState.x;
    const startY = state.canvasState.y;
    const startScale = state.canvasState.scale;
    const startTime = performance.now();
    
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = easeOutCubic(progress);
        
        state.canvasState.x = startX + (targetX - startX) * ease;
        state.canvasState.y = startY + (targetY - startY) * ease;
        state.canvasState.scale = startScale + (targetScale - startScale) * ease;
        
        renderCanvasTransform();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    requestAnimationFrame(animate);
}

// 向画布中添加一个新的页面（Frame），并在指定页面之后进行定位
export function addPage(afterPageId = null) {
    const isFirst = state.pages.length === 0;
    const newId = `page_${Date.now()}`;
    
    let insertIndex = state.pages.length;
    let x = 0;
    let y = 0;
    
    if (!isFirst) {
        if (afterPageId) {
            const foundIndex = state.pages.findIndex(p => p.id === afterPageId);
            if (foundIndex !== -1) insertIndex = foundIndex + 1;
        }
        
        const prevPage = state.pages[insertIndex - 1];
        if (prevPage) {
            x = prevPage.x + PAGE_WIDTH + PAGE_GAP;
            y = prevPage.y;
        }
    }
    
    const newPage = { id: newId, title: `第 ${state.pages.length + 1} 页`, x, y };
    state.pages.splice(insertIndex, 0, newPage);
    
    const template = document.getElementById('tpl-page-frame');
    const clone = template.content.cloneNode(true);
    const frame = clone.querySelector('.mobile-frame');
    
    frame.id = `frame_${newId}`;
    frame.style.transform = `translate(${x}px, ${y}px)`;
    
    const dropzoneNode = frame.querySelector('.canvas-dropzone');
    dropzoneNode.id = newId;
    dropzoneNode.dataset.pageId = newId;
    
    const titleInput = frame.querySelector('.page-title-input');
    titleInput.value = newPage.title;
    titleInput.addEventListener('input', e => {
        newPage.title = e.target.value;
    });
    
    const deleteBtn = frame.querySelector('.page-delete-btn');
    if (!isFirst) {
        deleteBtn.classList.replace('hidden', 'flex');
        deleteBtn.addEventListener('click', () => deletePage(newId));
    }
    
    const addNextBtn = frame.querySelector('.add-next-page-btn');
    addNextBtn.addEventListener('click', () => addPage(newId));
    
    // 绑定点击画布背景选中画布事件
    frame.addEventListener('click', (e) => {
        // 如果点击的是内部的组件或按钮，则不触发画布选中
        if (e.target.closest('.canvas-element') || e.target.closest('.icon-btn') || e.target.closest('.add-next-page-btn') || e.target.closest('.page-delete-btn')) {
            return;
        }
        selectElement(frame);
    });
    
    if (insertIndex >= state.pages.length - 1) {
        DOM.canvasWorld.appendChild(clone);
    } else {
        const nextFrameId = state.pages[insertIndex + 1].id;
        const nextFrame = document.getElementById(`frame_${nextFrameId}`);
        if (nextFrame) {
            DOM.canvasWorld.insertBefore(clone, nextFrame);
        } else {
            DOM.canvasWorld.appendChild(clone);
        }
        
        // 重新排列后续页面的位置
        for (let i = insertIndex + 1; i < state.pages.length; i++) {
            state.pages[i].x = state.pages[i-1].x + PAGE_WIDTH + PAGE_GAP;
            const currentFrame = document.getElementById(`frame_${state.pages[i].id}`);
            if (currentFrame) currentFrame.style.transform = `translate(${state.pages[i].x}px, ${state.pages[i].y}px)`;
        }
    }
    
    initDropzone(dropzoneNode);
    safeCreateIcons();
    drawConnections();
    updatePageSequenceBadges();
    
    if (!isFirst) {
        focusOnPage(newId);
    } else {
        state.canvasState.x = (DOM.canvasScrollArea.clientWidth / 2) - (PAGE_WIDTH / 2);
        state.canvasState.y = 100;
        renderCanvasTransform();
    }
}

// 从画布和状态中删除指定页面，并重新排列后续页面的位置
export function deletePage(pageId) {
    if (state.pages.length <= 1) return;
    const index = state.pages.findIndex(p => p.id === pageId);
    state.pages.splice(index, 1);
    
    const frame = document.getElementById(`frame_${pageId}`);
    if (frame) frame.remove();
    
    for (let i = 1; i < state.pages.length; i++) {
        state.pages[i].x = state.pages[i-1].x + PAGE_WIDTH + PAGE_GAP;
        const currentFrame = document.getElementById(`frame_${state.pages[i].id}`);
        if (currentFrame) currentFrame.style.transform = `translate(${state.pages[i].x}px, ${state.pages[i].y}px)`;
    }
    
    drawConnections();
    updatePageSequenceBadges();
    focusOnPage(state.pages[Math.max(0, index - 1)].id);
}

// 更新所有画布左上角的序号角标
export function updatePageSequenceBadges() {
    state.pages.forEach((p, index) => {
        const frame = document.getElementById(`frame_${p.id}`);
        if (frame) {
            const badge = frame.querySelector('.page-sequence-badge');
            if (badge) {
                badge.textContent = index + 1;
            }
        }
    });
}

// 初始化表单页面，清空现有页面并添加第一页
export function initPages() {
    state.pages.length = 0; // Empty the array
    document.querySelectorAll('.mobile-frame').forEach(el => el.remove());
    state.isFirstFocus = true;
    addPage();
}

// 绘制画布上方和左侧的标尺刻度及数值
export function drawRulers() {
    const rulerTopCanvas = document.getElementById('ruler-top');
    const rulerLeftCanvas = document.getElementById('ruler-left');
    if (!rulerTopCanvas || !rulerLeftCanvas) return;

    const dpr = window.devicePixelRatio || 1;
    const topRect = rulerTopCanvas.getBoundingClientRect();
    const leftRect = rulerLeftCanvas.getBoundingClientRect();

    const topWidth = topRect.width;
    const topHeight = topRect.height;
    const leftWidth = leftRect.width;
    const leftHeight = leftRect.height;

    if (rulerTopCanvas.width !== Math.round(topWidth * dpr) || rulerTopCanvas.height !== Math.round(topHeight * dpr)) {
        rulerTopCanvas.width = Math.round(topWidth * dpr);
        rulerTopCanvas.height = Math.round(topHeight * dpr);
    }
    if (rulerLeftCanvas.width !== Math.round(leftWidth * dpr) || rulerLeftCanvas.height !== Math.round(leftHeight * dpr)) {
        rulerLeftCanvas.width = Math.round(leftWidth * dpr);
        rulerLeftCanvas.height = Math.round(leftHeight * dpr);
    }

    const ctxTop = rulerTopCanvas.getContext('2d');
    const ctxLeft = rulerLeftCanvas.getContext('2d');

    ctxTop.setTransform(1, 0, 0, 1, 0, 0);
    ctxTop.scale(dpr, dpr);
    ctxLeft.setTransform(1, 0, 0, 1, 0, 0);
    ctxLeft.scale(dpr, dpr);

    ctxTop.clearRect(0, 0, topWidth, topHeight);
    ctxLeft.clearRect(0, 0, leftWidth, leftHeight);

    ctxTop.fillStyle = '#f8fafc';
    ctxTop.fillRect(0, 0, topWidth, topHeight);
    ctxLeft.fillStyle = '#f8fafc';
    ctxLeft.fillRect(0, 0, leftWidth, leftHeight);

    const scale = state.canvasState.scale;
    const originX = state.canvasState.x - 20;

    const steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    let step = 100;
    for (let s of steps) {
        if (s * scale >= 60) {
            step = s;
            break;
        }
    }

    let subSteps = 10;
    if (step === 20 || step === 200 || step === 2000) {
        subSteps = 4;
    } else if (step === 25 || step === 50 || step === 500) {
        subSteps = 5;
    }
    const subStepVal = step / subSteps;

    ctxTop.strokeStyle = 'rgba(100, 116, 139, 0.25)';
    ctxTop.lineWidth = 1;
    ctxTop.fillStyle = '#94a3b8';
    ctxTop.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    ctxTop.textBaseline = 'top';
    ctxTop.textAlign = 'center';

    const startValX = Math.floor(-originX / (step * scale)) * step;
    const endValX = Math.ceil((topWidth - originX) / (step * scale)) * step;

    for (let val = startValX; val <= endValX; val += step) {
        const x = originX + val * scale;
        if (x >= 0 && x <= topWidth) {
            ctxTop.beginPath();
            ctxTop.moveTo(x, topHeight - 8);
            ctxTop.lineTo(x, topHeight);
            ctxTop.strokeStyle = 'rgba(148, 163, 184, 0.5)';
            ctxTop.stroke();

            ctxTop.fillText(String(val), x, 2);
        }

        for (let i = 1; i < subSteps; i++) {
            const subVal = val + i * subStepVal;
            const subX = originX + subVal * scale;
            if (subX >= 0 && subX <= topWidth) {
                const isHalf = i === Math.floor(subSteps / 2);
                const tickH = isHalf ? 5 : 3;
                ctxTop.beginPath();
                ctxTop.moveTo(subX, topHeight - tickH);
                ctxTop.lineTo(subX, topHeight);
                ctxTop.strokeStyle = 'rgba(100, 116, 139, 0.25)';
                ctxTop.stroke();
            }
        }
    }

    const originY = state.canvasState.y - 20;
    const startValY = Math.floor(-originY / (step * scale)) * step;
    const endValY = Math.ceil((leftHeight - originY) / (step * scale)) * step;

    ctxLeft.strokeStyle = 'rgba(100, 116, 139, 0.25)';
    ctxLeft.lineWidth = 1;
    ctxLeft.fillStyle = '#94a3b8';
    ctxLeft.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

    for (let val = startValY; val <= endValY; val += step) {
        const y = originY + val * scale;
        if (y >= 0 && y <= leftHeight) {
            ctxLeft.beginPath();
            ctxLeft.moveTo(leftWidth - 8, y);
            ctxLeft.lineTo(leftWidth, y);
            ctxLeft.strokeStyle = 'rgba(148, 163, 184, 0.5)';
            ctxLeft.stroke();

            ctxLeft.save();
            ctxLeft.translate(6, y);
            ctxLeft.rotate(-Math.PI / 2);
            ctxLeft.textAlign = 'center';
            ctxLeft.textBaseline = 'middle';
            ctxLeft.fillText(String(val), 0, 0);
            ctxLeft.restore();
        }

        for (let i = 1; i < subSteps; i++) {
            const subVal = val + i * subStepVal;
            const subY = originY + subVal * scale;
            if (subY >= 0 && subY <= leftHeight) {
                const isHalf = i === Math.floor(subSteps / 2);
                const tickW = isHalf ? 5 : 3;
                ctxLeft.beginPath();
                ctxLeft.moveTo(leftWidth - tickW, subY);
                ctxLeft.lineTo(leftWidth, subY);
                ctxLeft.strokeStyle = 'rgba(100, 116, 139, 0.25)';
                ctxLeft.stroke();
            }
        }
    }
}

// 将画布当前的坐标和缩放状态应用到 DOM 元素，并重新绘制标尺
export function renderCanvasTransform() {
    DOM.canvasScrollArea.style.setProperty('--canvas-x', `${Math.round(state.canvasState.x)}px`);
    DOM.canvasScrollArea.style.setProperty('--canvas-y', `${Math.round(state.canvasState.y)}px`);
    DOM.canvasScrollArea.style.setProperty('--canvas-scale', state.canvasState.scale.toFixed(3));
    
    const zoomText = document.getElementById('zoom-percent-text');
    if (zoomText) {
        zoomText.textContent = `${Math.round(state.canvasState.scale * 100)}%`;
    }
    
    drawRulers();
}

// 重置画布的视角和缩放比例到默认状态
export function resetCanvasView() {
    const rect = DOM.canvasScrollArea.getBoundingClientRect();
    state.canvasState.scale = 1.0;
    state.canvasState.x = Math.round((rect.width - 390) / 2);
    state.canvasState.y = Math.round((rect.height - 720) / 2);
    if (state.canvasState.y < 40) state.canvasState.y = 40;
    renderCanvasTransform();
}

// 调整画布的缩放比例（放大或缩小），以当前画布中心为基准缩放
export function adjustZoom(delta) {
    const oldScale = state.canvasState.scale;
    const nextScale = Math.min(1.6, Math.max(0.1, oldScale + delta));
    if (nextScale === oldScale) return;

    const rect = DOM.canvasScrollArea.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const worldX = (centerX - state.canvasState.x) / oldScale;
    const worldY = (centerY - state.canvasState.y) / oldScale;

    state.canvasState.scale = nextScale;
    state.canvasState.x = centerX - worldX * nextScale;
    state.canvasState.y = centerY - worldY * nextScale;
    renderCanvasTransform();
}

// 选中画布中的某个组件，并在右侧属性面板中展示该组件的各项属性
export function selectElement(el) {
    if (state.selectedElement) {
        state.selectedElement.classList.remove('is-selected');
    }
    setSelectedElement(el);
    state.selectedElement.classList.add('is-selected');

    const type = el.dataset.type || 'field';
    const hasPlaceholder = Boolean(el.querySelector('.component-placeholder')) || type === 'select' || type === 'signature';
    const hasOptions = optionTypes.includes(type);
    const hasDefaultValue = valueTypes.includes(type) || hasOptions;
    const canStackChoices = type === 'radio' || type === 'checkbox';

    DOM.propEmpty.classList.add('hidden');
    
    if (el.classList.contains('mobile-frame')) {
        DOM.propEditor.classList.add('hidden');
        document.getElementById('page-prop-editor').classList.remove('hidden');
        DOM.propIdText.textContent = el.querySelector('.canvas-dropzone').id || 'page';
        
        const titleInput = el.querySelector('.page-title-input');
        const descInput = el.querySelector('.page-desc-input');
        const propTitle = document.getElementById('page-prop-title-input');
        const propDesc = document.getElementById('page-prop-desc-input');
        
        propTitle.value = titleInput.value;
        propDesc.value = descInput.value;
        
        const toggleFocus = (element, isFocused) => {
            element.classList.toggle('canvas-control-focus', isFocused);
        };

        // Remove old event listeners
        const newPropTitle = propTitle.cloneNode(true);
        propTitle.parentNode.replaceChild(newPropTitle, propTitle);
        newPropTitle.addEventListener('input', (e) => {
            titleInput.value = e.target.value;
            titleInput.dispatchEvent(new Event('input'));
        });
        newPropTitle.addEventListener('focus', () => toggleFocus(titleInput, true));
        newPropTitle.addEventListener('blur', () => toggleFocus(titleInput, false));

        const newPropDesc = propDesc.cloneNode(true);
        propDesc.parentNode.replaceChild(newPropDesc, propDesc);
        newPropDesc.addEventListener('input', (e) => {
            descInput.value = e.target.value;
            descInput.dispatchEvent(new Event('input'));
        });
        newPropDesc.addEventListener('focus', () => toggleFocus(descInput, true));
        newPropDesc.addEventListener('blur', () => toggleFocus(descInput, false));
        
        return;
    }
    
    document.getElementById('page-prop-editor').classList.add('hidden');
    DOM.propEditor.classList.remove('hidden');
    DOM.propIdText.textContent = el.id;
    DOM.propTypeBadge.textContent = type;
    DOM.inputLabel.value = el.dataset.label || '';
    DOM.inputKey.value = el.dataset.key || '';
    DOM.inputHelp.value = el.dataset.help || '';
    updateDefaultValueUI(el);
    DOM.inputPlaceholder.value = el.dataset.placeholder || '';

    DOM.propPlaceholderGroup.style.display = hasPlaceholder ? 'block' : 'none';
    DOM.propDateTypeGroup.style.display = type === 'date' ? 'block' : 'none';
    if (type === 'date') {
        DOM.propDateTypeSelect.value = el.dataset.dateType || 'date';
    }
    DOM.propHelpGroup.style.display = type === 'grid' ? 'none' : 'block';
    DOM.propDefaultGroup.style.display = hasDefaultValue ? 'block' : 'none';
    const isFixedOptions = type === 'country' || type === 'nationality';
    DOM.propOptionsGroup.classList.toggle('hidden', !hasOptions || isFixedOptions);
    DOM.propLayoutGroup.style.display = canStackChoices ? 'block' : 'none';
    DOM.propLayoutSelect.value = el.dataset.layout || 'inline';
    DOM.toggleRequired.checked = el.dataset.required === 'true';
    
    const canHaveMaxSelections = type === 'country' || type === 'nationality' || type === 'checkbox';
    if (DOM.propMaxSelectionsGroup) {
        DOM.propMaxSelectionsGroup.style.display = canHaveMaxSelections ? 'block' : 'none';
    }
    if (DOM.inputMaxSelections) {
        syncMaxSelectionsUI(el.dataset.maxSelections || '');
    }
    
    renderOptionsEditor();
}

// 清除当前选中的组件状态，隐藏属性面板
export function clearSelection() {
    if (state.selectedElement) {
        state.selectedElement.classList.remove('is-selected');
        setSelectedElement(null);
    }
    DOM.propEmpty.classList.remove('hidden');
    DOM.propEditor.classList.add('hidden');
    document.getElementById('page-prop-editor').classList.add('hidden');
    DOM.propIdText.textContent = 'None';
}

// 删除指定的画布组件
export function deleteElement(event, el) {
    event.stopPropagation();
    if (state.selectedElement === el) clearSelection();
    el.remove();
    checkEmptyState();
    refreshNestedEmptyStates();
}

window.deleteElement = deleteElement;

// 复制指定的组件并在其后插入新的一份拷贝
window.duplicateElement = function(event, el) {
    event.stopPropagation();
    const clone = el.cloneNode(true);
    
    const newId = `field_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    clone.id = newId;
    clone.dataset.key = newId;
    
    const nested = clone.querySelectorAll('.canvas-element');
    nested.forEach(item => {
        const innerNewId = `field_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        item.id = innerNewId;
        item.dataset.key = innerNewId;
    });

    el.parentNode.insertBefore(clone, el.nextSibling);
    
    const nestedDropzones = clone.querySelectorAll('.nested-dropzone');
    nestedDropzones.forEach(dz => {
        initDropzone(dz);
    });

    safeCreateIcons();
    selectElement(clone);
    checkEmptyState();
    refreshNestedEmptyStates();
}

// Ensure initDropzone uses the builder functions but builder uses initDropzone
// We will need to dynamic import or ensure no circular dep issues.
// But we can import setupElementData from builder.js since it's used.
import { setupElementData } from '../components/builder.js';
import { getUniqueId } from '../core/state.js';

// 初始化一个可拖放的区域（例如页面本身或者嵌套的栅格列），绑定 Sortable 拖拽排序实例
export function initDropzone(containerEl) {
    new Sortable(containerEl, {
        group: 'shared',
        animation: 150,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        chosenClass: 'drag-chosen',
        fallbackClass: 'drag-fallback',
        forceFallback: true,
        fallbackOnBody: true,
        fallbackTolerance: 4,
        swapThreshold: 0.65,
        emptyInsertThreshold: 28,
        draggable: '.canvas-element, .component-item',
        filter: 'input, textarea, select, button',
        preventOnFilter: false,
        onStart: function() {
            document.body.classList.add('is-dragging-component');
        },
        onAdd: function(evt) {
            const itemEl = evt.item;

            if (!itemEl.classList.contains('component-item')) {
                checkEmptyState();
                refreshNestedEmptyStates();
                return;
            }

            const type = itemEl.getAttribute('data-type');
            const template = document.getElementById(`tpl-${type}`);
            if (!template) return;

            const tempDiv = document.createElement('div');
            tempDiv.appendChild(template.content.cloneNode(true));
            const rootDiv = tempDiv.querySelector('.canvas-element');

            itemEl.innerHTML = rootDiv.innerHTML;
            itemEl.className = rootDiv.className;
            itemEl.removeAttribute('role');
            itemEl.removeAttribute('tabindex');
            itemEl.id = `cmp_${getUniqueId()}`;
            
            setupElementData(itemEl, type);

            safeCreateIcons();

            if (type === 'grid') {
                itemEl.querySelectorAll('.nested-dropzone').forEach(zone => initDropzone(zone));
            }

            checkEmptyState();
            refreshNestedEmptyStates();
            setTimeout(() => {
                selectElement(itemEl);
            }, 20);
        },
        onRemove: function() {
            checkEmptyState();
            refreshNestedEmptyStates();
        },
        onSort: function() {
            refreshNestedEmptyStates();
        },
        onEnd: function() {
            document.body.classList.remove('is-dragging-component');
            checkEmptyState();
            refreshNestedEmptyStates();
        }
    });
}

// 绑定画布上的全局事件（如拖拽、缩放、点击编辑、快捷键等）
export function bindCanvasEvents() {
    window.addEventListener('resize', () => {
        drawRulers();
    });

    document.getElementById('zoom-out-btn').addEventListener('click', () => {
        adjustZoom(-0.1);
    });
    document.getElementById('zoom-in-btn').addEventListener('click', () => {
        adjustZoom(0.1);
    });
    document.getElementById('zoom-reset-btn').addEventListener('click', () => {
        state.canvasState.scale = 1;
        state.canvasState.x = 320;
        state.canvasState.y = 160;
        renderCanvasTransform();
    });

    DOM.canvasWorld.addEventListener('dblclick', e => {
        const frame = e.target.closest('.mobile-frame');
        if (frame && !e.target.closest('.canvas-element, .option-text, .label-text, input, textarea, select')) {
            const pageId = frame.id.replace('frame_', '');
            focusOnPage(pageId, true);
            e.preventDefault();
            return;
        }
    });

    DOM.canvasWorld.addEventListener('drop', e => {
        if (e.target.closest('[contenteditable="true"]')) {
            e.preventDefault();
        }
    });

    DOM.canvasWorld.addEventListener('input', e => {
        const textNode = e.target.closest('.label-text, .option-text');
        if (textNode) {
            const canvasElement = textNode.closest('.canvas-element');
            if (!canvasElement) return;
            
            const newText = textNode.textContent.trim();

            if (textNode.classList.contains('label-text')) {
                canvasElement.dataset.label = newText;
                if (state.selectedElement === canvasElement) {
                    DOM.inputLabel.value = newText;
                }
            } else if (textNode.classList.contains('option-text')) {
                const index = parseInt(textNode.dataset.index, 10);
                const options = readOptions(canvasElement);
                if (options[index]) {
                    options[index].label = newText;
                    writeOptions(canvasElement, options);
                    if (state.selectedElement === canvasElement) {
                        renderOptionsEditor();
                    }
                }
            }
        }
    });

    DOM.canvasWorld.addEventListener('keydown', e => {
        // inline editing state is managed locally in builder.js now
    });

    DOM.canvasWorld.addEventListener('focusout', e => {
        // inline editing state is managed locally in builder.js now
    });

    DOM.canvasWorld.addEventListener('input', e => {
        const canvasElement = e.target.closest('.canvas-element');
        if (!canvasElement) return;

        const type = canvasElement.dataset.type;
        if (['input', 'textarea', 'date', 'select'].includes(type)) {
            canvasElement.dataset.defaultValue = e.target.value;
            if (state.selectedElement === canvasElement) {
                DOM.inputDefault.value = e.target.value;
            }
        }
    });

    DOM.canvasWorld.addEventListener('change', e => {
        const canvasElement = e.target.closest('.canvas-element');
        if (!canvasElement) return;

        const type = canvasElement.dataset.type;
        if (type === 'radio' || type === 'checkbox') {
            if (type === 'radio') {
                canvasElement.dataset.defaultValue = e.target.value;
            } else {
                const checkedInputs = Array.from(canvasElement.querySelectorAll('input[type="checkbox"]:checked'));
                canvasElement.dataset.defaultValue = checkedInputs.map(i => i.value).join(',');
            }
            if (state.selectedElement === canvasElement) {
                DOM.inputDefault.value = canvasElement.dataset.defaultValue;
            }
        }
    });

    // Panning & Dragging Events
    window.addEventListener('keydown', e => {
        if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
            if (!state.isSpacePressed) {
                state.isSpacePressed = true;
                document.body.classList.add('space-panning-ready');
            }
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', e => {
        if (e.code === 'Space') {
            state.isSpacePressed = false;
            document.body.classList.remove('space-panning-ready');
        }
    });

    DOM.canvasScrollArea.addEventListener('mousedown', e => {
        if (e.target.closest('.ruler')) return;
        
        const isSpaceDrag = state.isSpacePressed;
        const isMiddleDrag = e.button === 1;
        const isBackgroundDrag = e.button === 0 && (
            e.target === DOM.canvasScrollArea || 
            e.target === DOM.canvasWorld ||
            e.target.id === 'canvas-connections'
        );
        
        const isFrameDrag = !isSpaceDrag && !isMiddleDrag && e.button === 0 && 
                            e.target.closest('.mobile-frame') && 
                            !e.target.closest('input, textarea, select, button, .canvas-element, .element-actions');

        if (isSpaceDrag || isMiddleDrag || isBackgroundDrag) {
            if (document.activeElement && document.activeElement.hasAttribute('contenteditable')) {
                document.activeElement.blur();
            }
            e.preventDefault();
            state.isPanning = true;
            state.panStartX = e.clientX;
            state.panStartY = e.clientY;
            state.panStartCanvasX = state.canvasState.x;
            state.panStartCanvasY = state.canvasState.y;
            document.body.classList.add('is-panning');
            
            // Only clear selection if it's a genuine background click without Space key
            if (e.button === 0 && !isSpaceDrag && !isMiddleDrag) {
                clearSelection();
                document.querySelectorAll('.mobile-frame').forEach(f => {
                    f.classList.remove('ring-2', 'ring-[#1677ff]', 'ring-offset-4', 'ring-offset-[#f5f5f5]');
                });
            }
        } else if (isFrameDrag) {
            if (document.activeElement && document.activeElement.hasAttribute('contenteditable')) {
                document.activeElement.blur();
            }
            e.preventDefault();
            const frame = e.target.closest('.mobile-frame');
            state.isDraggingFrame = true;
            state.draggedFrameId = frame.id.replace('frame_', '');
            
            document.querySelectorAll('.mobile-frame').forEach(f => {
                f.classList.remove('ring-2', 'ring-[#1677ff]', 'ring-offset-4', 'ring-offset-[#f5f5f5]');
                f.style.zIndex = '1';
            });
            frame.classList.add('ring-2', 'ring-[#1677ff]', 'ring-offset-4', 'ring-offset-[#f5f5f5]');
            frame.style.zIndex = '10';
            
            const page = state.pages.find(p => p.id === state.draggedFrameId);
            state.frameStartX = page.x;
            state.frameStartY = page.y;
            state.panStartX = e.clientX;
            state.panStartY = e.clientY;
            document.body.classList.add('is-panning');
            selectElement(frame); // Select the frame instead of clearing selection
        } else {
            if (e.target.closest('.element-actions')) return;
            const element = e.target.closest('.canvas-element');
            if (element && DOM.canvasWorld.contains(element) && e.button === 0) {
                selectElement(element);
                const frame = element.closest('.mobile-frame');
                if (frame) {
                    document.querySelectorAll('.mobile-frame').forEach(f => f.classList.remove('ring-2', 'ring-[#1677ff]', 'ring-offset-4', 'ring-offset-[#f5f5f5]'));
                }
            }
        }
    });

    document.addEventListener('mousemove', e => {
        if (state.isPanning) {
            e.preventDefault();
            state.canvasState.x = state.panStartCanvasX + (e.clientX - state.panStartX);
            state.canvasState.y = state.panStartCanvasY + (e.clientY - state.panStartY);
            renderCanvasTransform();
        } else if (state.isDraggingFrame && state.draggedFrameId) {
            e.preventDefault();
            const dx = (e.clientX - state.panStartX) / state.canvasState.scale;
            const dy = (e.clientY - state.panStartY) / state.canvasState.scale;
            
            const page = state.pages.find(p => p.id === state.draggedFrameId);
            if (page) {
                page.x = state.frameStartX + dx;
                page.y = state.frameStartY + dy;
                const frame = document.getElementById(`frame_${page.id}`);
                if (frame) {
                    frame.style.transform = `translate(${page.x}px, ${page.y}px)`;
                }
                drawConnections();
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (state.isPanning) {
            state.isPanning = false;
            document.body.classList.remove('is-panning');
        }
        if (state.isDraggingFrame) {
            state.isDraggingFrame = false;
            state.draggedFrameId = null;
            document.body.classList.remove('is-panning');
        }
    });

    DOM.canvasScrollArea.addEventListener('wheel', e => {
        e.preventDefault();

        if (e.ctrlKey || e.metaKey) {
            const oldScale = state.canvasState.scale;
            const nextScale = Math.min(1.6, Math.max(0.1, oldScale + (e.deltaY > 0 ? -0.08 : 0.08)));
            const rect = DOM.canvasScrollArea.getBoundingClientRect();
            const pointerX = e.clientX - rect.left;
            const pointerY = e.clientY - rect.top;
            const worldX = (pointerX - state.canvasState.x) / oldScale;
            const worldY = (pointerY - state.canvasState.y) / oldScale;

            state.canvasState.scale = nextScale;
            state.canvasState.x = pointerX - worldX * nextScale;
            state.canvasState.y = pointerY - worldY * nextScale;
        } else {
            let dy = e.deltaY;
            let dx = e.deltaX;
            if (e.deltaMode === 1) { 
                dy *= 40;
                dx *= 40;
            } else if (e.deltaMode === 2) { 
                dy *= 800;
                dx *= 800;
            }
            if (e.shiftKey) {
                state.canvasState.x -= dy;
            } else {
                state.canvasState.y -= dy;
                state.canvasState.x -= dx;
            }
        }
        renderCanvasTransform();
    }, { passive: false });

    document.addEventListener('selectstart', e => {
        if (document.body.classList.contains('is-dragging-component') || state.isPanning) {
            e.preventDefault();
        }
    });
}
