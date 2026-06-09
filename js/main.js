import { FormAPI } from './core/api.js';
import { safeCreateIcons } from './utils/helpers.js';
import { bindPropEvents } from './ui/properties.js';
import { addPage, bindCanvasEvents, initPages, checkEmptyState, resetCanvasView, requestDeletePage } from './ui/canvas.js';
import { bindPreviewEvents } from './ui/preview.js';
import { addComponentToCanvas, setupElementData } from './components/builder.js';
import { state } from './core/state.js';
import { loadSchema, saveToServer, markDirty, isDirty, establishBaseline } from './core/schema.js';
import { blankTemplate, kycIndividualTemplate, kycEntityTemplate } from './templates/recommend.js';

window.saveToServer = saveToServer;

const templateUiMeta = {
    blank: {
        label: '新建画布',
        badge: '推荐',
        dotClass: 'bg-slate-400',
        galleryTheme: 'default'
    },
    saved: {
        label: '最近保存的表单',
        badge: '最近',
        dotClass: 'bg-blue-500',
        galleryTheme: 'entity'
    },
    'kyc-individual': {
        label: '个人 KYC',
        badge: '个人',
        dotClass: 'bg-emerald-500',
        galleryTheme: 'personal'
    },
    'kyc-entity': {
        label: '实体 KYC',
        badge: '实体',
        dotClass: 'bg-blue-500',
        galleryTheme: 'entity'
    }
};

const galleryThemePool = [
    'bg-[#1677ff]',
    'hover:bg-[#4096ff]',
    'bg-blue-500',
    'hover:bg-blue-600',
    'bg-emerald-500',
    'hover:bg-emerald-600'
];

const galleryThemes = {
    default: ['bg-[#1677ff]', 'hover:bg-[#4096ff]'],
    entity: ['bg-blue-500', 'hover:bg-blue-600'],
    personal: ['bg-emerald-500', 'hover:bg-emerald-600']
};

const templateCardClassPools = {
    card: [
        'border-slate-200', 'bg-white', 'shadow-sm',
        'border-emerald-300', 'bg-emerald-50/60',
        'border-blue-300', 'bg-blue-50/60'
    ],
    icon: [
        'bg-slate-50', 'border-slate-100', 'text-slate-400',
        'bg-emerald-500', 'border-emerald-500', 'text-white',
        'bg-blue-500', 'border-blue-500', 'text-white'
    ],
    action: [
        'text-slate-300', 'text-emerald-500', 'text-blue-500'
    ]
};

const templateCardThemes = {
    default: {
        card: ['border-slate-200', 'bg-white'],
        icon: ['bg-slate-50', 'border-slate-100', 'text-slate-400'],
        action: ['text-slate-300']
    },
    personal: {
        card: ['border-emerald-300', 'bg-emerald-50/60', 'shadow-sm'],
        icon: ['bg-emerald-500', 'border-emerald-500', 'text-white'],
        action: ['text-emerald-500']
    },
    entity: {
        card: ['border-blue-300', 'bg-blue-50/60', 'shadow-sm'],
        icon: ['bg-blue-500', 'border-blue-500', 'text-white'],
        action: ['text-blue-500']
    }
};

function measureComponentPlaceholderHeight(type) {
    const template = document.getElementById(`tpl-${type}`);
    if (!template) return null;

    const tempDiv = document.createElement('div');
    tempDiv.appendChild(template.content.cloneNode(true));
    const rootDiv = tempDiv.querySelector('.canvas-element');
    if (!rootDiv) return null;

    const measureEl = document.createElement('div');
    measureEl.className = rootDiv.className;
    measureEl.innerHTML = rootDiv.innerHTML;
    measureEl.id = 'cmp_measure';
    setupElementData(measureEl, type);

    const targetDropzone = document.querySelector('.canvas-dropzone');
    const targetWidth = targetDropzone ? targetDropzone.clientWidth : 342;
    const sandbox = document.createElement('div');
    sandbox.style.position = 'fixed';
    sandbox.style.left = '-10000px';
    sandbox.style.top = '0';
    sandbox.style.width = `${targetWidth}px`;
    sandbox.style.visibility = 'hidden';
    sandbox.style.pointerEvents = 'none';
    sandbox.appendChild(measureEl);
    document.body.appendChild(sandbox);

    const height = Math.ceil(measureEl.getBoundingClientRect().height);
    sandbox.remove();

    return height || null;
}

function syncDragPlaceholderHeight(type) {
    const height = measureComponentPlaceholderHeight(type);
    if (height) {
        document.body.style.setProperty('--drag-placeholder-height', `${height}px`);
    } else {
        document.body.style.removeProperty('--drag-placeholder-height');
    }
}

