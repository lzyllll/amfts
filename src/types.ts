/**
 * AMF 类型定义模块
 *
 * 本模块定义了 AMF0 和 AMF3 协议中所有的数据类型
 * AMF (Action Message Format) 是 Adobe 开发的一种二进制数据序列化格式
 * 主要用于 Flash/Flex 应用与服务器之间的数据交换
 */

import { ForcedTypeValue, Serializable, Externalizable } from './classes';

/**
 * AMF 类型基类
 *
 * 每种 AMF 数据类型都由这个类的实例表示
 * 包含类型的 ID、名称、是否可引用等信息
 * 以及编码和解码的方法
 */
export class AMFType {
    /** 类型的数字标识符 */
    public id: number;

    /** 类型的名称（用于调试和错误信息） */
    public name: string;

    /**
     * 是否可引用
     * 某些复杂类型（如对象、数组）在 AMF 中可以被引用
     * 以避免重复序列化相同的对象
     */
    public referencable: boolean;

    /**
     * 编码函数
     * 由具体的类型实现设置
     * this 上下文指向 AMFEncoder 实例
     */
    public encode: (this: any, value: any) => void = () => {
        throw new Error(`没有为类型 ${this.name} 定义编码器`);
    };

    /**
     * 解码函数
     * 由具体的类型实现设置
     * this 上下文指向 AMFDecoder 实例
     */
    public decode: (this: any) => any = () => {
        throw new Error(`没有为类型 ${this.name} 定义解码器`);
    };

    /**
     * 创建一个新的 AMF 类型
     *
     * @param id - 类型的数字标识符
     * @param name - 类型的名称
     * @param referencable - 是否可引用，默认为 false
     */
    constructor(id: number, name: string, referencable: boolean = false) {
        this.id = id;
        this.name = name;
        this.referencable = referencable;
    }
}

/**
 * AMF0 类型定义
 *
 * AMF0 是 AMF 协议的第一个版本
 * 支持基本的数据类型如数字、字符串、对象、数组等
 */
