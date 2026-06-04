import { FormAPI } from './core/api.js';
import { safeCreateIcons } from './utils/helpers.js';
import { bindPropEvents } from './ui/properties.js';
import { bindCanvasEvents, initPages, checkEmptyState } from './ui/canvas.js';
import { bindPreviewEvents } from './ui/preview.js';
import { addComponentToCanvas } from './components/builder.js';
import { state } from './core/state.js';
import { loadSchema, saveToServer, markDirty, isDirty, establishBaseline } from './core/schema.js';
import { blankTemplate, kycClientTemplate, kycIndividualTemplate, kycEntityTemplate } from './templates/recommend.js';
import { canvasWorld } from './ui/dom.js';

window.saveToServer = saveToServer;



// 应用启动初始化函数
async function bootstrap() {
    // 渲染页面上的所有 Lucide 图标
    safeCreateIcons();

    // 配置左侧组件列表的拖放源选项
    const dragSourceOptions = {
        group: {
            name: 'shared',
            pull: 'clone', // 允许克隆组件到画布
            put: false     // 不允许将画布组件拖回组件列表
        },
        sort: false,       // 组件列表内部不允许排序
        animation: 150,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        chosenClass: 'drag-chosen',
        fallbackClass: 'drag-fallback',
        ghostClass: 'sortable-ghost',
        forceFallback: true,
        fallbackOnBody: true,
        fallbackTolerance: 4,
        draggable: '.component-item',
        onStart: function() {
            // 开始拖拽时，为 body 和画布添加状态类，隐藏空状态提示
            document.body.classList.add('is-dragging-component');
            state.pages.forEach(p => {
                const dz = document.getElementById(p.id);
                if (dz) {
                    dz.classList.add('is-dragging');
                    const empty = dz.querySelector('.canvas-empty-state');
                    if (empty) empty.style.display = 'none';
                }
            });
        },
        onEnd: function() {
            // 结束拖拽时，恢复状态，并重新检查空状态提示
            document.body.classList.remove('is-dragging-component');
            state.pages.forEach(p => {
                const dz = document.getElementById(p.id);
                if (dz) dz.classList.remove('is-dragging');
            });
            checkEmptyState();
        }
    };

    // 初始化基础组件、业务组件、布局组件三个分类的拖拽实例
    if (typeof Sortable !== 'undefined') {
        new Sortable(document.getElementById('components-basic'), dragSourceOptions);
        new Sortable(document.getElementById('components-business'), dragSourceOptions);
        new Sortable(document.getElementById('components-layout'), dragSourceOptions);
    }

    // 防止快速连续点击造成重复添加
    let lastItemClickTime = 0;

    // 处理左侧组件面板中组件项的点击事件，点击也可将组件添加到画布
    function handleComponentClick(e) {
        const item = e.target.closest('.component-item');
        if (!item) return;
        
        const now = Date.now();
        if (now - lastItemClickTime < 300) return;
        lastItemClickTime = now;
        
        // 如果当前正在拖拽则不响应点击
        if (document.body.classList.contains('is-dragging-component')) return;
        const type = item.getAttribute('data-type');
        if (type) {
            addComponentToCanvas(type);
        }
    }

    // 为三个组件分类区域绑定点击事件
    document.getElementById('components-basic').addEventListener('click', handleComponentClick);
    document.getElementById('components-business').addEventListener('click', handleComponentClick);
    document.getElementById('components-layout').addEventListener('click', handleComponentClick);

    // 绑定模板点击事件
    function bindTemplateBtn(id, templateObj, tplKey) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                if (confirm('加载模板将清空当前所有内容，是否继续？')) {
                    loadSchema(templateObj);
                    
                    // 修改 URL 加上 tpl 参数
                    if (tplKey) {
                        const url = new URL(window.location);
                        url.searchParams.set('tpl', tplKey);
                        window.history.pushState({}, '', url);
                    } else {
                        const url = new URL(window.location);
                        url.searchParams.delete('tpl');
                        window.history.pushState({}, '', url);
                    }
                    
                    // 关闭模板画廊 Modal
                    const modal = document.getElementById('template-modal');
                    const content = document.getElementById('template-modal-content');
                    if (modal && content) {
                        modal.classList.add('opacity-0', 'pointer-events-none');
                        content.classList.add('scale-95', 'opacity-0');
                    }
                }
            });
        }
    }
    
    bindTemplateBtn('btn-clear-canvas-sidebar', blankTemplate, null);
    bindTemplateBtn('btn-tpl-kyc-client-modal', kycClientTemplate, 'kyc-client');
    bindTemplateBtn('btn-tpl-kyc-individual-modal', kycIndividualTemplate, 'kyc-individual');
    bindTemplateBtn('btn-tpl-kyc-entity-modal', kycEntityTemplate, 'kyc-entity');

    // 实现组件搜索过滤功能
    document.getElementById('component-search').addEventListener('input', e => {
        const keyword = e.target.value.trim().toLowerCase();
        document.querySelectorAll('.component-item').forEach(item => {
            const text = item.textContent.trim().toLowerCase();
            item.style.display = text.includes(keyword) ? '' : 'none';
        });
    });

    // 绑定各类全局事件
    bindPropEvents();
    bindCanvasEvents();
    bindPreviewEvents();

    // 通过 URL 参数加载指定的模板数据（模拟后端数据加载逻辑）
    const urlParams = new URLSearchParams(window.location.search);
    const tplParam = urlParams.get('tpl');
    
    if (tplParam === 'kyc-client') {
        loadSchema(kycClientTemplate);
    } else if (tplParam === 'kyc-individual') {
        loadSchema(kycIndividualTemplate);
    } else if (tplParam === 'kyc-entity') {
        loadSchema(kycEntityTemplate);
    } else {
        // 从后端接口加载最新保存的模板
        try {
            const response = await FormAPI.getTemplate('default');
            if (response.success && response.data.schema && response.data.schema.pages && response.data.schema.pages.length > 0) {
                loadSchema(response.data.schema);
            } else {
                initPages();
                checkEmptyState();
                setTimeout(() => establishBaseline(), 100);
            }
        } catch (e) {
            console.error('加载模板失败', e);
            initPages();
            checkEmptyState();
            setTimeout(() => establishBaseline(), 100);
        }
    }
    
    // 监听 DOM 树变化，标记为未保存
    const observer = new MutationObserver(() => markDirty());
    observer.observe(canvasWorld, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
    });
    
    // 监听属性面板表单更改，标记为未保存
    document.addEventListener('input', (e) => {
        if (e.target.closest('#prop-panel') || e.target.closest('.canvas-element') || e.target.closest('.page-title-input')) {
            markDirty();
        }
    });
    document.addEventListener('change', (e) => {
        if (e.target.closest('#prop-panel') || e.target.closest('.canvas-element') || e.target.closest('.page-title-input')) {
            markDirty();
        }
    });

    // 如果未保存，刷新或离开页面时进行拦截提示
    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '您有未保存的更改，确定要离开吗？';
        }
    });
    


    // ================= 右键菜单逻辑 =================
    const contextMenu = document.getElementById('canvas-context-menu');
    const canvasArea = document.getElementById('canvas-scroll-area');
    
    // 监听画布背景的右键事件
    canvasArea.addEventListener('contextmenu', (e) => {
        // 如果点击的是组件或者页面框架，不干预（可选：也可全局屏蔽）
        if (e.target.closest('.canvas-element') || e.target.closest('.mobile-frame')) {
            return;
        }
        
        e.preventDefault();
        
        // 显示菜单并定位
        contextMenu.classList.remove('hidden');
        
        // 简单计算边界防止菜单超出屏幕
        let x = e.clientX;
        let y = e.clientY;
        const menuRect = contextMenu.getBoundingClientRect();
        if (x + menuRect.width > window.innerWidth) x -= menuRect.width;
        if (y + menuRect.height > window.innerHeight) y -= menuRect.height;
        
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
    });

    // 点击空白处隐藏菜单
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.classList.add('hidden');
        }
    });

    // 绑定右键菜单功能按钮
    document.getElementById('menu-btn-new-page').addEventListener('click', () => {
        import('./ui/canvas.js').then(({ addPage }) => addPage());
        contextMenu.classList.add('hidden');
    });

    document.getElementById('menu-btn-reset-view').addEventListener('click', () => {
        import('./ui/canvas.js').then(({ resetCanvasView }) => resetCanvasView());
        contextMenu.classList.add('hidden');
    });
}

// 启动应用
bootstrap();
