/**
 * 二进制数据写入器模块
 *
 * 本模块提供了向二进制缓冲区写入各种数据类型的功能
 * 专为浏览器环境设计，使用 Uint8Array 和 DataView 替代 Node.js 的 Buffer
 */

/**
 * 二进制数据写入器类
 *
 * 提供向动态增长的缓冲区写入各种二进制数据类型的方法
 * 所有多字节数据都使用大端序（Big Endian）写入，这是 AMF 协议的要求
 *
 * @example
 * ```typescript
 * const writer = new Writer();
 * writer.writeByte(0x01);
 * writer.writeUInt16BE(0x0203);
 * writer.writeDoubleBE(3.14159);
 * const result = writer.getBuffer();
 * ```
 */
export class Writer {
    /** 内部缓冲区数组，用于动态收集写入的数据 */
    private chunks: Uint8Array[];

    /** 当前已写入的总字节数 */
    private totalLength: number;

    /**
     * 创建一个新的写入器
     */
    constructor() {
        this.chunks = [];
        this.totalLength = 0;
    }

    /**
     * 获取当前已写入的字节数
     *
     * @returns 已写入的总字节数
     */
    getLength(): number {
        return this.totalLength;
    }

    /**
     * 获取写入的所有数据
     *
     * 将所有写入的数据块合并为一个 Uint8Array
     *
     * @returns 包含所有写入数据的 Uint8Array
     */
    getBuffer(): Uint8Array {
        // 创建一个足够大的缓冲区
        const result = new Uint8Array(this.totalLength);
        let offset = 0;

        // 将所有数据块复制到结果缓冲区
        for (const chunk of this.chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result;
    }

    /**
     * 清空写入器，重置到初始状态
     */
    clear(): void {
        this.chunks = [];
        this.totalLength = 0;
    }

    /**
     * 写入数据到缓冲区
     *
     * 支持多种数据类型：
     * - 数字（0-255）：作为单个字节写入
     * - 数字数组：每个元素作为一个字节写入
     * - Uint8Array：直接写入
     * - 字符串：作为 UTF-8 编码写入
     *
     * @param value - 要写入的值
     * @throws 如果值的类型不支持
     */
    write(value: number | number[] | Uint8Array | string): void {

        if (typeof value === 'number') {
            // 单个字节
            const chunk = new Uint8Array([value & 0xff]);
            this.chunks.push(chunk);
            this.totalLength += 1;
        } else if (Array.isArray(value)) {
            // 数字数组，每个元素作为一个字节
            const chunk = new Uint8Array(value.map(v => v & 0xff));
            this.chunks.push(chunk);
            this.totalLength += chunk.length;
        } else if (value instanceof Uint8Array) {
            // Uint8Array 直接写入
            this.chunks.push(value as Uint8Array);
            this.totalLength += value.length;
        } else if (typeof value === 'string') {
            // 字符串作为 UTF-8 编码写入
            const encoder = new TextEncoder();
            const chunk = encoder.encode(value);
            this.chunks.push(chunk);
            this.totalLength += chunk.length;
        } else {
            throw new Error(`不知道如何写入: ${JSON.stringify(value)}`);
        }
    }

    /**
     * 写入单个字节
     *
     * @param value - 0-255 范围内的整数
     */
    writeByte(value: number): void {
        this.write(value & 0xff);
    }

    /**
     * 写入字节数组
     *
     * @param bytes - 字节数组或 Uint8Array
     */
    writeBytes(bytes: number[] | Uint8Array): void {
        this.write(bytes);
    }

    /**
     * 写入一个大端序无符号 16 位整数
     *
     * @param value - 0-65535 范围内的整数
     */
    writeUInt16BE(value: number): void {
        const buffer = new Uint8Array(2);
        const view = new DataView(buffer.buffer);
        view.setUint16(0, value, false); // false = 大端序
        this.write(buffer);
    }

    /**
     * 写入一个大端序有符号 16 位整数
     *
     * @param value - -32768 到 32767 范围内的整数
     */
    writeInt16BE(value: number): void {
        const buffer = new Uint8Array(2);
        const view = new DataView(buffer.buffer);
        view.setInt16(0, value, false);
        this.write(buffer);
    }

    /**
     * 写入一个大端序无符号 32 位整数
     *
     * @param value - 0-4294967295 范围内的整数
     */
    writeUInt32BE(value: number): void {
        const buffer = new Uint8Array(4);
        const view = new DataView(buffer.buffer);
        view.setUint32(0, value, false);
        this.write(buffer);
    }

    /**
     * 写入一个大端序有符号 32 位整数
     *
     * @param value - -2147483648 到 2147483647 范围内的整数
     */
    writeInt32BE(value: number): void {
        const buffer = new Uint8Array(4);
        const view = new DataView(buffer.buffer);
        view.setInt32(0, value, false);
        this.write(buffer);
    }

    /**
     * 写入一个大端序 64 位双精度浮点数
     *
     * @param value - 双精度浮点数
     */
    writeDoubleBE(value: number): void {
        const buffer = new Uint8Array(8);
        const view = new DataView(buffer.buffer);
        view.setFloat64(0, value, false);
        this.write(buffer);
    }

    /**
     * 写入一个 AMF0 格式的字符串
     *
     * AMF0 字符串格式：2字节长度（大端序）+ UTF-8 编码的字符串数据
     *
     * @param value - 要写入的字符串
     */
    writeString(value: string): void {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(value);
        this.writeUInt16BE(bytes.length);
        this.write(bytes);
    }

    /**
     * 写入 AMF3 的变长整数（Int29）
     *
     * AMF3 使用一种可变长度编码来表示 29 位有符号整数
     * 每个字节的最高位表示是否还有更多字节：
     * - 值 0-127: 单字节 (0xxxxxxx)
     * - 值 128-16383: 双字节 (1xxxxxxx 0xxxxxxx)
     * - 值 16384-2097151: 三字节 (1xxxxxxx 1xxxxxxx 0xxxxxxx)
     * - 值 2097152-536870911: 四字节 (1xxxxxxx 1xxxxxxx 1xxxxxxx xxxxxxxx)
     *
     * @param value - 29 位有符号整数，范围 -268435456 到 536870911
     * @throws 如果值超出范围
     */
    writeInt29(value: number): void {
        // 检查范围
        if (value > 536870911 || value < -268435456) {
            throw new RangeError(`Int29 值超出范围: ${value}`);
        }

        // 处理负数：转换为无符号形式
        value &= 0x1fffffff;

        if (value < 0x80) {
            // 单字节
            this.write(value);
        } else if (value < 0x4000) {
            // 双字节
            this.write([
                (value >> 7 & 0x7f) | 0x80,
                value & 0x7f
            ]);
        } else if (value < 0x200000) {
            // 三字节
            this.write([
                (value >> 14 & 0x7f) | 0x80,
                (value >> 7 & 0x7f) | 0x80,
                value & 0x7f
            ]);
        } else {
            // 四字节
            this.write([
                (value >> 22 & 0x7f) | 0x80,
                (value >> 14 & 0x7f) | 0x80,
                (value >> 7 & 0x7f) | 0x80,
                value & 0xff
            ]);
        }
    }
}
