/**
 * 二进制数据读取器模块
 *
 * 本模块提供了从二进制数据中读取各种数据类型的功能
 * 专为浏览器环境设计，使用 Uint8Array 和 DataView 替代 Node.js 的 Buffer
 */

/**
 * AMF 头部信息接口
 *
 * 在 AMF3 中，许多类型使用一个特殊的头部来表示是定义还是引用
 */
export interface AMFHeader {
    /** 是否是定义（true）还是引用（false） */
    isDef: boolean;

    /** 头部的值（引用索引或数据长度） */
    value: number;
}

/**
 * 二进制数据读取器类
 *
 * 提供从 Uint8Array 中读取各种二进制数据类型的方法
 * 所有多字节数据都使用大端序（Big Endian）读取，这是 AMF 协议的要求
 *
 * @example
 * ```typescript
 * const data = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
 * const reader = new Reader(data);
 * const byte = reader.readByte();        // 0x00
 * const uint16 = reader.readUInt16BE();  // 0x0102
 * ```
 */
export class Reader {
    /** 要读取的二进制数据 */
    protected data: Uint8Array;

    /** 用于读取多字节数据的 DataView */
    protected view: DataView;

    /** 当前读取位置 */
    protected position: number;

    /**
     * 创建一个新的读取器
     *
     * @param data - 要读取的二进制数据
     */
    constructor(data: Uint8Array) {
        this.data = data;
        this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        this.position = 0;
    }

    /**
     * 获取当前读取位置
     *
     * @returns 当前位置（字节偏移量）
     */
    getPosition(): number {
        return this.position;
    }

    /**
     * 设置读取位置
     *
     * @param pos - 新的位置
     */
    setPosition(pos: number): void {
        this.position = pos;
    }

    /**
     * 获取剩余可读字节数
     *
     * @returns 剩余字节数
     */
    getBytesAvailable(): number {
        return this.data.length - this.position;
    }

    /**
     * 检查是否还有足够的字节可读
     *
     * @param length - 需要的字节数
     * @throws 如果剩余字节不足
     */
    private checkAvailable(length: number): void {
        if (this.position + length > this.data.length) {
            throw new Error(`没有足够的 ${length} 字节可读，当前位置: ${this.position}，总长度: ${this.data.length}`);
        }
    }

    /**
     * 读取一个或多个字节
     *
     * @param length - 要读取的字节数，默认为 1
     * @param alwaysReturnArray - 即使只读取一个字节也返回 Uint8Array
     * @returns 如果 length 为 1 且 alwaysReturnArray 为 false，返回单个数字；否则返回 Uint8Array
     */
    readByte(length: number = 1, alwaysReturnArray: boolean = false): number | Uint8Array {
        this.checkAvailable(length);

        if (length === 1 && !alwaysReturnArray) {
            // 读取单个字节，返回数字
            return this.data[this.position++];
        }

        // 读取多个字节，返回 Uint8Array
        const result = this.data.slice(this.position, this.position + length);
        this.position += length;
        return result;
    }

    /**
     * 读取一个无符号 8 位整数
     *
     * @returns 0-255 范围内的整数
     */
    readUInt8(): number {
        this.checkAvailable(1);
        return this.data[this.position++];
    }

    /**
     * 读取一个有符号 8 位整数
     *
     * @returns -128 到 127 范围内的整数
     */
    readInt8(): number {
        const value = this.readUInt8();
        return value > 127 ? value - 256 : value;
    }

    /**
     * 读取一个大端序无符号 16 位整数
     *
     * @returns 0-65535 范围内的整数
     */
    readUInt16BE(): number {
        this.checkAvailable(2);
        const value = this.view.getUint16(this.position, false); // false = 大端序
        this.position += 2;
        return value;
    }

    /**
     * 读取一个大端序有符号 16 位整数
     *
     * @returns -32768 到 32767 范围内的整数
     */
    readInt16BE(): number {
        this.checkAvailable(2);
        const value = this.view.getInt16(this.position, false);
        this.position += 2;
        return value;
    }

    /**
     * 读取一个大端序无符号 32 位整数
     *
     * @returns 0-4294967295 范围内的整数
     */
    readUInt32BE(): number {
        this.checkAvailable(4);
        const value = this.view.getUint32(this.position, false);
        this.position += 4;
        return value;
    }

    /**
     * 读取一个大端序有符号 32 位整数
     *
     * @returns -2147483648 到 2147483647 范围内的整数
     */
    readInt32BE(): number {
        this.checkAvailable(4);
        const value = this.view.getInt32(this.position, false);
        this.position += 4;
        return value;
    }

    /**
     * 读取一个大端序 64 位双精度浮点数
     *
     * @returns 双精度浮点数
     */
    readDoubleBE(): number {
        this.checkAvailable(8);
        const value = this.view.getFloat64(this.position, false);
        this.position += 8;
        return value;
    }

    /**
     * 读取一个 AMF0 格式的字符串
     *
     * AMF0 字符串格式：2字节长度 + UTF-8 编码的字符串数据
     *
     * @returns 解码后的字符串
     */
    readString(): string {
        const length = this.readUInt16BE();
        if (length === 0) {
            return '';
        }
        return this.readUTF8String(length);
    }

    /**
     * 读取指定长度的 UTF-8 字符串
     *
     * @param length - 字符串的字节长度
     * @returns 解码后的字符串
     */
    readUTF8String(length: number): string {
        this.checkAvailable(length);
        const bytes = this.data.slice(this.position, this.position + length);
        this.position += length;

        // 使用 TextDecoder 将 UTF-8 字节解码为字符串
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(bytes);
    }

    /**
     * 读取 AMF3 的变长整数（Int29）
     *
     * AMF3 使用一种可变长度编码来表示 29 位有符号整数
     * 每个字节的最高位表示是否还有更多字节：
     * - 0xxxxxxx: 单字节，值 0-127
     * - 1xxxxxxx 0xxxxxxx: 双字节
     * - 1xxxxxxx 1xxxxxxx 0xxxxxxx: 三字节
     * - 1xxxxxxx 1xxxxxxx 1xxxxxxx xxxxxxxx: 四字节（最后一个字节使用全部 8 位）
     *
     * @returns 29 位有符号整数，范围 -268435456 到 536870911
     */
    readInt29(): number {
        let total = 0;
        let byte = this.readUInt8();

        // 第一个字节
        if (byte < 128) {
            return byte;
        }

        // 第二个字节
        total = (byte & 0x7f) << 7;
        byte = this.readUInt8();

        if (byte < 128) {
            total |= byte;
        } else {
            // 第三个字节
            total = (total | (byte & 0x7f)) << 7;
            byte = this.readUInt8();

            if (byte < 128) {
                total |= byte;
            } else {
                // 第四个字节（使用全部 8 位）
                total = (total | (byte & 0x7f)) << 8;
                total |= this.readUInt8();
            }
        }

        // 处理符号位（29 位有符号整数）
        // 如果第 29 位是 1，则是负数
        return -(total & (1 << 28)) | total;
    }

    /**
     * 读取 AMF3 头部信息
     *
     * AMF3 中很多类型使用一个头部来区分是定义还是引用：
     * - 最低位为 0: 这是一个引用，高位存储引用索引
     * - 最低位为 1: 这是一个定义，高位存储数据长度或其他信息
     *
     * @returns AMF 头部信息对象
     */
    readAMFHeader(): AMFHeader {
        const handle = this.readInt29();
        const isDef = (handle & 1) !== 0;
        const value = handle >> 1;

        return {
            isDef,
            value
        };
    }
}
