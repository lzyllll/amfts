/**
 * AMF3 编码器模块
 *
 * 仅实现 AMF3，并使用类方法进行分发编码（不依赖给类型对象动态挂方法）。
 * 全部基于浏览器可用的 Uint8Array / TextEncoder。
 */

import { AMF3, AMFType } from './types';
import { Externalizable, ForcedTypeValue } from './classes';
import { Writer } from './writer';

/**
 * 提取对象可序列化字段名
 */
function getSerializableKeys(value: Record<string, any>): string[] {
    const keys = typeof value.getSerializableFields === 'function'
        ? value.getSerializableFields()
        : Object.keys(value);
    return keys.filter(function filterInternal(key: string): boolean {
        return key.indexOf('__') !== 0;
    });
}

/**
 * AMF3 编码器
 */
export class AMFEncoder extends Writer {
    /** AMF3 对象引用表 */
    private amf3ObjectReferences: any[];

    /** AMF3 字符串引用表 */
    private amf3StringReferences: string[];

    constructor() {
        super();
        this.amf3ObjectReferences = [];
        this.amf3StringReferences = [];
    }

    /**
     * 编码一个 AMF3 值（会写入类型标记）
     */
    writeObject(value: any): void {
        this.encodeValue(value);
    }

    /**
     * 兼容旧接口，含义与 writeObject 相同
     */
    encode(value: any): void {
        this.encodeValue(value);
    }

    /**
     * 编码值主体（无类型标记）
     */
    serialize(value: any): void {
        const type = this.inferType(value);
        this.writeByType(value instanceof ForcedTypeValue ? value.value : value, type);
    }

    /**
     * 推断值的 AMF3 类型
     */
    private inferType(value: any): AMFType {
        return AMF3.infer(value);
    }

    /**
     * 编码一个完整值（含类型标记与引用处理）
     */
    private encodeValue(value: any): void {
        const type = this.inferType(value);
        const realValue = value instanceof ForcedTypeValue ? value.value : value;

        if (type.referencable && realValue !== '') {
            let index = -1;
            if (type === AMF3.STRING) {
                index = this.amf3StringReferences.indexOf(realValue);
            } else {
                index = this.amf3ObjectReferences.indexOf(realValue);
            }

            if (index !== -1) {
                this.writeByte(type.id);
                this.writeInt29(index << 1);
                return;
            }

            if (type === AMF3.STRING) {
                this.amf3StringReferences.push(realValue);
            } else {
                this.amf3ObjectReferences.push(realValue);
            }
        }

        this.writeByte(type.id);
        this.writeByType(realValue, type);
    }

    /**
     * 按类型写入值主体（不包含类型标记）
     */
    private writeByType(value: any, type: AMFType): void {
        switch (type.id) {
            case 0x00: // UNDEFINED
            case 0x01: // NULL
            case 0x02: // FALSE
            case 0x03: // TRUE
                return;
            case 0x04: // INTEGER
                this.writeInt29(value);
                return;
            case 0x05: // DOUBLE
                this.writeDoubleBE(value);
                return;
            case 0x06: // STRING
                this.writeInlineString(value);
                return;
            case 0x08: // DATE
                this.writeInt29(1);
                this.writeDoubleBE((value as Date).getTime());
                return;
            case 0x09: // ARRAY
                this.writeArray(value);
                return;
            case 0x0A: // OBJECT
                this.writeObjectValue(value);
                return;
            case 0x0C: // BYTE_ARRAY
                this.writeByteArray(value);
                return;
            default:
                throw new Error('当前 AMF3 编码器暂不支持该类型: ' + type.name);
        }
    }

    /**
     * 写入 AMF3 内联字符串（无类型标记）
     *
     * 说明：
     * 这里保持与原 lib 行为一致，不在“无类型字符串”分支中做字符串引用表复用。
     */
    private writeInlineString(value: string): void {
        const bytes = new TextEncoder().encode(value);
        this.writeInt29((bytes.length << 1) | 1);
        this.write(bytes);
    }

    /**
     * 写入 AMF3 数组（密集数组或关联数组）
     */
    private writeArray(value: any[] | Record<string, any>): void {
        if (Array.isArray(value)) {
            this.writeInt29((value.length << 1) | 1);
            this.writeInlineString('');
            for (let i = 0; i < value.length; i++) {
                this.encodeValue(value[i]);
            }
            return;
        }

        this.writeInt29(0x01);
        const keys = Object.keys(value);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (key.indexOf('__') === 0) {
                continue;
            }
            this.writeInlineString(key);
            this.encodeValue((value as Record<string, any>)[key]);
        }
        this.writeInlineString('');
    }

    /**
     * 写入 AMF3 对象
     */
    private writeObjectValue(value: Record<string, any>): void {
        // 匿名对象按“动态对象”编码
        if (!value.__class || value.__class === '') {
            this.writeInt29(0x0b);
            this.writeInt29(0x01);

            const keys = Object.keys(value);
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (key.indexOf('__') === 0) {
                    continue;
                }
                this.writeInlineString(key);
                this.encodeValue(value[key]);
            }
            this.writeInlineString('');
            return;
        }

        const externalizable = value instanceof Externalizable;
        const keys = externalizable ? [] : getSerializableKeys(value);

        let header = keys.length << 4;
        header |= (externalizable ? 1 : 0) << 2;
        header = (header | 2) | 1;

        this.writeInt29(header);
        this.writeInlineString(value.__class);

        if (externalizable) {
            (value as Externalizable).write(this);
            return;
        }

        for (let i = 0; i < keys.length; i++) {
            this.writeInlineString(keys[i]);
        }
        for (let i = 0; i < keys.length; i++) {
            this.encodeValue(value[keys[i]]);
        }
    }

    /**
     * 写入 AMF3 ByteArray
     */
    private writeByteArray(value: Uint8Array): void {
        this.writeInt29((value.length << 1) | 1);
        this.write(value);
    }
}

export default AMFEncoder;
