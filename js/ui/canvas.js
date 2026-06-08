import { state, setSelectedElement } from '../core/state.js';
import { notifySchemaChange, safeCreateIcons, stringifyMultiValue, writeOptions, readOptions } from '../utils/helpers.js';
import { optionTypes, valueTypes } from '../components/registry.js';
import * as DOM from './dom.js';
import { updateDefaultValueUI, renderOptionsEditor, syncMaxSelectionsUI } from './properties.js';
import { createElementFromSchema, serializeElement } from '../core/schema.js';

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

// 获取连接锚点的具体坐标
function getEdgePoint(rect, edge) {
    const { x, y, w, h } = rect;
    switch(edge) {
        case 'top': return { x: x + w/2, y: y };
        case 'bottom': return { x: x + w/2, y: y + h };
        case 'left': return { x: x, y: y + h/2 };
        case 'right': return { x: x + w, y: y + h/2 };
        default: return { x: x + w, y: y + h/2 };
    }
}

// 获取贝塞尔曲线的控制点
function getControlPoint(x, y, edge, offset) {
    switch(edge) {
        case 'top': return { x, y: y - offset };
        case 'bottom': return { x, y: y + offset };
        case 'left': return { x: x - offset, y };
        case 'right': return { x: x + offset, y };
        default: return { x: x + offset, y };
    }
}

// 智能计算出入边
function getSmartEdges(rectA, rectB) {
    const centerA = { x: rectA.x + rectA.w / 2, y: rectA.y + rectA.h / 2 };
    const centerB = { x: rectB.x + rectB.w / 2, y: rectB.y + rectB.h / 2 };
    
    const dx = centerB.x - centerA.x;
    const dy = centerB.y - centerA.y;
    
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    
    let sourceEdge = 'right';
    let targetEdge = 'left';
    
    if (angle >= 45 && angle < 135) {
        sourceEdge = 'bottom';
        targetEdge = 'top';
    } else if (angle >= 135 && angle < 225) {
        sourceEdge = 'left';
        targetEdge = 'right';
    } else if (angle >= 225 && angle < 315) {
        sourceEdge = 'top';
        targetEdge = 'bottom';
    }
    return { sourceEdge, targetEdge };
}

