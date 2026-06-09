// 空白画布模板
export const blankTemplate = {
    schemaVersion: '1.0.0',
    meta: {
        title: '未命名的表单',
        description: '请在这里输入表单的描述信息'
    },
    pages: [
        {
            title: '第 1 页',
            fields: []
        }
    ]
};

// 个人案例 - KYC 表单
export const kycIndividualTemplate = {
    schemaVersion: '1.0.0',
    meta: {
        title: '个人客户 KYC 调查表',
        description: '为遵守反洗钱相关法规，我们需要收集并核实您的个人基本信息。您的信息将被严格保密。'
    },
    pages: [
        {
            title: '第一部分：个人身份信息',
            fields: [
                { type: 'input', label: '全名', required: true, placeholder: '请填写与证件一致的姓名' },
                { type: 'grid', columns: [
                    { elements: [{ type: 'nationality', label: '国籍', required: true }] },
                    { elements: [{ type: 'date', label: '出生日期', required: true, dateType: 'date' }] }
                ]},
                { type: 'input', label: '证件号码', required: true, placeholder: '请输入身份证或护照号' },
                { type: 'textarea', label: '居住地址', required: true, placeholder: '请输入详细的当前居住地址' }
            ]
        },
        {
            title: '第二部分：职业与财务背景',
            fields: [
                { 
                    type: 'select', 
                    label: '就业状态',
                    required: true,
                    options: [
                        { label: '受雇', value: '受雇' },
                        { label: '自雇', value: '自雇' },
                        { label: '退休', value: '退休' },
                        { label: '无业', value: '无业' }
                    ]
                },
                { type: 'input', label: '资金来源', required: true, placeholder: '例如：工资、投资收益、储蓄' },
                { 
                    type: 'radio', 
                    label: '预计年收入',
                    layout: 'stack',
                    options: [
                        { label: '低于 50,000 美元', value: '低于 50,000 美元' },
                        { label: '50,000 - 100,000 美元', value: '50,000 - 100,000 美元' },
                        { label: '高于 100,000 美元', value: '高于 100,000 美元' }
                    ]
                }
            ]
        },
        {
            title: '第三部分：声明',
            fields: [
                { 
                    type: 'signature', 
                    label: '客户声明',
                    required: true,
                    options: [
                        { label: '本人特此声明，本表格中提供的所有信息均真实、完整且准确。', value: 'dec_1' },
                        { label: '本人已知悉并同意相关隐私政策和信息处理条款。', value: 'dec_2' }
                    ]
                }
            ]
        }
    ]
};

// 实体案例 - KYC 表单
export const kycEntityTemplate = {
    schemaVersion: '1.0.0',
    meta: {
        title: '企业/实体 KYC 调查表',
        description: '适用于机构客户、企业实体的尽职调查与合规审查。'
    },
    pages: [
        {
            title: '第一部分：公司基本信息',
            fields: [
                { type: 'input', label: '公司全称', required: true, placeholder: '请输入营业执照上的法定名称' },
                { type: 'grid', columns: [
                    { elements: [{ type: 'input', label: '注册号码', required: true }] },
                    { elements: [{ type: 'country', label: '注册国家', required: true }] }
                ]},
                { type: 'date', label: '成立日期', dateType: 'date' },
                { type: 'textarea', label: '注册地址', required: true }
            ]
        },
        {
            title: '第二部分：业务与合规',
            fields: [
                { type: 'textarea', label: '业务性质描述', required: true, placeholder: '请简述贵公司的主要产品、服务及运营模式' },
                { type: 'input', label: '主要财富来源', required: true, placeholder: '例如：商业运营、投资、外部融资' },
                { 
                    type: 'radio', 
                    label: '是否为受监管金融机构？',
                    layout: 'inline',
                    options: [
                        { label: '是', value: '是' },
                        { label: '否', value: '否' }
                    ]
                }
            ]
        },
        {
            title: '第三部分：授权代表声明',
            fields: [
                { type: 'input', label: '授权代表姓名', required: true },
                { type: 'input', label: '职务', required: true },
                { 
                    type: 'signature', 
                    label: '授权声明',
                    required: true,
                    options: [
                        { label: '本人经贵司充分授权，代表公司填写并提交此表。', value: 'dec_1' },
                        { label: '本人保证以上填写的所有企业信息真实、准确、无误。', value: 'dec_2' }
                    ]
                }
            ]
        }
    ]
};
