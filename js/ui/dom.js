// 获取各个UI组件对应的DOM元素节点，集中管理方便后续调用

// 属性编辑区域的 DOM 节点
export const propEditor = document.getElementById('prop-editor');
export const propEmpty = document.getElementById('prop-empty');
export const propIdText = document.getElementById('prop-id');
export const inputLabel = document.getElementById('prop-label-input');
export const inputKey = document.getElementById('prop-key-input');
export const inputPlaceholder = document.getElementById('prop-placeholder-input');
export const inputHelp = document.getElementById('prop-help-input');
export const inputDefault = document.getElementById('prop-default-input');
export const selectDefault = document.getElementById('prop-default-select');
export const checkboxDefaultGroup = document.getElementById('prop-default-checkbox-group');
export const toggleRequired = document.getElementById('prop-required-toggle');
export const propTypeBadge = document.getElementById('prop-type-badge');

// 属性面板中的各个设置组容器
export const propPlaceholderGroup = document.getElementById('prop-placeholder-group');
export const propDateTypeGroup = document.getElementById('prop-date-type-group');
export const propDateTypeSelect = document.getElementById('prop-date-type-select');
export const propHelpGroup = document.getElementById('prop-help-group');
export const propDefaultGroup = document.getElementById('prop-default-group');

// 选项管理区域及按钮
export const propOptionsGroup = document.getElementById('prop-options-group');
export const optionsEditor = document.getElementById('options-editor');
export const addOptionBtn = document.getElementById('add-option-btn');

// 排布与选择数量限制相关
export const propLayoutGroup = document.getElementById('prop-layout-group');
export const propLayoutSelect = document.getElementById('prop-layout-select');
export const propMaxSelectionsGroup = document.getElementById('prop-max-selections-group');
export const inputMaxSelections = document.getElementById('prop-max-selections-input');

// 页面选项卡相关 DOM 节点
export const canvasPagesContainer = document.getElementById('canvas-pages-container');
export const pageTabsList = document.getElementById('page-tabs-list');
export const addPageBtn = document.getElementById('add-page-btn');

// 预览弹窗相关 DOM 节点
export const previewModal = document.getElementById('preview-modal');
export const previewModalTitle = document.getElementById('preview-modal-title');
export const previewModalSubtitle = document.getElementById('preview-modal-subtitle');
export const previewFormTitle = document.getElementById('preview-form-title');
export const previewFormDesc = document.getElementById('preview-form-desc');
export const previewFormBody = document.getElementById('preview-form-body');

// 导出 Schema 及画布相关 DOM 节点
export const schemaOutput = document.getElementById('schema-output');
export const schemaFieldCount = document.getElementById('schema-field-count');
export const canvasScrollArea = document.getElementById('canvas-scroll-area');
export const canvasWorld = document.getElementById('canvas-world');
export const mobileFrame = document.getElementById('mobile-frame');
