/**
 * AMF3 解码器模块
 *
 * 仅实现 AMF3，并使用类方法进行分发解码（不依赖给类型对象动态挂方法）。
 * 全部基于浏览器可用的 Uint8Array / TextDecoder。
 */

import { AMFType } from './types';
import { AMFTrait, Serializable } from './classes';
import { Reader } from './reader';

/**
 * 可外部化对象静态读取接口
 */
interface ExternalizableReader {
    read(decoder: AMFDecoder): any;
}

/**
 * AMF3 解码器
 */
export class AMFDecoder extends Reader {
    /** AMF3 外部化对象注册表 */
    static amf3Externalizables: Record<string, ExternalizableReader> = {};

    /** AMF3 字符串引用表 */
    private amf3StringReferences: string[];

    /** AMF3 对象引用表 */
    private amf3ObjectReferences: any[];

    /** AMF3 Trait 引用表 */
    private amf3TraitReferences: AMFTrait[];

    /**
     * 注册外部化类型
     */
    static register(className: string, cls: ExternalizableReader): void {
        this.amf3Externalizables[className] = cls;
    }

    constructor(data: Uint8Array) {
        super(data);
        this.amf3StringReferences = [];
        this.amf3ObjectReferences = [];
        this.amf3TraitReferences = [];
    }

    /**
     * 解码一个 AMF3 值
     */
    decode(): any {
        const typeId = this.readUInt8();
        return this.readByTypeId(typeId);
    }

    /**
     * 按 AMF3 类型对象解码（兼容接口）
     */
    deserialize(type: number | AMFType): any {
        if (type instanceof AMFType) {
            return this.readByTypeId(type.id);
        }
        return this.readByTypeId(type);
    }

    /**
     * 按类型 ID 分发解码
     */
    private readByTypeId(typeId: number): any {
        switch (typeId) {
            case 0x00: // UNDEFINED
                return undefined;
            case 0x01: // NULL
                return null;
            case 0x02: // FALSE
                return false;
            case 0x03: // TRUE
                return true;
            case 0x04: // INTEGER
                return this.readInt29();
            case 0x05: // DOUBLE
                return this.readDoubleBE();
            case 0x06: // STRING
                return this.readAMF3String();
            case 0x08: // DATE
                return this.readAMF3Date();
            case 0x09: // ARRAY
                return this.readAMF3Array();
            case 0x0A: // OBJECT
                return this.readAMF3Object();
            case 0x0C: // BYTE_ARRAY
                return this.readAMF3ByteArray();
            case 0x0D: // VECTOR_INT
                return this.readAMF3VectorInt();
            case 0x0E: // VECTOR_UINT
                return this.readAMF3VectorUInt();
            case 0x0F: // VECTOR_DOUBLE
                return this.readAMF3VectorDouble();
            case 0x10: // VECTOR_OBJECT
                return this.readAMF3VectorObject();
            case 0x11: // DICTIONARY
                return this.readAMF3Dictionary();
            default:
                throw new Error('当前 AMF3 解码器暂不支持类型 ID: ' + typeId);
        }
    }

    /**
     * 读取 AMF3 字符串
     * 
     * todo 字符串过长时可能有bug?  当前读长读，用的是u29的方式
     */
    private readAMF3String(): string {
        const header = this.readAMFHeader();
        if (!header.isDef) {
            const ref = this.amf3StringReferences[header.value];
            if (typeof ref !== 'string') {
                throw new Error('无效的 AMF3 字符串引用');
            }
            return ref;
        }

        if (header.value === 0) {
            return '';
        }

        const value = this.readUTF8String(header.value);
        this.amf3StringReferences.push(value);
        return value;
    }

    /**
     * 读取 AMF3 日期
     */
    private readAMF3Date(): Date {
        const header = this.readAMFHeader();
        if (!header.isDef) {
            const ref = this.amf3ObjectReferences[header.value];
            if (!(ref instanceof Date)) {
                throw new Error('无效的 AMF3 日期引用');
            }
            return ref;
        }

        const value = new Date(this.readDoubleBE());
        this.amf3ObjectReferences.push(value);
        return value;
    }

    /**
     * 读取 AMF3 数组
     */
    private readAMF3Array(): any[] | Record<string, any> {
        const header = this.readAMFHeader();
        if (!header.isDef) {
            const ref = this.amf3ObjectReferences[header.value];
            if (!ref) {
                throw new Error('无效的 AMF3 数组引用');
            }
            return ref;
        }

        const named: Record<string, any> = {};
        this.amf3ObjectReferences.push(named);
        const idx = this.amf3ObjectReferences.length - 1;

        while (true) {
            const key = this.readAMF3String();
            if (key === '') {
                break;
            }
            named[key] = this.decode();
        }

        if (Object.keys(named).length > 0) {
            // 与 lib 行为保持一致：有命名字段时直接按对象返回
            return named;
        }

        const dense: any[] = [];
        this.amf3ObjectReferences[idx] = dense;
        for (let i = 0; i < header.value; i++) {
            dense.push(this.decode());
        }
        return dense;
    }