export const AMF0 = {
    /**
     * 根据 JavaScript 值推断对应的 AMF0 类型
     *
     * @param value - 要推断类型的值
     * @returns 对应的 AMF0 类型
     * @throws 如果无法推断类型则抛出错误
     */
    infer(value: any): AMFType {
        const type = typeof value;

        // null 类型
        if (value === null) {
            return AMF0.NULL;
        }

        // undefined 类型
        if (type === 'undefined') {
            return AMF0.UNDEFINED;
        }

        // 强制类型值 - 使用用户指定的类型
        if (value instanceof ForcedTypeValue) {
            return value.type;
        }

        // 数字类型
        if (type === 'number') {
            return AMF0.NUMBER;
        }

        // 布尔类型
        if (type === 'boolean') {
            return AMF0.BOOLEAN;
        }

        // 长字符串（超过 65535 字节）
        if (type === 'string' && value.length >= 0xFFFF) {
            return AMF0.LONG_STRING;
        }

        // 普通字符串
        if (type === 'string') {
            return AMF0.STRING;
        }

        // 日期类型
        if (Object.prototype.toString.call(value) === '[object Date]') {
            return AMF0.DATE;
        }

        // 数组类型
        if (value instanceof Array) {
            return AMF0.STRICT_ARRAY;
        }

        // 可序列化对象（有类名）
        if (value instanceof Serializable) {
            if (!value.__class || value.__class === '') {
                return AMF0.OBJECT;
            }
            return AMF0.TYPED_OBJECT;
        }

        // 普通对象（作为 ECMA 数组处理）
        if (type === 'object') {
            return AMF0.ECMA_ARRAY;
        }

        throw new Error(`无法推断值的 AMF0 类型: ${JSON.stringify(value)}`);
    },

    /**
     * 根据类型 ID 获取对应的 AMF0 类型
     *
     * @param id - 类型的数字标识符
     * @returns 对应的 AMF0 类型
     * @throws 如果找不到对应的类型则抛出错误
     */
    fromId(id: number): AMFType {
        for (const key of Object.keys(AMF0)) {
            const type = (AMF0 as any)[key];
            if (type instanceof AMFType && type.id === id) {
                return type;
            }
        }
        throw new Error(`没有 ID 为 ${id} 的 AMF0 类型`);
    },

    /** 数字类型 (0x00) - 64位双精度浮点数 */
    NUMBER: new AMFType(0x00, 'NUMBER'),

    /** 布尔类型 (0x01) */
    BOOLEAN: new AMFType(0x01, 'BOOLEAN'),

    /** 字符串类型 (0x02) - 最大 65535 字节 */
    STRING: new AMFType(0x02, 'STRING'),

    /** 对象类型 (0x03) - 匿名对象 */
    OBJECT: new AMFType(0x03, 'OBJECT', true),

    /** MovieClip 类型 (0x04) - Flash 专用，通常不使用 */
    MOVIECLIP: new AMFType(0x04, 'MOVIECLIP'),

    /** 空值类型 (0x05) */
    NULL: new AMFType(0x05, 'NULL'),

    /** 未定义类型 (0x06) */
    UNDEFINED: new AMFType(0x06, 'UNDEFINED'),

    /** 引用类型 (0x07) - 引用之前序列化的对象 */
    REFERENCE: new AMFType(0x07, 'REFERENCE'),

    /** ECMA 数组类型 (0x08) - 关联数组/对象 */
    ECMA_ARRAY: new AMFType(0x08, 'ECMA_ARRAY', true),

    /** 对象结束标记 (0x09) */
    OBJECT_END: new AMFType(0x09, 'OBJECT_END'),

    /** 严格数组类型 (0x0A) - 数字索引数组 */
    STRICT_ARRAY: new AMFType(0x0A, 'STRICT_ARRAY', true),

    /** 日期类型 (0x0B) */
    DATE: new AMFType(0x0B, 'DATE'),

    /** 长字符串类型 (0x0C) - 超过 65535 字节的字符串 */
    LONG_STRING: new AMFType(0x0C, 'LONG_STRING'),

    /** 不支持的类型 (0x0D) */
    UNSUPPORTED: new AMFType(0x0D, 'UNSUPPORTED'),

    /** XML 类型 (0x0F) */
    XML: new AMFType(0x0F, 'XML'),

    /** 类型化对象 (0x10) - 有类名的对象 */
    TYPED_OBJECT: new AMFType(0x10, 'TYPED_OBJECT', true),

    /** AMF3 对象标记 (0x11) - 表示后续数据使用 AMF3 格式 */
    AMF3_OBJECT: new AMFType(0x11, 'AMF3_OBJECT')
};

/**
 * AMF3 类型定义
 *
 * AMF3 是 AMF 协议的第三个版本（跳过了 AMF2）
 * 相比 AMF0，它更加紧凑，支持更多的数据类型
 * 包括字节数组、向量等
 */
