## AMF.js (TypeScript)

一个基于 TypeScript 的 AMF 序列化库，支持 **浏览器** 和 **Node.js** 环境，当前编码器/解码器聚焦 **AMF3**。

## 特性

- `AMFEncoder` / `AMFDecoder`：AMF3 编解码
- **跨平台**：基于 `Uint8Array`、`DataView`、`TextEncoder`、`TextDecoder`，浏览器和 Node.js 11+ 均可使用
- 支持引用表（字符串/对象/Trait）、动态对象、`Externalizable`、`ByteArray`
- 不依赖 Node.js `Buffer` 或 Node Stream

## 安装

```bash
npm install amf-ts
```

或者本地安装：
```bash
npm install /path/to/amf-ts-1.0.0.tgz
```

## 目录说明

- `src/encoder.ts`：AMF3 编码器
- `src/decoder.ts`：AMF3 解码器
- `src/reader.ts`：二进制读取工具
- `src/writer.ts`：二进制写入工具
- `src/classes.ts`：`Serializable` / `Externalizable` / `ForcedTypeValue`
- `src/types.ts`：AMF 类型定义与推断

## 基础用法

```ts
import { AMFEncoder } from 'amf-ts';
import { AMFDecoder } from 'amf-ts';

const data = {
  msg: 'hello',
  n: 123,
  ok: true,
  arr: [1, 'x', false],
  bytes: new Uint8Array([1, 2, 3]),
  date: new Date()
};

// 编码
const encoder = new AMFEncoder();
encoder.writeObject(data);
const bytes: Uint8Array = encoder.getBuffer();

// 解码
const decoder = new AMFDecoder(bytes);
const result = decoder.decode();
console.log(result.msg, result.arr[1]);
```

## Serializable 对象

继承 `Serializable` 后，可带 `__class` 输出命名对象。

```ts
import { Serializable, AMFEncoder } from 'amf-ts';

class User extends Serializable {
  name: string;
  age: number;

  constructor(name: string, age: number) {
    super('demo.User');
    this.name = name;
    this.age = age;
  }
}

const encoder = new AMFEncoder();
encoder.writeObject(new User('tom', 18));
```

如果你实现了 `getSerializableFields()`，会优先按该字段列表输出；`__` 前缀字段会被忽略。

```ts
import { Serializable, AMFEncoder } from 'amf-ts';

class User extends Serializable {
  name: string;
  age: number;
  password: string;  // 敏感字段，不想序列化

  constructor(name: string, age: number, password: string) {
    super('demo.User');
    this.name = name;
    this.age = age;
    this.password = password;
  }

  // 只序列化 name 和 age，忽略 password
  getSerializableFields(): string[] {
    return ['name', 'age'];
  }
}

const encoder = new AMFEncoder();
encoder.writeObject(new User('tom', 18, 'secret123'));
// 输出只包含 name 和 age，不包含 password
```

## Externalizable 对象

适用于你想完全控制编码/解码格式的场景。

```ts
import { Externalizable, AMFEncoder, AMFDecoder } from 'amf-ts';

class CustomData extends Externalizable {
  value: number;

  constructor(value = 0) {
    super('demo.CustomData');
    this.value = value;
  }

  write(encoder: AMFEncoder): void {
    encoder.writeObject(this.value);
  }

  static read(decoder: AMFDecoder): CustomData {
    const obj = new CustomData();
    obj.value = decoder.decode();
    return obj;
  }
}

AMFDecoder.register('demo.CustomData', CustomData);
```

## 强制类型编码

当你想覆盖自动推断类型时可使用 `ForcedTypeValue`。

```ts
import { AMF3, ForcedTypeValue, AMFEncoder } from 'amf-ts';

const encoder = new AMFEncoder();
encoder.writeObject(new ForcedTypeValue(1, AMF3.DOUBLE));
```

## 浏览器使用

```html
<script type="module">
  import { AMFEncoder, AMFDecoder } from '../dist/amf.js';
  
  const encoder = new AMFEncoder();
  encoder.writeObject({ hello: 'world' });
  console.log(encoder.getBuffer());
</script>
```

## 构建

```bash
npm install
npm run build
```

输出文件：
- `dist/amf.js` - ES Module
- `dist/index.d.ts` - TypeScript 类型定义