function replaceClasses(node, pool, nextClasses = []) {
    if (!node) return;
    node.classList.remove(...pool);
    node.classList.add(...nextClasses);
}

function applyTemplateCardTheme(card, themeName, isActive) {
    const theme = isActive ? templateCardThemes[themeName] : templateCardThemes.default;
    replaceClasses(card, templateCardClassPools.card, theme.card);
    replaceClasses(card.querySelector('.template-card-icon'), templateCardClassPools.icon, theme.icon);
    replaceClasses(card.querySelector('.template-card-action'), templateCardClassPools.action, theme.action);
}

function setActiveTemplate(tplKey = 'blank') {
    const activeKey = tplKey || 'blank';
    const meta = templateUiMeta[activeKey] || templateUiMeta.blank;

    const currentTemplateText = document.getElementById('sidebar-current-template-text');
    if (currentTemplateText) {
        currentTemplateText.textContent = `当前模板：${meta.label}`;
    }

    const dot = document.getElementById('sidebar-template-status-dot');
    if (dot) {
        dot.classList.remove('bg-slate-400', 'bg-blue-500', 'bg-emerald-500');
        dot.classList.add(meta.dotClass);
    }

    const badge = document.getElementById('template-gallery-badge');
    if (badge) {
        badge.textContent = meta.badge;
    }

    replaceClasses(
        document.getElementById('btn-open-gallery'),
        galleryThemePool,
        galleryThemes[meta.galleryTheme] || galleryThemes.default
    );

    document.querySelectorAll('[data-template-key]').forEach(node => {
        const isActive = node.dataset.templateKey === activeKey;
        const cardMeta = templateUiMeta[node.dataset.templateKey];
        applyTemplateCardTheme(node, cardMeta?.galleryTheme || 'default', isActive);

        const actionIcon = node.querySelector('.template-card-action');
        if (actionIcon) {
            actionIcon.setAttribute('data-lucide', isActive ? 'check' : 'plus');
        }
    });

    safeCreateIcons();
}

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
        onStart: function(evt) {
            const type = evt.item?.getAttribute('data-type');
            if (type) syncDragPlaceholderHeight(type);

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
            document.body.style.removeProperty('--drag-placeholder-height');
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
                    setActiveTemplate(tplKey || 'blank');
                    
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
    bindTemplateBtn('btn-tpl-kyc-individual-modal', kycIndividualTemplate, 'kyc-individual');
    bindTemplateBtn('btn-tpl-kyc-entity-modal', kycEntityTemplate, 'kyc-entity');

    // 实现组件搜索过滤功能
    const componentSearchInput = document.getElementById('component-search');
    const componentSearchShortcut = document.getElementById('component-search-shortcut');
    const componentSearchClear = document.getElementById('component-search-clear');

    function updateComponentSearchControls() {
        const hasKeyword = componentSearchInput.value.trim().length > 0;
        if (componentSearchShortcut) {
            componentSearchShortcut.classList.toggle('hidden', hasKeyword);
        }
        if (componentSearchClear) {
            componentSearchClear.classList.toggle('hidden', !hasKeyword);
            componentSearchClear.classList.toggle('flex', hasKeyword);
        }
    }

    function filterComponentList() {
        const keyword = componentSearchInput.value.trim().toLowerCase();
        document.querySelectorAll('.component-item').forEach(item => {
            const text = item.textContent.trim().toLowerCase();
            item.style.display = text.includes(keyword) ? '' : 'none';
        });
        let hasAnyVisibleSection = false;
        document.querySelectorAll('[data-component-section]').forEach(section => {
            const hasVisibleItems = Array.from(section.querySelectorAll('.component-item'))
                .some(item => item.style.display !== 'none');
            section.classList.toggle('hidden', !hasVisibleItems);
            if (hasVisibleItems) hasAnyVisibleSection = true;
        });
        const emptyState = document.getElementById('component-search-empty');
        if (emptyState) {
            emptyState.classList.toggle('hidden', !keyword || hasAnyVisibleSection);
        }
        updateComponentSearchControls();
    }

    function focusComponentSearch() {
        const searchContainer = document.getElementById('sidebar-search-container');
        const isCollapsed = searchContainer && searchContainer.classList.contains('grid-rows-[0fr]');
        if (isCollapsed && window.toggleSidebarSearch) {
            window.toggleSidebarSearch();
        } else {
            componentSearchInput.focus();
            componentSearchInput.select();
        }
    }

    if (componentSearchShortcut) {
        const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
        componentSearchShortcut.textContent = isMac ? '⌘K' : 'Ctrl K';
    }

    componentSearchInput.addEventListener('input', filterComponentList);

    componentSearchInput.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (componentSearchInput.value) {
                componentSearchInput.value = '';
                filterComponentList();
            } else {
                componentSearchInput.blur();
            }
        }
    });

    if (componentSearchClear) {
        componentSearchClear.addEventListener('click', () => {
            componentSearchInput.value = '';
            filterComponentList();
            componentSearchInput.focus();
        });
    }

    document.addEventListener('keydown', e => {
        const isSearchShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
        if (!isSearchShortcut) return;
        e.preventDefault();
        focusComponentSearch();
    });

    updateComponentSearchControls();

    // 绑定各类全局事件
    bindPropEvents();
    bindCanvasEvents();
    bindPreviewEvents();

    // 通过 URL 参数加载指定的模板数据（模拟后端数据加载逻辑）
    const urlParams = new URLSearchParams(window.location.search);
    const tplParam = urlParams.get('tpl');
    
    if (tplParam === 'kyc-individual') {
        loadSchema(kycIndividualTemplate);
        setActiveTemplate('kyc-individual');
    } else if (tplParam === 'kyc-entity') {
        loadSchema(kycEntityTemplate);
        setActiveTemplate('kyc-entity');
    } else {
        // 从后端接口加载最新保存的模板
        try {
            const response = await FormAPI.getTemplate('default');
            if (response.success && response.data.schema && response.data.schema.pages && response.data.schema.pages.length > 0) {
                loadSchema(response.data.schema);
                setActiveTemplate('saved');
            } else {
                initPages();
                checkEmptyState();
                setActiveTemplate('blank');
                setTimeout(() => establishBaseline(), 100);
            }
        } catch (e) {
            console.error('加载模板失败', e);
            initPages();
            checkEmptyState();
            setActiveTemplate('blank');
            setTimeout(() => establishBaseline(), 100);
        }
    }
    
    // 监听属性面板表单更改，标记为未保存
    document.addEventListener('input', (e) => {
        if (e.target.closest('#prop-editor, #page-prop-editor, .canvas-element, .page-title-input, .page-desc-input')) {
            markDirty();
        }
    });
    document.addEventListener('change', (e) => {
        if (e.target.closest('#prop-editor, #page-prop-editor, .canvas-element, .page-title-input, .page-desc-input')) {
            markDirty();
        }
    });
    document.addEventListener('schemachange', () => markDirty());

    // 如果未保存，刷新或离开页面时进行拦截提示
    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '您有未保存的更改，确定要离开吗？';
        }
    });
    


    // 右键菜单逻辑
    const contextMenu = document.getElementById('canvas-context-menu');
    const canvasArea = document.getElementById('canvas-scroll-area');
    const deletePageBtn = document.getElementById('menu-btn-delete-page');
    let contextMenuTargetPageId = null;
    
    // 监听画布背景的右键事件
    canvasArea.addEventListener('contextmenu', (e) => {
        // 阻止系统默认右键菜单
        e.preventDefault();

        // 查找是否点击在特定的画布页面上
        const dropzoneNode = e.target.closest('.canvas-dropzone');
        const frameNode = e.target.closest('.mobile-frame');
        
        let pageId = null;
        if (dropzoneNode) {
            pageId = dropzoneNode.dataset.pageId;
        } else if (frameNode) {
            const idMatch = frameNode.id && frameNode.id.replace('frame_', '');
            if (idMatch) pageId = idMatch;
        }
        
        const newPageBtnText = document.querySelector('#menu-btn-new-page span');
        
        if (pageId) {
            contextMenuTargetPageId = pageId;
            deletePageBtn.classList.remove('hidden');
            if (newPageBtnText) newPageBtnText.textContent = "在当前画布后方插入";
        } else {
            contextMenuTargetPageId = null;
            deletePageBtn.classList.add('hidden');
            if (newPageBtnText) newPageBtnText.textContent = "新建画布页面";
        }
        
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
        addPage(contextMenuTargetPageId);
        contextMenu.classList.add('hidden');
    });

    document.getElementById('menu-btn-reset-view').addEventListener('click', () => {
        resetCanvasView();
        contextMenu.classList.add('hidden');
    });

    deletePageBtn.addEventListener('click', () => {
        if (contextMenuTargetPageId) {
            requestDeletePage(contextMenuTargetPageId);
        }
        contextMenu.classList.add('hidden');
    });
}

// 启动应用
bootstrap();