// 绘制多个页面面板之间的连接连线（贝塞尔曲线）
export function drawConnections() {
    const canvasConnections = document.getElementById('canvas-connections');
    if (!canvasConnections) return;
    
    // 清除旧的连线路径，但保留 <defs> 和 marker
    const oldPaths = canvasConnections.querySelectorAll('.connection-path');
    oldPaths.forEach(p => p.remove());
    
    // 基于页面的自然顺序进行自动连线 (Auto-Flow)
    if (state.pages && state.pages.length > 1) {
        for (let i = 0; i < state.pages.length - 1; i++) {
            const pageA = state.pages[i];
            const pageB = state.pages[i+1];
            const sourceFrame = document.getElementById(`frame_${pageA.id}`);
            const targetFrame = document.getElementById(`frame_${pageB.id}`);
            if (!sourceFrame || !targetFrame) continue;
            
            const rectA = { x: pageA.x, y: pageA.y, w: sourceFrame.offsetWidth, h: sourceFrame.offsetHeight };
            const rectB = { x: pageB.x, y: pageB.y, w: targetFrame.offsetWidth, h: targetFrame.offsetHeight };
            
            const { sourceEdge, targetEdge } = getSmartEdges(rectA, rectB);
            
            const p1 = getEdgePoint(rectA, sourceEdge);
            const p2 = getEdgePoint(rectB, targetEdge);
            
            const dist = Math.max(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
            // 限制贝塞尔曲线的张力范围，防止极远距离时曲线过于膨胀
            const controlOffset = Math.min(Math.max(dist / 2, 60), 150);
            
            const cp1 = getControlPoint(p1.x, p1.y, sourceEdge, controlOffset);
            const cp2 = getControlPoint(p2.x, p2.y, targetEdge, controlOffset);
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`);
            path.setAttribute('class', 'connection-path');
            path.setAttribute('marker-end', 'url(#arrowhead)');
            canvasConnections.appendChild(path);
        }
    }
}
window.renderConnections = drawConnections;

// 移动画布视角，聚焦并平滑过渡到指定的页面面板位置
export function focusOnPage(pageId, autoFit = false, immediate = false) {
    const page = state.pages.find(p => p.id === pageId);
    if (!page) return;
    
    const viewportWidth = DOM.canvasScrollArea.clientWidth;
    const viewportHeight = DOM.canvasScrollArea.clientHeight;
    
    const frameHeight = document.getElementById(`frame_${pageId}`)?.clientHeight || 720;
    
    let targetScale = state.canvasState.scale;
    let isImmediate = immediate;
    if (autoFit) {
        const scaleX = (viewportWidth - 120) / PAGE_WIDTH;
        const scaleY = (viewportHeight - 120) / frameHeight;
        targetScale = Math.min(1.6, Math.max(0.1, Math.min(scaleX, scaleY)));
        // 如果计算出来的自适应缩放比例非常接近 100%（比如 98%, 99%, 101%），则强制吸附到 100%，避免出现让用户感到困惑的零碎百分比
        if (Math.abs(targetScale - 1) < 0.05) {
            targetScale = 1;
        }
    } else if (state.isFirstFocus) {
        targetScale = 0.9;
        isImmediate = true;
        state.isFirstFocus = false;
    }
    if (autoFit && state.isFirstFocus) {
        state.isFirstFocus = false;
    }
    
    const targetX = (viewportWidth / 2) - ((page.x + PAGE_WIDTH / 2) * targetScale);
    const targetY = (viewportHeight / 2) - ((page.y + frameHeight / 2) * targetScale);
    
    if (isImmediate) {
        state.canvasState.x = targetX;
        state.canvasState.y = targetY;
        state.canvasState.scale = targetScale;
        renderCanvasTransform();
        
        // 确保坐标系应用完成后再显示画布，实现平滑渐现
        setTimeout(() => {
            const world = document.getElementById('canvas-world');
            if (world) world.classList.remove('opacity-0');
        }, 50);
        
        return;
    }
    
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
export function addPage(afterPageId = null, options = {}) {
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
    deleteBtn.classList.replace('hidden', 'flex');
    deleteBtn.addEventListener('click', () => {
        requestDeletePage(newId);
    });
    
    const addNextBtn = frame.querySelector('.add-next-page-btn');
    addNextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addPage(newId);
    });
    
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
    }
    
    // 如果是首个页面，隐藏全局空状态并显示右下角工具条
    if (isFirst) {
        const globalEmpty = document.getElementById('canvas-global-empty');
        const globalEmptyCard = document.getElementById('canvas-global-empty-card');
        if (globalEmpty) {
            globalEmpty.classList.remove('opacity-100');
            globalEmpty.classList.add('opacity-0', 'pointer-events-none');
        }
        if (globalEmptyCard) {
            globalEmptyCard.classList.remove('scale-100');
            globalEmptyCard.classList.add('scale-95');
        }
        
        const controlsToolbar = document.getElementById('canvas-controls-toolbar');
        if (controlsToolbar) {
            controlsToolbar.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
        }
    }
    
    // 重新排列后续页面的位置
    if (!isFirst && insertIndex < state.pages.length - 1) {
        for (let i = insertIndex + 1; i < state.pages.length; i++) {
            state.pages[i].x = state.pages[i-1].x + PAGE_WIDTH + PAGE_GAP;
            const currentFrame = document.getElementById(`frame_${state.pages[i].id}`);
            if (currentFrame) currentFrame.style.transform = `translate(${state.pages[i].x}px, ${state.pages[i].y}px)`;
        }
    }
    
    initDropzone(dropzoneNode);
    safeCreateIcons();
    // 延迟渲染连线，确保 DOM 完成布局（获取正确的宽高等参数）
    requestAnimationFrame(() => requestAnimationFrame(() => drawConnections()));
    updatePageSequenceBadges();
    
    const shouldFocus = options.focus !== false;

    if (shouldFocus && !isFirst) {
        focusOnPage(newId);
        selectElement(frame);
    } else if (shouldFocus) {
        focusOnPage(newId, true, true);
        selectElement(frame);
    }

    notifySchemaChange();
}

// 从实际 DOM 判断页面是否为空，避免依赖运行时未维护的 page.fields。
export function isPageEmpty(pageId) {
    const dropzone = document.getElementById(pageId);
    if (!dropzone) return true;
    return !dropzone.querySelector(':scope > .canvas-element');
}

export function requestDeletePage(pageId) {
    if (!pageId) return;
    if (isPageEmpty(pageId) || confirm('确定要删除当前画布及其所有内容吗？此操作不可撤销。')) {
        deletePage(pageId);
    }
}

// 从画布和状态中删除指定页面，并重新排列后续页面的位置
export function deletePage(pageId) {
    const index = state.pages.findIndex(p => p.id === pageId);
    if (index === -1) return;
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
    
    if (state.pages.length > 0) {
        focusOnPage(state.pages[Math.max(0, index - 1)].id);
    } else {
        // If 0 pages left, clear selected element and show empty state in right sidebar
        state.selectedElement = null;
        const propEmpty = document.getElementById('prop-empty');
        const propEditor = document.getElementById('prop-editor');
        const pagePropEditor = document.getElementById('page-prop-editor');
        const propIdText = document.getElementById('prop-id');
        
        if (propEmpty && propEditor && pagePropEditor) {
            propEmpty.classList.remove('hidden');
            propEditor.classList.add('hidden');
            pagePropEditor.classList.add('hidden');
            if (propIdText) propIdText.textContent = 'None';
        }
        
        // 显示全局大画布空状态并隐藏右下角工具条
        const globalEmpty = document.getElementById('canvas-global-empty');
        const globalEmptyCard = document.getElementById('canvas-global-empty-card');
        if (globalEmpty) {
            globalEmpty.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
            globalEmpty.classList.add('opacity-100');
        }
        if (globalEmptyCard) {
            globalEmptyCard.classList.remove('scale-95');
            globalEmptyCard.classList.add('scale-100');
        }
        
        const controlsToolbar = document.getElementById('canvas-controls-toolbar');
        if (controlsToolbar) {
            controlsToolbar.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
        }
        
        // 重置视角居中，以便展示空状态
        state.canvasState.x = 0;
        state.canvasState.y = 0;
        state.canvasState.scale = 1;
        renderCanvasTransform();
    }
    
    notifySchemaChange();
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
    addPage(null, { focus: false });
    resetCanvasViewAfterLayout();
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
    document.body.style.setProperty('--canvas-scale', state.canvasState.scale.toFixed(3));
    
    const zoomText = document.getElementById('zoom-percent-text');
    if (zoomText) {
        zoomText.textContent = `${Math.round(state.canvasState.scale * 100)}%`;
    }
    
    drawRulers();
}

// 重置画布的视角和缩放比例：计算所有画布的边界，实现“适应屏幕 (Zoom to Fit)”
export function resetCanvasView() {
    if (!state.pages || state.pages.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    state.pages.forEach(page => {
        const frame = document.getElementById(`frame_${page.id}`);
        const w = frame ? frame.offsetWidth : 460;
        const h = frame ? frame.offsetHeight : 720;
        
        if (page.x < minX) minX = page.x;
        if (page.y < minY) minY = page.y;
        if (page.x + w > maxX) maxX = page.x + w;
        if (page.y + h > maxY) maxY = page.y + h;
    });
    
    const totalWidth = maxX - minX;
    const totalHeight = maxY - minY;
    
    const viewportWidth = DOM.canvasScrollArea.clientWidth;
    const viewportHeight = DOM.canvasScrollArea.clientHeight;
    
    // 留出四周 80px 的安全边距
    const padding = 160; 
    const safeWidth = Math.max(10, viewportWidth - padding);
    const safeHeight = Math.max(10, viewportHeight - padding);
    const scaleX = safeWidth / totalWidth;
    const scaleY = safeHeight / totalHeight;
    
    let targetScale = Math.min(1, Math.max(0.1, Math.min(scaleX, scaleY)));
    // 接近 100% 时吸附
    if (Math.abs(targetScale - 1) < 0.05) targetScale = 1;
    
    state.canvasState.scale = targetScale;
    
    // 由于 transform-origin 是 0 0，并且 CSS 是 translate(x,y) scale(s)
    // 渲染后的屏幕坐标 = x + Px * s
    // 我们希望 contentCenterX 映射到 viewportWidth / 2
    const contentCenterX = minX + totalWidth / 2;
    const contentCenterY = minY + totalHeight / 2;
    
    state.canvasState.x = (viewportWidth / 2) - (contentCenterX * targetScale);
    state.canvasState.y = (viewportHeight / 2) - (contentCenterY * targetScale);
    
    DOM.canvasWorld.classList.add('is-zooming');
    renderCanvasTransform();
    DOM.canvasWorld.classList.remove('opacity-0');
    if (window._zoomTransitionTimeout) clearTimeout(window._zoomTransitionTimeout);
    window._zoomTransitionTimeout = setTimeout(() => {
        DOM.canvasWorld.classList.remove('is-zooming');
    }, 350);
}

export function resetCanvasViewAfterLayout() {
    requestAnimationFrame(() => requestAnimationFrame(() => resetCanvasView()));
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
    
    DOM.canvasWorld.classList.add('is-zooming');
    renderCanvasTransform();
    if (window._zoomTransitionTimeout) clearTimeout(window._zoomTransitionTimeout);
    window._zoomTransitionTimeout = setTimeout(() => {
        DOM.canvasWorld.classList.remove('is-zooming');
    }, 350);
}

// 选中画布中的某个组件，并在右侧属性面板中展示该组件的各项属性
export function selectElement(el) {
    if (!el || !el.dataset) return; // Prevent selection of invalid objects
    
    if (window.setSidebarState) {
        window.setSidebarState('right', true);
    }

    if (state.selectedElement && state.selectedElement.classList) {
        state.selectedElement.classList.remove('is-selected');
        if (state.selectedElement.classList.contains('mobile-frame')) {
            state.selectedElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-1');
            state.selectedElement.style.zIndex = '1';
        }
    }
    setSelectedElement(el);
    if (state.selectedElement && state.selectedElement.classList) {
        state.selectedElement.classList.add('is-selected');
        if (state.selectedElement.classList.contains('mobile-frame')) {
            state.selectedElement.classList.add('ring-2', 'ring-blue-500', 'ring-offset-1');
            state.selectedElement.style.zIndex = '10';
        }
    }

    const type = el.dataset.type || 'field';
    const hasPlaceholder = Boolean(el.querySelector('.component-placeholder')) || type === 'select' || type === 'signature';
    const hasOptions = optionTypes.includes(type);
    const hasDefaultValue = valueTypes.includes(type) || (hasOptions && type !== 'alert' && type !== 'signature');
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
        
        return;
    }
    
    document.getElementById('page-prop-editor').classList.add('hidden');
    DOM.propEditor.classList.remove('hidden');
    DOM.propIdText.textContent = el.id;
    DOM.propTypeBadge.textContent = type;
    DOM.inputLabel.value = el.dataset.label || '';
    // 字段标识已从基础信息中移除，因为顶部已有显示
    DOM.inputHelp.value = el.dataset.help || '';
    updateDefaultValueUI(el);
    DOM.inputPlaceholder.value = el.dataset.placeholder || '';

    DOM.propPlaceholderGroup.style.display = hasPlaceholder ? 'block' : 'none';
    DOM.propDateTypeGroup.style.display = type === 'date' ? 'block' : 'none';
    if (type === 'date') {
        DOM.propDateTypeSelect.value = el.dataset.dateType || 'date';
    }
    DOM.propHelpGroup.style.display = (type === 'grid' || type === 'alert') ? 'none' : 'block';
    DOM.propDefaultGroup.style.display = hasDefaultValue ? 'block' : 'none';
    const isFixedOptions = type === 'country' || type === 'nationality';
    DOM.propOptionsGroup.classList.toggle('hidden', !hasOptions || isFixedOptions);
    DOM.propLayoutGroup.style.display = canStackChoices ? 'block' : 'none';
    DOM.propLayoutSelect.value = el.dataset.layout || 'inline';
    
    // Hide required toggle for structural components like grid and alert
    const requiredGroup = DOM.toggleRequired.closest('.prop-section');
    if (requiredGroup) {
        requiredGroup.style.display = (type === 'grid' || type === 'alert') ? 'none' : 'flex';
    }
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
    if (state.selectedElement && state.selectedElement.classList) {
        state.selectedElement.classList.remove('is-selected');
        if (state.selectedElement.classList.contains('mobile-frame')) {
            state.selectedElement.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-1');
            state.selectedElement.style.zIndex = '1';
        }
    }
    if (state.selectedElement) {
        setSelectedElement(null);
    }
    DOM.propEmpty.classList.remove('hidden');
    DOM.propEditor.classList.add('hidden');
    document.getElementById('page-prop-editor').classList.add('hidden');
    DOM.propIdText.textContent = 'None';
    
    if (window.setSidebarState) {
        window.setSidebarState('right', false);
    }
}

// 删除指定的画布组件
export function deleteElement(event, el) {
    event.stopPropagation();
    if (state.selectedElement === el) clearSelection();
    el.remove();
    checkEmptyState();
    refreshNestedEmptyStates();
    notifySchemaChange();
}

window.deleteElement = deleteElement;

// 复制指定的组件并在其后插入新的一份拷贝
window.duplicateElement = function(event, el) {
    event.stopPropagation();

    const schema = serializeElement(el);
    const remapIds = field => {
        const id = `cmp_${getUniqueId()}`;
        field.id = id;
        field.key = `${field.type}_${String(id).replace('cmp_', '')}`;

        if (field.columns) {
            field.columns.forEach((column, colIndex) => {
                column.id = `col_${getUniqueId()}_${colIndex + 1}`;
                (column.elements || []).forEach(remapIds);
            });
        }
    };
    remapIds(schema);

    const clone = createElementFromSchema(schema);
    if (!clone) return;

    el.parentNode.insertBefore(clone, el.nextSibling);

    safeCreateIcons();
    selectElement(clone);
    checkEmptyState();
    refreshNestedEmptyStates();
    notifySchemaChange();
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
        animation: 180,
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
        onStart: function(evt) {
            document.body.classList.add('is-dragging-component');
            
            // 解决跨页面的图层穿透问题：临时将当前活动页面的层级提到最上面
            const frame = evt.from.closest('.mobile-frame');
            if (frame) {
                frame.style.zIndex = '9999';
            }
            
            setTimeout(() => {
                const fallback = document.querySelector('body > .drag-fallback');
                if (fallback && evt.item) {
                    const rect = evt.item.getBoundingClientRect();
                    const scale = state.canvasState.scale || 1;
                    const visual = evt.item.cloneNode(true);
                    visual.classList.remove('sortable-ghost', 'drag-chosen');
                    visual.classList.add('drag-fallback', 'sortable-drag', 'drag-fallback-visual');
                    visual.style.position = 'relative';
                    visual.style.left = '0';
                    visual.style.top = '0';
                    visual.style.width = `${evt.item.offsetWidth}px`;
                    visual.style.height = `${evt.item.offsetHeight}px`;
                    visual.style.transform = `scale(${scale})`;
                    visual.style.boxSizing = 'border-box';

                    fallback.style.left = `${rect.left}px`;
                    fallback.style.top = `${rect.top}px`;
                    fallback.style.width = `${rect.width}px`;
                    fallback.style.height = `${rect.height}px`;
                    fallback.style.scale = '';
                    fallback.style.transformOrigin = '';
                    fallback.classList.add('drag-fallback-shell');
                    fallback.innerHTML = '';
                    fallback.appendChild(visual);
                }
            }, 0);
        },
        onEnd: function(evt) {
            document.body.classList.remove('is-dragging-component');
            
            // 恢复层级
            const frame = evt.from.closest('.mobile-frame');
            if (frame) {
                frame.style.zIndex = '';
            }
            checkEmptyState();
            refreshNestedEmptyStates();
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
            notifySchemaChange();
            setTimeout(() => {
                selectElement(itemEl);
            }, 20);
        },
        onRemove: function() {
            checkEmptyState();
            refreshNestedEmptyStates();
            notifySchemaChange();
        },
        onSort: function() {
            refreshNestedEmptyStates();
            notifySchemaChange();
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
        resetCanvasView();
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
                canvasElement.dataset.defaultValue = stringifyMultiValue(checkedInputs.map(i => i.value));
            }
            if (state.selectedElement === canvasElement) {
                updateDefaultValueUI(canvasElement);
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
        if (state.pages.length === 0) return;
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
            }
        } else if (isFrameDrag) {
            if (document.activeElement && document.activeElement.hasAttribute('contenteditable')) {
                document.activeElement.blur();
            }
            e.preventDefault();
            const frame = e.target.closest('.mobile-frame');
            state.isDraggingFrame = true;
            state.draggedFrameId = frame.id.replace('frame_', '');
            
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
            const pageTitleInput = e.target.closest('.page-title-input');
            const pageDescInput = e.target.closest('.page-desc-input');
            
            if (element && DOM.canvasWorld.contains(element) && e.button === 0) {
                // 阻止浏览器在点击组件空白处时自动将焦点转移到内部的 contenteditable 元素
                if (!e.target.closest('.label-text, .option-text, .signature-declaration-text')) {
                    e.preventDefault();
                }
                selectElement(element);
                
                setTimeout(() => {
                    const labelText = e.target.closest('.label-text');
                    const placeholderText = e.target.closest('.component-placeholder');
                    const helpText = e.target.closest('.field-help');
                    const optionText = e.target.closest('.option-text, .signature-declaration-text');

                    const triggerHighlight = (input) => {
                        if (!input) return;
                        input.classList.remove('pulse-highlight');
                        void input.offsetWidth;
                        input.classList.add('pulse-highlight');
                        
                        const editor = document.getElementById('prop-editor');
                        if (editor && !editor.classList.contains('hidden')) {
                            const editorRect = editor.getBoundingClientRect();
                            const inputRect = input.getBoundingClientRect();
                            const targetScroll = editor.scrollTop + (inputRect.top - editorRect.top) - (editorRect.height / 2) + (inputRect.height / 2);
                            editor.scrollTo({ top: targetScroll, behavior: 'smooth' });
                        }
                        setTimeout(() => input.classList.remove('pulse-highlight'), 1200);
                    };

                    if (labelText) {
                        triggerHighlight(document.getElementById('prop-label-input'));
                    } else if (placeholderText) {
                        triggerHighlight(document.getElementById('prop-placeholder-input'));
                    } else if (helpText) {
                        triggerHighlight(document.getElementById('prop-help-input'));
                    } else if (optionText) {
                        const targets = Array.from(element.querySelectorAll('.option-text, .signature-declaration-text'));
                        const index = targets.indexOf(optionText);
                        if (index !== -1) {
                            const editor = document.getElementById('options-editor');
                            if (editor && editor.children[index]) {
                                triggerHighlight(editor.children[index].querySelector('input, textarea'));
                            }
                        }
                    }
                }, 10);
            } else if ((pageTitleInput || pageDescInput) && e.button === 0) {
                const frame = e.target.closest('.mobile-frame');
                if (frame) {
                    selectElement(frame);
                    
                    setTimeout(() => {
                        const triggerHighlight = (input) => {
                            if (!input) return;
                            input.classList.remove('pulse-highlight');
                            void input.offsetWidth;
                            input.classList.add('pulse-highlight');
                            
                            const editor = document.getElementById('page-prop-editor');
                            if (editor && !editor.classList.contains('hidden')) {
                                const editorRect = editor.getBoundingClientRect();
                                const inputRect = input.getBoundingClientRect();
                                const targetScroll = editor.scrollTop + (inputRect.top - editorRect.top) - (editorRect.height / 2) + (inputRect.height / 2);
                                editor.scrollTo({ top: targetScroll, behavior: 'smooth' });
                            }
                            setTimeout(() => input.classList.remove('pulse-highlight'), 1200);
                        };

                        if (pageTitleInput) {
                            triggerHighlight(document.getElementById('page-prop-title-input'));
                        } else if (pageDescInput) {
                            triggerHighlight(document.getElementById('page-prop-desc-input'));
                        }
                    }, 10);
                }
            }
        }
    }, { capture: true });

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

    document.addEventListener('mouseup', (e) => {
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
        if (state.pages.length === 0) return;
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