    /**
     * 读取 AMF3 对象 Trait
     */
    private readAMF3ObjectTrait(flags: number): AMFTrait {
        if ((flags & 1) === 0) {
            const trait = this.amf3TraitReferences[flags >> 1];
            if (!trait) {
                throw new Error('无效的 AMF3 Trait 引用');
            }
            return trait;
        }

        const name = this.readAMF3String();
        const isExternalizable = ((flags >> 1) & 1) === 1;
        const isDynamic = ((flags >> 2) & 1) === 1;
        const staticKeyLen = flags >> 3;

        const trait = new AMFTrait(name, isDynamic, isExternalizable);
        for (let i = 0; i < staticKeyLen; i++) {
            trait.staticFields.push(this.readAMF3String());
        }

        this.amf3TraitReferences.push(trait);
        return trait;
    }

    /**
     * 读取 AMF3 对象
     */
    private readAMF3Object(): any {
        const header = this.readAMFHeader();
        if (!header.isDef) {
            const ref = this.amf3ObjectReferences[header.value];
            if (!ref) {
                throw new Error('无效的 AMF3 对象引用');
            }
            return ref;
        }

        const trait = this.readAMF3ObjectTrait(header.value);
        if (trait.externalizable) {
            if (trait.name === 'flex.messaging.io.ArrayCollection') {
                const arr = this.decode();
                this.amf3ObjectReferences.push(arr);
                return arr;
            }

            const ext = AMFDecoder.amf3Externalizables[trait.name];
            if (!ext) {
                throw new Error('未注册 AMF3 外部化类型: ' + trait.name);
            }

            const extObj = ext.read(this);
            this.amf3ObjectReferences.push(extObj);
            return extObj;
        }

        // 处理普通对象（可能带类名）  ;
        const result = new Serializable(
            trait.name, trait.dynamic
        ) as Record<string, any>;
        this.amf3ObjectReferences.push(result);
        for (let i = 0; i < trait.staticFields.length; i++) {
            const field = trait.staticFields[i];
            result[field] = this.decode();
        }

        if (trait.dynamic) {
            while (true) {
                const key = this.readAMF3String();
                if (key === '') {
                    break;
                }
                result[key] = this.decode();
            }
        }

        return result;
    }

    /**
     * 读取 AMF3 ByteArray
     */
    private readAMF3ByteArray(): Uint8Array {
        const header = this.readAMFHeader();
        if (!header.isDef) {
            const ref = this.amf3ObjectReferences[header.value];
            if (!(ref instanceof Uint8Array)) {
                throw new Error('无效的 AMF3 ByteArray 引用');
            }
            return ref;
        }

        const bytes = this.readByte(header.value, true) as Uint8Array;
        this.amf3ObjectReferences.push(bytes);
        return bytes;
    }

    /**
     * 向量解码通用逻辑
     */
    private readAMF3Vector<T>(reader: () => T): T[] {
        const header = this.readAMFHeader();
        if (!header.isDef) {
            const ref = this.amf3ObjectReferences[header.value];
            if (!ref) {
                throw new Error('无效的 AMF3 向量引用');
            }
            return ref as T[];
        }

        this.readUInt8(); // fixed 标记
        const result: T[] = [];
        this.amf3ObjectReferences.push(result);
        for (let i = 0; i < header.value; i++) {
            result.push(reader.call(this));
        }
        return result;
    }

    /**
     * 读取 VECTOR_INT
     */
    private readAMF3VectorInt(): number[] {
        return this.readAMF3Vector<number>(function readInt(this: AMFDecoder): number {
            return this.readInt32BE();
        });
    }

    /**
     * 读取 VECTOR_UINT
     */
    private readAMF3VectorUInt(): number[] {
        return this.readAMF3Vector<number>(function readUInt(this: AMFDecoder): number {
            return this.readUInt32BE();
        });
    }

    /**
     * 读取 VECTOR_DOUBLE
     */
    private readAMF3VectorDouble(): number[] {
        return this.readAMF3Vector<number>(function readDouble(this: AMFDecoder): number {
            return this.readDoubleBE();
        });
    }

    /**
     * 读取 VECTOR_OBJECT
     */
    private readAMF3VectorObject(): any[] {
        return this.readAMF3Vector<any>(function readObject(this: AMFDecoder): any {
            return this.decode();
        });
    }

    /**
     * 读取 DICTIONARY
     */
    private readAMF3Dictionary(): Record<string, any> {
        const header = this.readAMFHeader();
        if (!header.isDef) {
            const ref = this.amf3ObjectReferences[header.value];
            if (!ref) {
                throw new Error('无效的 AMF3 字典引用');
            }
            return ref;
        }

        this.readUInt8(); // weakKeys 标记
        const result: Record<string, any> = {};
        this.amf3ObjectReferences.push(result);

        for (let i = 0; i < header.value; i++) {
            const key = this.decode();
            result[JSON.stringify(key)] = this.decode();
        }
        return result;
    }
}

export default AMFDecoder;
