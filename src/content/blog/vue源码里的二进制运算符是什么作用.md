---
title: "从 Vue ShapeFlags 看懂 JavaScript 位运算"
description: "以 Vue 源码中的 ShapeFlags 为例，解释 <<、>>、|、& 的作用，以及 bit flags 如何用一个 number 高效表示多个 vnode 特征。"
date: 2026-06-12
tags: ["前端", "Vue", "JavaScript", "源码", "位运算"]
draft: false
---

# 从 Vue `ShapeFlags` 看懂 JavaScript 位运算：`<<`、`>>`、`|`、`&`

在阅读 Vue 源码时，经常会看到类似这样的代码：

```ts
export enum ShapeFlags {
  ELEMENT = 1,
  FUNCTIONAL_COMPONENT = 1 << 1,
  STATEFUL_COMPONENT = 1 << 2,
  TEXT_CHILDREN = 1 << 3,
  ARRAY_CHILDREN = 1 << 4,
  SLOTS_CHILDREN = 1 << 5,
  TELEPORT = 1 << 6,
  SUSPENSE = 1 << 7,
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,
  COMPONENT_KEPT_ALIVE = 1 << 9,
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT,
}
```

第一次看到这段代码时，很多人会疑惑：

为什么不用普通的 `1、2、3、4`？

为什么要写 `1 << 1`、`1 << 2`？

这里的 `|` 是什么意思？

后面源码里又经常看到 `shapeFlag & ShapeFlags.COMPONENT`，这个 `&` 又是什么意思？

这篇文章就以 Vue 的 `ShapeFlags` 为例，把 JavaScript 里的几个常见位运算符讲清楚：

```text
<<   按位左移
>>   按位右移
|    按位或
&    按位与
```

---

## 一、`<<` 是什么？

`<<` 是 **按位左移运算符**，英文叫 `left shift`。

写法是：

```ts
x << n
```

意思是：

```text
把 x 的二进制向左移动 n 位，右边补 0
```

比如：

```ts
1 << 1 // 2
1 << 2 // 4
1 << 3 // 8
1 << 4 // 16
```

从二进制看更清楚：

```text
1 的二进制：0001

1 << 1：0010 = 2
1 << 2：0100 = 4
1 << 3：1000 = 8
```

所以：

```ts
1 << n
```

通常可以理解成：

```ts
2 ** n
```

也就是 2 的 n 次方。

---

## 二、为什么 Vue 不直接写 1、2、3、4？

如果只是普通枚举，当然可以写：

```ts
enum Type {
  A = 1,
  B = 2,
  C = 3,
  D = 4,
}
```

但 `ShapeFlags` 不是普通枚举，它是 **位标记**，也叫 **bit flags**。

它的目的不是表达：

```text
这是第 1 种类型
这是第 2 种类型
这是第 3 种类型
```

而是表达：

```text
这个 vnode 同时具备哪些特征
```

比如一个 vnode 可能同时是：

```text
普通元素
并且 children 是文本
```

也可能是：

```text
组件
并且 children 是 slots
```

这时就需要用一个数字同时表示多个状态。

所以每一个状态都必须占用一个独立的二进制位。

正确的 flag 应该是：

```text
0000000001 = 1
0000000010 = 2
0000000100 = 4
0000001000 = 8
0000010000 = 16
```

也就是：

```ts
1 << 0 // 1
1 << 1 // 2
1 << 2 // 4
1 << 3 // 8
1 << 4 // 16
```

每个值只占一个 bit，互不冲突。

---

## 三、如果写成 1、2、3、4 会有什么问题？

问题出在 `3`。

看这个枚举：

```ts
enum ShapeFlags {
  ELEMENT = 1,              // 0001
  FUNCTIONAL_COMPONENT = 2, // 0010
  STATEFUL_COMPONENT = 3,   // 0011
  TEXT_CHILDREN = 4,        // 0100
}
```

`STATEFUL_COMPONENT = 3` 看起来只是第三个值，但它的二进制是：

```text
0011
```

而：

```text
1 = 0001
2 = 0010
3 = 0011
```

所以 `3` 其实等价于：

```ts
1 | 2
```

也就是：

```ts
ELEMENT | FUNCTIONAL_COMPONENT
```

这就会造成标记冲突。

比如：

```ts
const shapeFlag = ShapeFlags.FUNCTIONAL_COMPONENT

if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
  console.log('这是状态组件')
}
```

如果：

```ts
FUNCTIONAL_COMPONENT = 2 // 0010
STATEFUL_COMPONENT = 3  // 0011
```

那么：

```ts
2 & 3
```

二进制计算是：

```text
0010
0011
----
0010
```

结果不是 `0`，条件成立。

也就是说，明明是函数组件，却被误判成了状态组件。

所以位标记不能使用连续的 `1、2、3、4、5`，必须使用：

```text
1、2、4、8、16、32...
```

也就是每个值都只占一个二进制位。

---

## 四、`|` 是什么？

