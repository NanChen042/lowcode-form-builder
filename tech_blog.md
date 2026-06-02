# 低代码表单设计器项目源码解析

本文档记录了使用原生 JavaScript 实现低代码表单设计器的核心源码与模块实现。项目通过拖拽组件、配置属性，最终生成表单的 JSON 数据结构，完全使用原生 DOM API 构建。

## 一、 目录结构说明

项目按功能模块进行了目录拆分，主要结构如下：

```text
├── index.html            // 页面布局及组件的 <template> 模板库
├── app.css               // 全局 CSS 样式
└── js/
    ├── main.js           // 入口文件，负责事件总线绑定
    ├── core/
    │   ├── state.js      // 全局状态管理及历史记录（撤销/重做）
    │   └── schema.js     // 数据导出逻辑
    ├── components/
    │   ├── registry.js   // 组件物料的默认属性配置
    │   └── builder.js    // 读取模板生成真实 DOM 节点的工厂函数
    ├── ui/
    │   ├── canvas.js     // 画布区域逻辑（初始化、拖拽绑定、平移缩放）
    │   ├── properties.js // 属性面板逻辑（监听输入并同步 DOM）
    │   └── preview.js    // 代码与 JSON 预览模块
    └── utils/
        └── helpers.js    // 辅助工具（防抖、唯一 ID 生成等）
```

## 二、 核心数据模型

画布上的所有操作均会同步更新到统一的 JSON 数据模型中，核心状态定义在 `state.js`。

### 1. 数据结构
数据按页面划分，`pages` 数组存放各页面的基本属性及其包含的表单元素（`elements`）。

```javascript
// js/core/state.js
export const state = {
    pages: [
        {
            id: 'page_1',
            title: '第一页',
            description: '',
            elements: [] // 存放画布中的组件数据
        }
    ],
    selectedElement: null, // 当前在画布中被选中的 DOM 节点
    
    // 历史记录数组
    undoStack: [],
    redoStack: [],
    
    // 画布空间矩阵状态
    canvasState: { scale: 1, x: 0, y: 0 },
    isPanning: false
};
```

## 三、 画布初始化与基本事件

画布的交互由 `js/ui/canvas.js` 处理。主要包含多页面的初始化、选中元素的高亮控制。

### 1. 页面初始化
读取 `state.pages` 数据，并为每一个 page 生成对应的容器节点。

```javascript
// js/ui/canvas.js
export function initPages() {
    DOM.canvasInner.innerHTML = ''; // 清空画布
    
    state.pages.forEach((page, index) => {
        // 通过克隆 <template id="tpl-page-frame"> 创建页面框架
        const template = document.getElementById('tpl-page-frame');
        const frame = template.content.cloneNode(true).firstElementChild;
        frame.id = 'frame_' + page.id;
        
        // 绑定该页面的基础数据
        frame.dataset.title = page.title || `第 ${index + 1} 页`;
        frame.dataset.description = page.description || '';
        
        DOM.canvasInner.appendChild(frame);
        
        // 获取该页面内部的组件接收区，并初始化拖拽能力
        const dropzone = frame.querySelector('.canvas-dropzone');
        dropzone.id = page.id;
        initDropzone(dropzone);
    });
}
```

### 2. 元素选中控制
点击画布内的组件时，需要为其增加高亮样式，并通知属性面板更新数据。

