/**
 * 模拟后端接口服务 (Mock API Service)
 * 在没有真实后端的情况下，使用 Promise 和 setTimeout 模拟 AJAX 请求。
 * 后续有了真实后端，只需要修改这里的 fetch 逻辑即可。
 */

// 模拟网络延迟
const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

export const FormAPI = {
    /**
     * 保存表单模板到服务器
     * 对应接口: POST /api/v1/forms/template
     * @param {Object} schema - 表单 JSON Schema
     * @returns {Promise<Object>}
     */
    async saveTemplate(schema) {

        await delay(600); // 模拟 600ms 的网络请求
        
        // 模拟后端成功落库，为了演示刷新不丢失，暂时存在 localStorage 里作为 Mock DB
        localStorage.setItem('mock_db_schema', JSON.stringify(schema));
        
        return {
            code: 200,
            success: true,
            data: {
                id: 'form_' + Date.now(),
                updatedAt: new Date().toISOString()
            },
            message: '保存成功'
        };
    },

    /**
     * 获取已保存的表单模板
     * 对应接口: GET /api/v1/forms/template/:id
     * @param {string} id - 表单ID
     * @returns {Promise<Object>}
     */
    async getTemplate(id = 'default') {

        await delay(300); // 模拟网络加载
        
        // 从 Mock DB 中读取数据
        const localData = localStorage.getItem('mock_db_schema');
        const schema = localData ? JSON.parse(localData) : { fields: [] };
        
        return {
            code: 200,
            success: true,
            data: {
                id: id,
                schema: schema
            }
        };
    },
    
    /**
     * 正式发布表单
     * 对应接口: POST /api/v1/forms/publish
     * @param {Object} schema - 表单 JSON Schema
     * @returns {Promise<Object>}
     */
    async publishForm(schema) {

        await delay(800); // 发布可能需要更久
        
        return {
            code: 200,
            success: true,
            data: {
                url: `https://app.algocandy.com/forms/published_${Date.now()}`
            },
            message: '发布成功'
        };
    }
};
