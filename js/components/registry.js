// 定义包含预设选项的组件类型，如单选、多选、下拉等
export const optionTypes = ['select', 'country', 'nationality', 'radio', 'checkbox', 'signature'];
// 定义可以输入或选择具体值的组件类型
export const valueTypes = ['input', 'textarea', 'date'];

// 默认的国家选择下拉列表数据，包含一些常用国家的标签和对应的值
export const defaultCountryOptions = [
    { label: '中国 (China)', value: 'CN' },
    { label: '美国 (United States)', value: 'US' },
    { label: '英国 (United Kingdom)', value: 'GB' },
    { label: '日本 (Japan)', value: 'JP' },
    { label: '韩国 (South Korea)', value: 'KR' },
    { label: '法国 (France)', value: 'FR' },
    { label: '德国 (Germany)', value: 'DE' },
    { label: '澳大利亚 (Australia)', value: 'AU' },
    { label: '加拿大 (Canada)', value: 'CA' },
    { label: '新加坡 (Singapore)', value: 'SG' },
    { label: '其他 (Other)', value: 'OTHER' }
];

// 默认的国籍选择下拉列表数据，类似于国家选项，但用于国籍字段
export const defaultNationalityOptions = [
    { label: '中国籍', value: 'CN' },
    { label: '美国籍', value: 'US' },
    { label: '英国籍', value: 'GB' },
    { label: '日本籍', value: 'JP' },
    { label: '韩国籍', value: 'KR' },
    { label: '法国籍', value: 'FR' },
    { label: '德国籍', value: 'DE' },
    { label: '澳大利亚籍', value: 'AU' },
    { label: '加拿大籍', value: 'CA' },
    { label: '新加坡籍', value: 'SG' },
    { label: '其他', value: 'OTHER' }
];
