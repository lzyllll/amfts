/**
 * AMF 辅助类模块
 *
 * 本模块定义了 AMF 序列化过程中使用的辅助类
 * 包括强制类型值、对象特征、可序列化对象和可外部化对象
 */

import type { AMFType } from './types.js';
import type { AMFEncoder } from './encoder.js';
import type { AMFDecoder } from './decoder.js';

/**
 * 强制类型值类
 *
 * 允许用户强制指定一个值应该被编码为特定的 AMF 类型
 * 而不是由编码器自动推断类型
 *
 * @example
 * ```typescript
 * // 强制将数字编码为 AMF3 的 DOUBLE 类型而不是 INTEGER
 * const forcedDouble = new ForcedTypeValue(42, AMF3.DOUBLE);
 * encoder.writeObject(forcedDouble);
 * ```
 */
export class ForcedTypeValue {
    /** 实际要编码的值 */
    public value: any;

    /** 强制使用的 AMF 类型 */
    public type: AMFType;

    /**
     * 创建一个强制类型值
     *
     * @param value - 实际要编码的值
     * @param type - 强制使用的 AMF 类型
     */
    constructor(value: any, type: AMFType) {
        this.value = value;
        this.type = type;
    }
}

/**
 * AMF3 对象特征类
 *
 * 用于描述 AMF3 对象的元数据信息
 * 包括类名、是否为动态对象、是否可外部化、以及静态字段列表
 *
 * 在 AMF3 中，对象特征可以被引用以减少数据大小
 * 当多个相同类型的对象被序列化时，只需要序列化一次特征信息
 */
export class AMFTrait {
    /** 对象的类名（可以为空表示匿名对象） */
    public name: string;

    /**
     * 是否为动态对象
     * 动态对象可以有任意的属性，而非动态对象只能有预定义的静态属性
     */
    public dynamic: boolean;

    /**
     * 是否可外部化
     * 可外部化对象需要自己控制序列化和反序列化过程
     */
    public externalizable: boolean;

    /** 静态字段名列表 */
    public staticFields: string[];

    /**
     * 创建一个 AMF3 对象特征
     *
     * @param name - 对象的类名
     * @param dynamic - 是否为动态对象
     * @param externalizable - 是否可外部化
     */
    constructor(name: string, dynamic: boolean, externalizable: boolean) {
        this.name = name;
        this.dynamic = dynamic;
        this.externalizable = externalizable;
        this.staticFields = [];
    }
}

/**
 * 可序列化对象基类
 *
 * JavaScript 对象或类如果想要被序列化为"命名对象"（带有类名的对象），
 * 应该继承这个类。
 *
 * 编码器会序列化对象的所有字段，除非：
 * 1. 字段名以双下划线（__）开头
 * 2. 对象定义了 getSerializableFields() 方法来指定要序列化的字段
 *
 * @example
 * ```typescript
 * class User extends Serializable {
 *     public name: string;
 *     public age: number;
 *     private __password: string; // 不会被序列化
 *
 *     constructor() {
 *         super('com.example.User');
 *         this.name = '';
 *         this.age = 0;
 *         this.__password = '';
 *     }
 * }
 * ```
 */
export class Serializable {
    /**
     * 对象的类名
     * 如果为空或未定义，对象将被视为匿名对象
     */
    public __class?: string;

    /**
     * 是否为动态对象
     * - true 或 undefined: 动态编码（key-value 交替写入）
     * - false: 静态编码（先写所有 key，再写所有 value）
     */
    public __dynamic?: boolean;

    /**
     * 创建一个可序列化对象
     *
     * @param serializableName - 对象的类名（可选）
     * @param dynamic - 是否为动态对象（可选，默认 true）
     */
    constructor(serializableName?: string, dynamic?: boolean) {
        this.__class = serializableName ?? '';
        this.__dynamic = dynamic ?? true;
    }

    /**
     * 获取应该被序列化的字段列表
     *
     * 子类可以覆盖此方法来控制哪些字段会被序列化
     * 注意：即使字段在此列表中，以双下划线开头的字段仍然会被忽略
     *
     * @returns 要序列化的字段名数组，如果返回 undefined 则序列化所有字段
     *
     * @example
     * ```typescript
     * getSerializableFields(): string[] {
     *     return ['name', 'age', 'email'];
     * }
     * ```
     */
    getSerializableFields?(): string[];
}

/**
 * 可外部化对象基类
 *
 * 继承此类的对象可以完全控制自己的序列化和反序列化过程。
 * 必须实现 write() 实例方法和 read() 静态方法。
 *
 * 可外部化对象需要通过 AMFDecoder.register() 注册，
 * 以便解码器知道如何反序列化它们。
 *
 * @example
 * ```typescript
 * class CustomData extends Externalizable {
 *     public data: Uint8Array;
 *
 *     constructor() {
 *         super('com.example.CustomData');
 *         this.data = new Uint8Array(0);
 *     }
 *
 *     // 自定义序列化
 *     write(encoder: AMFEncoder): void {
 *         encoder.writeObject(this.data.length);
 *         for (const byte of this.data) {
 *             encoder.writeObject(byte);
 *         }
 *     }
 *
 *     // 自定义反序列化（静态方法）
 *     static read(decoder: AMFDecoder): CustomData {
 *         const instance = new CustomData();
 *         const length = decoder.decode();
 *         instance.data = new Uint8Array(length);
 *         for (let i = 0; i < length; i++) {
 *             instance.data[i] = decoder.decode();
 *         }
 *         return instance;
 *     }
 * }
 * ```
 */
export class Externalizable extends Serializable {
    /**
     * 创建一个可外部化对象
     *
     * @param externalizableName - 对象的类名
     */
    constructor(externalizableName?: string) {
        super(externalizableName);
    }

    /**
     * 将对象写入编码器
     *
     * 子类必须覆盖此方法来实现自定义的序列化逻辑。
     * 写入的数据必须能够被对应的 read() 静态方法正确读取。
     *
     * @param encoder - AMF 编码器实例
     * @throws 如果子类没有实现此方法
     */
    write(encoder: AMFEncoder): void {
        throw new Error(`可外部化对象 ${this.__class} 没有定义 write 方法！`);
    }

    /**
     * 从解码器读取并创建对象实例
     *
     * 子类必须定义一个同名的静态方法来实现自定义的反序列化逻辑。
     * 此方法应该读取 write() 方法写入的数据并返回新的对象实例。
     *
     * 注意：这是一个静态方法，子类需要像这样定义：
     * static read(decoder: AMFDecoder): YourClass { ... }
     *
     * @param decoder - AMF 解码器实例
     * @returns 反序列化后的对象实例
     * @throws 如果子类没有实现此方法
     */
    static read(decoder: AMFDecoder): Externalizable {
        throw new Error('可外部化对象没有定义 read 方法！');
    }
}