```javascript
// js/ui/canvas.js
export function selectElement(element) {
    if (!element) return;
    
    // 1. 移除全局其他元素的选中状态
    clearSelection();
    
    // 2. 更新选中状态记录
    state.selectedElement = element;
    
    // 3. 区分大画布和普通表单组件，添加对应的高亮 CSS 类名
    if (element.classList.contains('mobile-frame')) {
        element.classList.add('ring-2', 'ring-[#1677ff]', 'ring-offset-4');
    } else {
        element.classList.add('is-selected');
    }
    
    // 4. 调用属性面板的更新方法
    updatePropPanel(element);
}

export function clearSelection() {
    // 移除各类高亮类名
    document.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
    document.querySelectorAll('.mobile-frame').forEach(f => {
        f.classList.remove('ring-2', 'ring-[#1677ff]', 'ring-offset-4');
    });
    state.selectedElement = null;
    
    // 通知属性面板展示空状态
    updatePropPanel(null);
}

## 四、 拖拽引擎实现

表单画布的拖拽依赖 `Sortable.js` 库。系统将拖拽行为分为“物料区克隆”与“画布区排序嵌套”两部分。

### 1. 画布接收区逻辑
当组件从物料区拖入画布时，会触发 `onAdd` 生命周期。在此过程中，必须将基础的拖拽 DOM 节点替换为真实的表单组件。

```javascript
// js/ui/canvas.js
export function initDropzone(dropzoneEl) {
    Sortable.create(dropzoneEl, {
        group: { name: 'shared', pull: true, put: true },
        animation: 150,
        fallbackOnBody: true, // 防止拖拽幽灵被遮挡
        onAdd: function(evt) {
            const item = evt.item;
            const type = item.dataset.type;
            
            // 1. 获取对应的真实 DOM 节点
            const newEl = createComponentDOM(type);
            
            // 2. 暂时关闭 CSS transition 以防止闪烁变形
            item.style.transition = 'none';
            
            // 3. 替换 DOM 结构与 ID
            item.innerHTML = newEl.innerHTML;
            item.className = newEl.className;
            item.id = newEl.id;
            
            // 4. 强制引发浏览器重排 (Reflow)
            void item.offsetHeight;
            
            // 5. 恢复动画属性
            item.style.transition = '';
            
            // 6. 如果是栅格布局容器，递归绑定拖拽能力
            if (type === 'grid') {
                item.querySelectorAll('.nested-dropzone').forEach(zone => {
                    initDropzone(zone);
                });
            }
            
            // 7. 保存到历史快照
            saveHistoryState();
        }
    });
}
```

## 五、 无限嵌套布局实现

表单中常需要双列或多列栅格布局（Grid）。在 `initDropzone` 函数中，通过检测拖入的组件类型是否为 `grid`，来决定是否递归执行初始化逻辑。

```javascript
// 递归判断并初始化嵌套容器
if (type === 'grid') {
    const zones = newEl.querySelectorAll('.nested-dropzone');
    zones.forEach(zone => initDropzone(zone));
}
```
这种递归结构允许栅格内部嵌套新的栅格，通过同样的 `shared` 分组，实现了无限层级的拖拽。

## 六、 动态组件模板克隆

所有的具体组件 DOM 骨架预先定义在 `index.html` 的 `<template>` 标签中。生成组件时直接深拷贝该节点，避免在 JS 中拼接 HTML 字符串。

```javascript
// js/components/builder.js
export function createComponentDOM(type) {
    const template = document.getElementById(`tpl-${type}`);
    if (!template) return null;

    // cloneNode(true) 实现深拷贝
    const rootDiv = template.content.cloneNode(true).firstElementChild;
    rootDiv.dataset.type = type;
    rootDiv.id = `cmp_${Date.now()}`; // 实际采用全局自增唯一 ID

    // 读取默认配置 (如 label、placeholder) 注入 DOM
    const defaultData = componentDefaults[type];
    Object.keys(defaultData).forEach(key => {
        rootDiv.dataset[key] = defaultData[key];
    });

    return rootDiv;
}
```

## 七、 右侧面板数据联动

当用户在画布中选中某个组件后，右侧属性面板展示对应数据。用户在输入框中修改配置时，需要实时同步回画布中的 DOM 节点。

### 1. 局部事件代理更新 DOM
为了提升性能，采用局部事件代理，仅替换对应文本节点，保留其他 HTML 结构（如必填标志的红色星号）。

```javascript
// js/ui/properties.js
DOM.inputLabel.addEventListener('input', e => {
    if (!state.selectedElement) return;
    
    // 1. 写入内存数据
    state.selectedElement.dataset.label = e.target.value;
    
    // 2. 定点查询画布内被选中元素的对应节点
    const labelNode = state.selectedElement.querySelector('.component-label');
    if (labelNode) {
        const star = labelNode.querySelector('.req-star');
        // 更新文本内容
        labelNode.textContent = e.target.value + ' ';
        // 将星号节点重新挂载
        if (star) labelNode.appendChild(star);
    }
});
```

### 2. 虚拟焦点高亮机制
当属性面板输入框获得焦点时，左侧画布内相应的精确元素会高亮，以便用户明确当前编辑的目标。

```javascript
// ui/properties.js
const bindVirtualFocus = (propInput, selector) => {
    propInput.addEventListener('focus', () => {
        if (!state.selectedElement) return;
        const target = state.selectedElement.querySelector(selector);
        if (target) target.classList.add('virtual-focus'); // 添加高亮类名
    });
    
    propInput.addEventListener('blur', () => {
        if (!state.selectedElement) return;
        const target = state.selectedElement.querySelector(selector);
        if (target) target.classList.remove('virtual-focus');
    });
};

