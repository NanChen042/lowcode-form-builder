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
                { type: 'input', label: '全名 (Full Name)', required: true, placeholder: '请填写与证件一致的姓名' },
                { type: 'grid', columns: [
                    { elements: [{ type: 'nationality', label: '国籍 (Nationality)', required: true }] },
                    { elements: [{ type: 'date', label: '出生日期 (Date of Birth)', required: true, dateType: 'date' }] }
                ]},
                { type: 'input', label: '证件号码 (ID/Passport No.)', required: true, placeholder: '请输入身份证或护照号' },
                { type: 'textarea', label: '居住地址 (Residential Address)', required: true, placeholder: '请输入详细的当前居住地址' }
            ]
        },
        {
            title: '第二部分：职业与财务背景',
            fields: [
                { 
                    type: 'select', 
                    label: '就业状态 (Employment Status)', 
                    required: true,
                    options: [
                        { label: '受雇 (Employed)', value: 'employed' },
                        { label: '自雇 (Self-employed)', value: 'self_employed' },
                        { label: '退休 (Retired)', value: 'retired' },
                        { label: '无业 (Unemployed)', value: 'unemployed' }
                    ]
                },
                { type: 'input', label: '资金来源 (Source of Funds)', required: true, placeholder: '例如：工资、投资收益、储蓄' },
                { 
                    type: 'radio', 
                    label: '预计年收入 (Estimated Annual Income)', 
                    layout: 'stack',
                    options: [
                        { label: '低于 $50,000', value: 'tier1' },
                        { label: '$50,000 - $100,000', value: 'tier2' },
                        { label: '高于 $100,000', value: 'tier3' }
                    ]
                }
            ]
        },
        {
            title: '第三部分：声明',
            fields: [
                { 
                    type: 'signature', 
                    label: '客户声明 (Declaration)', 
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
                { type: 'input', label: '公司全称 (Legal Entity Name)', required: true, placeholder: '请输入营业执照上的法定名称' },
                { type: 'grid', columns: [
                    { elements: [{ type: 'input', label: '注册号码 (Registration No.)', required: true }] },
                    { elements: [{ type: 'country', label: '注册国家 (Country of Incorporation)', required: true }] }
                ]},
                { type: 'date', label: '成立日期 (Date of Incorporation)', dateType: 'date' },
                { type: 'textarea', label: '注册地址 (Registered Address)', required: true }
            ]
        },
        {
            title: '第二部分：业务与合规',
            fields: [
                { type: 'textarea', label: '业务性质描述 (Nature of Business)', required: true, placeholder: '请简述贵公司的主要产品、服务及运营模式' },
                { type: 'input', label: '主要财富来源 (Source of Wealth)', required: true, placeholder: '例如：商业运营、投资、外部融资' },
                { 
                    type: 'radio', 
                    label: '是否为受监管金融机构？(Regulated FI)', 
                    layout: 'inline',
                    options: [
                        { label: '是 (Yes)', value: 'yes' },
                        { label: '否 (No)', value: 'no' }
                    ]
                }
            ]
        },
        {
            title: '第三部分：授权代表声明',
            fields: [
                { type: 'input', label: '授权代表姓名 (Authorized Representative)', required: true },
                { type: 'input', label: '职务 (Title)', required: true },
                { 
                    type: 'signature', 
                    label: '授权声明 (Declaration)', 
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

// 客户案例 - KYC 表单
export const kycClientTemplate = {
    schemaVersion: '1.0.0',
    meta: {
        title: '通用客户 KYC 建档表',
        description: '标准化客户 onboarding 流程模板，包含基础风险评估。'
    },
    pages: [
        {
            title: '第一步：账户设立',
            fields: [
                { 
                    type: 'radio', 
                    label: '账户类型 (Account Type)', 
                    required: true,
                    layout: 'inline',
                    options: [
                        { label: '个人账户', value: 'individual' },
                        { label: '机构账户', value: 'corporate' },
                        { label: '联名账户', value: 'joint' }
                    ]
                },
                { type: 'grid', columns: [
                    { elements: [{ type: 'input', label: '联系人邮箱', required: true }] },
                    { elements: [{ type: 'input', label: '联系电话', required: true }] }
                ]}
            ]
        },
        {
            title: '第二步：风险承受能力评估',
            fields: [
                { 
                    type: 'select', 
                    label: '您的投资经验', 
                    required: true,
                    options: [
                        { label: '无经验', value: 'none' },
                        { label: '1-3年', value: '1_3' },
                        { label: '3年以上', value: '3_plus' }
                    ]
                },
                { 
                    type: 'radio', 
                    label: '您的风险承受能力偏好', 
                    layout: 'stack',
                    options: [
                        { label: '保守型 (追求保本，无法承受亏损)', value: 'conservative' },
                        { label: '稳健型 (追求稳定增长，可承受轻微波动)', value: 'moderate' },
                        { label: '激进型 (追求高收益，可承受本金损失风险)', value: 'aggressive' }
                    ]
                }
            ]
        }
    ]
};