export const AMF3 = {
    /**
     * 根据 JavaScript 值推断对应的 AMF3 类型
     *
     * @param value - 要推断类型的值
     * @returns 对应的 AMF3 类型
     * @throws 如果无法推断类型则抛出错误
     */
    infer(value: any): AMFType {
        const type = typeof value;

        // null 类型
        if (value === null) {
            return AMF3.NULL;
        }

        // undefined 类型
        if (type === 'undefined') {
            return AMF3.UNDEFINED;
        }

        // 强制类型值 - 使用用户指定的类型
        if (value instanceof ForcedTypeValue) {
            return value.type;
        }

        // 布尔类型 - AMF3 中 true 和 false 是不同的类型
        if (type === 'boolean' && !value) {
            return AMF3.FALSE;
        }
        if (type === 'boolean') {
            return AMF3.TRUE;
        }

        // 字符串类型
        if (type === 'string') {
            return AMF3.STRING;
        }

        // 整数类型（29位有符号整数范围内）
        // AMF3 INTEGER 范围: -268435456 到 536870911
        if (type === 'number'
            && isFinite(value)
            && value % 1 === 0
            && value < 536870911
            && value > -268435456) {
            return AMF3.INTEGER;
        }

        // 双精度浮点数
        if (type === 'number') {
            return AMF3.DOUBLE;
        }

        // 日期类型
        if (Object.prototype.toString.call(value) === '[object Date]') {
            return AMF3.DATE;
        }

        // 字节数组（Uint8Array 在浏览器中替代 Node.js 的 Buffer）
        if (value instanceof Uint8Array) {
            return AMF3.BYTE_ARRAY;
        }

        // 数组类型
        if (value instanceof Array) {
            return AMF3.ARRAY;
        }

        // 可序列化对象或可外部化对象
        if (value instanceof Serializable || value instanceof Externalizable) {
            return AMF3.OBJECT;
        }

        // 普通对象（作为关联数组处理）
        if (type === 'object') {
            return AMF3.ARRAY;
        }

        throw new Error(`无法推断值的 AMF3 类型: ${JSON.stringify(value)}`);
    },

    /**
     * 根据类型 ID 获取对应的 AMF3 类型
     *
     * @param id - 类型的数字标识符
     * @returns 对应的 AMF3 类型
     * @throws 如果找不到对应的类型则抛出错误
     */
    fromId(id: number): AMFType {
        for (const key of Object.keys(AMF3)) {
            const type = (AMF3 as any)[key];
            if (type instanceof AMFType && type.id === id) {
                return type;
            }
        }
        throw new Error(`没有 ID 为 ${id} 的 AMF3 类型`);
    },

    /** 未定义类型 (0x00) */
    UNDEFINED: new AMFType(0x00, 'UNDEFINED'),

    /** 空值类型 (0x01) */
    NULL: new AMFType(0x01, 'NULL'),

    /** 布尔假值 (0x02) */
    FALSE: new AMFType(0x02, 'FALSE'),

    /** 布尔真值 (0x03) */
    TRUE: new AMFType(0x03, 'TRUE'),

    /** 整数类型 (0x04) - 29位有符号整数 */
    INTEGER: new AMFType(0x04, 'INTEGER'),

    /** 双精度浮点数类型 (0x05) */
    DOUBLE: new AMFType(0x05, 'DOUBLE'),

    /** 字符串类型 (0x06) */
    STRING: new AMFType(0x06, 'STRING', true),

    /** XML 文档类型 (0x07) */
    XML_DOC: new AMFType(0x07, 'XML_DOC', true),

    /** 日期类型 (0x08) */
    DATE: new AMFType(0x08, 'DATE', true),

    /** 数组类型 (0x09) */
    ARRAY: new AMFType(0x09, 'ARRAY', true),

    /** 对象类型 (0x0A) */
    OBJECT: new AMFType(0x0A, 'OBJECT', true),

    /** XML 类型 (0x0B) */
    XML: new AMFType(0x0B, 'XML', true),

    /** 字节数组类型 (0x0C) */
    BYTE_ARRAY: new AMFType(0x0C, 'BYTE_ARRAY', true),

    /** 整数向量类型 (0x0D) */
    VECTOR_INT: new AMFType(0x0D, 'VECTOR_INT', true),

    /** 无符号整数向量类型 (0x0E) */
    VECTOR_UINT: new AMFType(0x0E, 'VECTOR_UINT', true),

    /** 双精度浮点数向量类型 (0x0F) */
    VECTOR_DOUBLE: new AMFType(0x0F, 'VECTOR_DOUBLE', true),

    /** 对象向量类型 (0x10) */
    VECTOR_OBJECT: new AMFType(0x10, 'VECTOR_OBJECT', true),

    /** 字典类型 (0x11) */
    DICTIONARY: new AMFType(0x11, 'DICTIONARY', true)
};