// 实际绑定逻辑
bindVirtualFocus(DOM.inputLabel, '.label-text');
bindVirtualFocus(DOM.inputHelp, '.field-help');
```

## 八、 画布的平移与缩放控制

作为一个无边界的设计器，画布需要支持平移（Pan）与缩放（Zoom）。在原生 JS 中，这通过修改外层容器的 CSS `transform` 矩阵来实现。为了避免频繁重绘导致的卡顿，使用了 `requestAnimationFrame` 进行节流。

```javascript
// ui/canvas.js
document.addEventListener('mousemove', e => {
    if (state.isPanning) {
        e.preventDefault();
        
        // 计算鼠标当前位置与起始位置的差值
        state.canvasState.x = state.panStartCanvasX + (e.clientX - state.panStartX);
        state.canvasState.y = state.panStartCanvasY + (e.clientY - state.panStartY);
        
        // 保证样式更新在浏览器的最佳渲染帧执行
        requestAnimationFrame(() => {
            DOM.canvasInner.style.transform = `
                translate(${state.canvasState.x}px, ${state.canvasState.y}px) 
                scale(${state.canvasState.scale})
            `;
        });
    }
});
```
滚轮缩放同理，通过监听 `wheel` 事件增减 `state.canvasState.scale` 的值，并限制在 `0.25` 到 `2.0` 的合理范围内。

## 九、 组件物料注册表 (Registry)

在添加诸如“国家选择”、“单选框”等复杂组件时，它们可能带有预设的选项数组。系统通过统一的物料注册表进行管理，实现了代码配置的分离。

```javascript
// components/registry.js
export const componentDefaults = {
    input: {
        label: '单行文本',
        placeholder: '请输入内容',
        help: '',
        defaultValue: ''
    },
    radio: {
        label: '单选框组',
        help: '',
        defaultValue: 'option_1',
        layout: 'inline',
        options: [
            { label: '选项一', value: 'option_1' },
            { label: '选项二', value: 'option_2' }
        ]
    }
    // ... 可以通过追加对象无限扩展新物料
};
```
这个注册表不仅为 `createComponentDOM` 提供了挂载依据，也被导出逻辑读取。

## 十、 表单代码反编译 (Code Generation)

低代码引擎最终需要输出代码供研发使用。本项目实现了一个简易的代码生成器，通过递归遍历 `state.pages` 数据模型，生成标准的 UI 代码片段。

```javascript
// ui/preview.js
function buildReactComponentCode(schema) {
    let code = `import React, { useState } from 'react';\n\n`;
    code += `export default function DynamicForm() {\n`;
    code += `  const [formData, setFormData] = useState({});\n\n`;
    code += `  const handleSubmit = (e) => { e.preventDefault(); console.log(formData); };\n\n`;
    code += `  return (\n    <form onSubmit={handleSubmit} className="form-container">\n`;
    
    // 遍历每一个画布 / 页面
    schema.pages.forEach(page => {
        code += `      <div className="form-page-card" id="${page.id}">\n`;
        code += `        <h2>${page.title}</h2>\n`;
        
        // 遍历页面内的所有组件
        page.elements.forEach(elementData => {
            code += generateJSXForElement(elementData);
        });
        
        code += `      </div>\n`;
    });
    
    code += `      <button type="submit">Submit</button>\n`;
    code += `    </form>\n  );\n}\n`;
    
    return code;
}

// 根据 type 拼接具体的输入框 JSX
function generateJSXForElement(elData) {
    if (elData.type === 'input') {
        return `
        <div className="form-item">
            <label>${elData.label}</label>
            <input 
               type="text" 
               placeholder="${elData.placeholder}"
               onChange={(e) => setFormData({...formData, ${elData.key}: e.target.value})}
            />
        </div>\n`;
    }
    // ... 补充其他类型
    return '';
}
```

通过这一层转换逻辑，复杂的树状 JSON 即可输出为便于开发人员直接复制使用的前端源码，至此完成了从“可视化拖拽”到“最终代码生产”的闭环。

## 十一、 项目后续发展与优化路线

目前项目已实现了基础的拖拽搭建与代码导出逻辑，但距离完善的工业级低代码引擎仍有优化空间。后续的开发路线将围绕以下几个方向展开：

### 1. 状态管理引擎优化 (Diff 算法)
当前的撤销/重做逻辑采用的是基于 `JSON.parse(JSON.stringify())` 的全量深拷贝快照机制。虽然在数据量较小且配合 `<template>` 的前提下性能尚可，但当表单结构达到数千个节点时，内存占用会明显增加。后续计划引入类似 Immutable 数据结构或实现简易的 Diff 算法，仅保存操作路径上的增量差异（Patch），以降低内存开销。

### 2. 组件联动与逻辑编排 (Logic Flow)
目前的表单组件之间是彼此独立的。下一步将引入规则引擎（Rule Engine），支持组件间的值联动（Value Linkage）与显隐控制。例如：当“国家选择”选中“中国”时，“省市联动组件”才显示。这需要在 `schema` 中定义 `dependencies` 或 `expressions` 字段，并在核心引擎层增加表达式解析模块。

### 3. 动态数据源接入 (Remote Data Source)
类似下拉选择框、单选框的选项数据，目前配置为静态数组。后续需要支持绑定远程 API，允许配置请求 URL、Params 和 Response 解析路径，在画布预览和最终代码生成时，能够通过异步请求动态拉取渲染数据。

### 4. 插件化自定义物料 (Custom Plugin System)
目前的所有组件在 `index.html` 的 `<template>` 中写死。后续计划开发插件注入系统，允许开发者遵循特定规范编写独立的 `.js` 或 `.html` 组件包，通过全局方法 `window.LowcodeEngine.registerComponent()` 在运行时动态将自定义业务组件注入到左侧物料区中。

---

*(文档结束)*
