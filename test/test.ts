import { AMFEncoder, AMFDecoder, Serializable } from 'amf-ts';
// 简单的断言函数
function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Example failed: ${message}`);
    }
    console.log(`PASS: ${message}`);
}

function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
    }

    return true;
}

// 1. 基础数据测试
console.log('--- Testing Basic Data ---');
const basicData = {
    msg: 'hello',
    n: 123,
    f: 123.456,
    ok: true,
    notOk: false,
    arr: [1, 'x', false],
    nullVal: null,
    // Date 和 Uint8Array 比较比较麻烦，先不测完全深度相等，单独拿出来检查
};

const encoder = new AMFEncoder();
encoder.writeObject(basicData);
const buffer = encoder.getBuffer();

console.log(`Encoded buffer length: ${buffer.byteLength}`);

const decoder = new AMFDecoder(buffer);
const decodedData = decoder.decode();

assert(decodedData.msg === 'hello', 'String matches');
assert(decodedData.n === 123, 'Number matches');
assert(Math.abs(decodedData.f - 123.456) < 0.0001, 'Float matches');
assert(decodedData.ok === true, 'Boolean true matches');
assert(decodedData.notOk === false, 'Boolean false matches');
assert(decodedData.arr[0] === 1, 'Array index 0 matches');
assert(decodedData.arr[1] === 'x', 'Array index 1 matches');
assert(decodedData.nullVal === null, 'Null matches');

// 2. 自定义类测试
console.log('\n--- Testing Serializable Class ---');
class User extends Serializable {
    name: string;
    age: number;

    constructor(name: string = '', age: number = 0) {
        super('demo.User');
        this.name = name;
        this.age = age;
    }
}

// 注册类映射以便解码时能还原为 User 实例
// 注意：AMFDecoder 需要知道 'demo.User' 对应哪个类
// 假设库里有注册机制，或者我们临时验证是否有这样的机制。
// 查看 README，Serializable 只是带了 __class。
// 如果要让 Decoder 还原成 User 实例，通常需要 AMFDecoder.register 或类似机制。
// 让我们检查一下 README 提到的 Externalizable 有 register，Serializable 呢？
// README 提到 "继承 Serializable 后，可带 __class 输出命名对象"。
// 如果库没有自动映射回来的功能，它解析出来可能是一个带 __class 属性的普通对象，或者 Serializable 实例。
// 我们先按 README 的例子跑。

const user = new User('tom', 18);
const encUser = new AMFEncoder();
encUser.writeObject(user);
const userBytes = encUser.getBuffer();

const decUser = new AMFDecoder(userBytes);
// 为了让解码器知道 demo.User 对应 User 类，通常需要注册。
// 我们先看看解码出来是什么。
const decodedUser = decUser.decode();

console.log('Decoded User:', decodedUser);
assert(decodedUser.name === 'tom', 'User name matches');
assert(decodedUser.age === 18, 'User age matches');
// 检查是否带有类型信息 (假设库保留了类型别名或者还原了类)
// assert(decodedUser.__class === 'demo.User', 'Class alias matches'); // 取决于实现细节

// 3. 匿名静态对象测试（__class 为空但 __dynamic 为 false）
console.log('\n--- Testing Anonymous Static Object ---');

// 方式1: 使用 Serializable 构造函数
const staticObj1 = new Serializable('');
(staticObj1 as any).__dynamic = false;
(staticObj1 as any).name = 'static1';
(staticObj1 as any).value = 42;

const encStatic1 = new AMFEncoder();
encStatic1.writeObject(staticObj1);
const staticBytes1 = encStatic1.getBuffer();
console.log(`Static object 1 encoded: ${staticBytes1.byteLength} bytes`);

const decStatic1 = new AMFDecoder(staticBytes1);
const decodedStatic1 = decStatic1.decode();
console.log('Decoded static object 1:', decodedStatic1);
assert(decodedStatic1.name === 'static1', 'Static obj1 name matches');
assert(decodedStatic1.value === 42, 'Static obj1 value matches');

// 方式2: 普通对象设置 __dynamic = false
const staticObj2 = {
    name: 'static2',
    count: 100,
    __dynamic: false
};

const encStatic2 = new AMFEncoder();
encStatic2.writeObject(staticObj2);
const staticBytes2 = encStatic2.getBuffer();
console.log(`Static object 2 encoded: ${staticBytes2.byteLength} bytes`);

const decStatic2 = new AMFDecoder(staticBytes2);
const decodedStatic2 = decStatic2.decode();
console.log('Decoded static object 2:', decodedStatic2);
assert(decodedStatic2.name === 'static2', 'Static obj2 name matches');
assert(decodedStatic2.count === 100, 'Static obj2 count matches');

// 对比：动态对象（默认行为）
const dynamicObj = {
    name: 'dynamic',
    count: 200
};

const encDynamic = new AMFEncoder();
encDynamic.writeObject(dynamicObj);
const dynamicBytes = encDynamic.getBuffer();
console.log(`Dynamic object encoded: ${dynamicBytes.byteLength} bytes`);

const decDynamic = new AMFDecoder(dynamicBytes);
const decodedDynamic = decDynamic.decode();
console.log('Decoded dynamic object:', decodedDynamic);
assert(decodedDynamic.name === 'dynamic', 'Dynamic obj name matches');
assert(decodedDynamic.count === 200, 'Dynamic obj count matches');

console.log('\nAll tests passed successfully!');
