// 全局状态管理对象，保存了构建器运行时的各类状态数据
export const state = {
    // 用于生成唯一ID的自增计数器
    uniqueIdCounter: 1,
    // 当前在画布中被选中的元素
    selectedElement: null,
    // 表单的所有页面数据集合
    pages: [],
    // 当前激活或显示的页面ID
    currentPageId: null,
    // 画布的视图状态（包含平移坐标和缩放比例）
    canvasState: {
        x: 320,
        y: 160,
        scale: 1
    },
    // 标记是否为首次聚焦
    isFirstFocus: true,
    // 标记当前是否正在平移画布
    isPanning: false,
    // 标记当前是否正在拖拽页面面板(Frame)
    isDraggingFrame: false,
    // 当前正在拖拽的页面面板(Frame)ID
    draggedFrameId: null,
    // 记录页面面板拖拽起点的X坐标
    frameStartX: 0,
    // 记录页面面板拖拽起点的Y坐标
    frameStartY: 0,
    // 记录画布平移起点的鼠标X坐标
    panStartX: 0,
    // 记录画布平移起点的鼠标Y坐标
    panStartY: 0,
    // 记录画布平移起点的画布X坐标
    panStartCanvasX: 0,
    // 记录画布平移起点的画布Y坐标
    panStartCanvasY: 0,
    // 标记空格键是否被按下（通常用于激活画布平移）
    isSpacePressed: false,
    
    // ================= 连线逻辑状态 =================
    // 页面连线关系数据：[{ id: 'conn_1', sourcePageId: 'page_1', targetPageId: 'page_2' }]
    pageConnections: [],
    // 标记当前是否正在绘制临时连线
    isDrawingConnection: false,
    // 连线起点的页面ID
    connectionSourcePageId: null,
    // 当前鼠标的临时坐标 (用于绘制临时连线)
    connectionTempX: 0,
    connectionTempY: 0
};

// 设置当前选中的画布元素
export function setSelectedElement(el) {
    state.selectedElement = el;
}

// 获取全局唯一的自增ID
export function getUniqueId() {
    return state.uniqueIdCounter++;
}

// 更新表单页面集合数据
export function setPages(newPages) {
    state.pages = newPages;
}