`|` 是 **按位或运算符**，英文叫 `bitwise OR`。

它的作用是：

```text
合并多个标记
```

比如 Vue 里这句：

```ts
COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT
```

意思是：

```text
组件 = 有状态组件 或 函数组件
```

注意，这里的 `|` 不是 TypeScript 类型里的联合类型，而是运行时的按位或运算符。

假设：

```ts
FUNCTIONAL_COMPONENT = 1 << 1 // 2
STATEFUL_COMPONENT = 1 << 2  // 4
```

二进制是：

```text
FUNCTIONAL_COMPONENT = 0010
STATEFUL_COMPONENT  = 0100
```

使用 `|` 合并：

```ts
COMPONENT = 2 | 4
```

二进制计算：

```text
0010
0100
----
0110
```

结果是：

```ts
COMPONENT = 6
```

所以：

```ts
ShapeFlags.COMPONENT
```

其实是一个组合标记，它包含：

```text
FUNCTIONAL_COMPONENT
STATEFUL_COMPONENT
```

以后只要判断一个 vnode 是不是组件，就可以用 `COMPONENT` 这个组合标记。

---

## 五、`&` 是什么？

`&` 是 **按位与运算符**，英文叫 `bitwise AND`。

它的作用是：

```text
判断某个组合标记中是否包含某个标记
```

比如：

```ts
if (shapeFlag & ShapeFlags.COMPONENT) {
  // 是组件
}
```

意思是：

```text
检查 shapeFlag 里面有没有 COMPONENT 这个标记
```

再看一个例子：

```ts
const flag = ShapeFlags.ELEMENT | ShapeFlags.TEXT_CHILDREN
```

假设：

```ts
ELEMENT = 1        // 0001
TEXT_CHILDREN = 8 // 1000
```

那么：

```ts
flag = 1 | 8
```

二进制结果是：

```text
0001
1000
----
1001
```

这个 `flag` 就同时表示：

```text
它是元素
它的 children 是文本
```

现在判断它是否包含 `ELEMENT`：

```ts
flag & ShapeFlags.ELEMENT
```

二进制计算：

```text
flag    = 1001
ELEMENT = 0001
---------------
结果     = 0001
```

结果不是 `0`，说明包含 `ELEMENT`。

再判断它是否包含 `ARRAY_CHILDREN`：

```ts
flag & ShapeFlags.ARRAY_CHILDREN
```

假设：

```ts
ARRAY_CHILDREN = 16 // 10000
```

计算：

```text
flag           = 01001
ARRAY_CHILDREN = 10000
-----------------------
结果            = 00000
```

结果是 `0`，说明不包含 `ARRAY_CHILDREN`。

所以可以简单记：

```text
| 负责合并标记
& 负责判断标记
```

---

## 六、`>>` 是什么？

`>>` 是 **按位右移运算符**，英文叫 `signed right shift`，也叫 **有符号右移**。

写法是：

```ts
x >> n
```

意思是：

```text
把 x 的二进制向右移动 n 位
```

比如：

```ts
8 >> 1 // 4
8 >> 2 // 2
8 >> 3 // 1
```

从二进制看：

```text
8 的二进制：1000

8 >> 1：0100 = 4
8 >> 2：0010 = 2
8 >> 3：0001 = 1
```

可以粗略理解成：

```ts
x >> n
```

等价于：

```ts
Math.floor(x / 2 ** n)
```

但是要注意，JavaScript 的位运算会把数字转成 **32 位有符号整数**，所以它不是完全等价于普通除法。

---

## 七、`>>` 和 `>>>` 的区别

JavaScript 里还有一个：

```ts
>>>
```

它叫 **无符号右移**。

区别是：

```text
>>  保留符号位
>>> 不保留符号位，左边补 0
```

例如：

```ts
-8 >> 1
// -4

-8 >>> 1
// 2147483644
```

所以：

```text
>> 适合保留正负号的右移
>>> 适合按无符号 32 位整数处理
```

在 Vue 的 `ShapeFlags` 这种场景里，最常用的是：

```text
<< 生成每一位 flag
|  合并多个 flag
&  判断是否包含某个 flag
```

`>>` 用得相对少一些，更多出现在算法、编码、二进制解析等场景里。

---

## 八、用一个完整例子理解 bit flags

假设我们自己设计一个权限系统：

```ts
enum Permission {
  READ = 1 << 0,   // 1，0001
  WRITE = 1 << 1,  // 2，0010
  DELETE = 1 << 2, // 4，0100
  ADMIN = 1 << 3,  // 8，1000
}
```

给用户分配读和写权限：

```ts
const userPermission = Permission.READ | Permission.WRITE
```

计算过程：

```text
READ  = 0001
WRITE = 0010
---------------
结果   = 0011
```

判断是否有读权限：

```ts
if (userPermission & Permission.READ) {
  console.log('有读权限')
}
```

判断是否有删除权限：

```ts
if (userPermission & Permission.DELETE) {
  console.log('有删除权限')
} else {
  console.log('没有删除权限')
}
```

输出结果：

```text
有读权限
没有删除权限
```

如果想加上删除权限：

```ts
const newPermission = userPermission | Permission.DELETE
```

如果想移除写权限，可以用：

```ts
const removedWrite = newPermission & ~Permission.WRITE
```

这里的 `~` 是按位非，表示取反。虽然本文重点不是讲 `~`，但在权限位系统里也经常会配合使用。

---

## 九、回到 Vue 的 `ShapeFlags`

Vue 使用 `ShapeFlags` 的目的，是为了快速判断 vnode 的形态。

比如：

```ts
ShapeFlags.ELEMENT
ShapeFlags.FUNCTIONAL_COMPONENT
ShapeFlags.STATEFUL_COMPONENT
ShapeFlags.TEXT_CHILDREN
ShapeFlags.ARRAY_CHILDREN
ShapeFlags.SLOTS_CHILDREN
```

一个 vnode 可能同时具有多个特征。

比如：

```text
它是一个普通元素
并且 children 是文本
```

就可以表示为：

```ts
const shapeFlag = ShapeFlags.ELEMENT | ShapeFlags.TEXT_CHILDREN
```

之后判断：

```ts
if (shapeFlag & ShapeFlags.ELEMENT) {
  // 处理普通元素
}

if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
  // 处理文本 children
}

if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
  // 处理数组 children
}
```

这种写法的好处是：

```text
1. 一个数字可以表示多个状态
2. 判断速度快
3. 内存占用小
4. 组合能力强
5. 非常适合底层框架和编译器场景
```

Vue 作为框架，运行时会频繁创建、判断、处理 vnode，所以用 bit flags 是比较高效的选择。

---

## 十、为什么源码喜欢这样写？

源码中使用位运算，通常不是为了炫技，而是因为它适合下面这些场景：

```text
1. 状态组合
2. 权限控制
3. 标记判断
4. 编译器内部标记
5. 虚拟 DOM 类型判断
6. 二进制协议解析
7. 性能敏感的底层逻辑
```

比如 Vue 的 `ShapeFlags`，就是典型的“状态组合”场景。

如果不用位运算，也可以写成对象：

```ts
const shape = {
  isElement: true,
  hasTextChildren: true,
  isComponent: false,
}
```

这种写法业务代码里更直观。

但对框架源码来说，使用一个数字会更轻量：

```ts
const shapeFlag = ShapeFlags.ELEMENT | ShapeFlags.TEXT_CHILDREN
```

判断也很快：

```ts
if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
  // ...
}
```

---

## 十一、业务代码要不要用位运算？

大多数业务代码不需要主动使用位运算。

如果只是普通状态，直接写对象、数组、枚举会更清晰：

```ts
const user = {
  canRead: true,
  canWrite: false,
  canDelete: false,
}
```

或者：

```ts
const permissions = ['read', 'write']
```

业务代码更关注可读性，而不是极致性能。

但是如果你遇到这些场景，可以考虑位运算：

```text
1. 权限位很多，需要组合判断
2. 状态标记很多，且经常组合
3. 数据需要压缩存储
4. 需要和后端 bit mask 对齐
5. 框架、工具库、底层能力开发
```

例如：

```ts
enum FeatureFlag {
  ENABLE_LOGIN = 1 << 0,
  ENABLE_PAYMENT = 1 << 1,
  ENABLE_SHARE = 1 << 2,
  ENABLE_AI_MUSIC = 1 << 3,
}
```

组合：

```ts
const flags = FeatureFlag.ENABLE_LOGIN | FeatureFlag.ENABLE_SHARE
```

判断：

```ts
if (flags & FeatureFlag.ENABLE_SHARE) {
  console.log('开启分享能力')
}
```

不过在普通前端业务里，不要为了“看起来高级”而使用位运算。团队成员能快速看懂，通常比少写几个字段更重要。

---

## 十二、总结

这几个运算符可以这样记：

```text
<<   左移，用来生成 1、2、4、8、16 这种独立 bit
>>   右移，通常可以理解成除以 2 的 n 次方
|    按位或，用来合并多个标记
&    按位与，用来判断是否包含某个标记
```

在 Vue 的 `ShapeFlags` 里：

```ts
FUNCTIONAL_COMPONENT = 1 << 1
STATEFUL_COMPONENT = 1 << 2
TEXT_CHILDREN = 1 << 3
```

这些写法是为了让每个状态都占用独立的二进制位。

而：

```ts
COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT
```

是为了把两个组件类型合并成一个大类。

后面判断时：

```ts
if (shapeFlag & ShapeFlags.COMPONENT) {
  // 是组件
}
```

就是在检查当前 vnode 是否包含组件这个标记。

所以，Vue 这里使用位运算的本质是：

```text
用一个 number 高效表示多个 vnode 特征
```

不是为了让代码变复杂，而是因为这个场景非常适合 bit flags。

一句话记住：

```text
<< 生成标记，| 合并标记，& 检查标记，>> 反向右移。
```
