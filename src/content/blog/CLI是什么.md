---
title: 'CLI、脚本与平台：如何设计可复用的原子能力与批处理工作流'
date: 2026-08-12
tags: ['CLI', '脚本', '工作流', '架构设计', '自动化']
description: '从脚本、CLI、平台和工作流的职责划分出发，讨论原子能力、批处理、执行状态与缓存的设计原则'
draft: false
---

# CLI、脚本与平台：如何设计可复用的原子能力与批处理工作流

在很多 AI、音视频处理和数据自动化系统中，一个常见问题是：一项能力到底应该写成脚本、CLI，还是直接做进平台？

例如视频理解系统里可能有这些能力：

```text
视频 → 胶片流
视频 → 字幕
胶片流 + 字幕 → 内容总结
音频 → 音乐分析
分析结果 → 飞书多维表格
```

这些能力既可以全部写进一个 Node 服务，也可以拆成若干 CLI，再交给 n8n、Airflow、Node Worker 或其他工作流系统进行编排。

如果系统未来需要不断增加能力、组合不同 Workflow、批量运行、失败重试，我更推荐一种思路：

> **CLI 负责能力，Workflow 负责流程，平台负责业务。**

也就是：

```text
CLI
=
How
具体怎么完成一件事情

Workflow
=
When + What Next
什么时候执行，以及下一步做什么

Platform
=
Why + Business State
为什么执行，以及业务对象是什么
```

这三层职责分清以后，系统通常会比把所有逻辑写进一个大型服务更容易维护。

---

# 一、脚本、CLI 和平台分别是什么

## 脚本 Script

脚本通常是解决一个具体问题的小程序。

例如：

```bash
python generate_filmstrip.py video.mp4
```

或者：

```bash
node import-data.js
```

它最常见的特点是：

```text
任务明确
使用者较少
接口不稳定
错误处理较简单
通常只服务当前项目
```

一个脚本可能直接：

```python
input = sys.argv[1]

# 做一些事情

print("done")
```

这没有问题。

如果这个东西：

> 今天写、今天用，以后可能就不用了

脚本往往是最合适的。

不要为了所有事情都做 CLI。

---

# 二、CLI 是“产品化的脚本”

CLI，Command Line Interface，本质上仍然是一个程序。

区别在于：

> **它开始拥有稳定的输入、输出、错误和行为约定。**

例如：

```bash
video-filmstrip \
  --input ./video.mp4 \
  --output ./result
```

这是一个 CLI。

它应该明确：

```text
输入是什么
输出是什么
参数是什么
错误是什么
Exit Code是什么
结果保存在哪里
重复运行会发生什么
```

例如成功：

```json
{
  "success": true,
  "data": {
    "manifest": "./result/manifest.json",
    "count": 4
  }
}
```

失败：

```json
{
  "success": false,
  "error": {
    "code": "INVALID_VIDEO",
    "message": "Unable to decode input video",
    "retryable": false
  }
}
```

因此，可以简单理解为：

```text
Script
↓
接口逐渐稳定
↓
有人开始依赖它
↓
需要自动化调用
↓
CLI
```

---

# 三、平台又是什么

平台解决的不是：

> “怎么把视频转成胶片流？”

而是：

> “哪些视频需要分析？”

> “属于哪个专题？”

> “谁提交了任务？”

> “任务现在是什么状态？”

> “分析结果应该显示在哪里？”

例如一个视频管理后台：

```text
专题
├── 深圳 Vlog
│   ├── DJI_001.mp4
│   ├── DJI_002.mp4
│   └── DJI_003.mp4
│
└── 广州探店
```

这些概念：

```text
专题
视频
用户
分析状态
人工修改
飞书同步
```

属于业务平台。

而：

```text
视频转字幕
生成胶片流
调用 GPT 分析
```

属于能力层。

因此更好的架构通常是：

```text
Web Platform
      │
      ▼
Workflow / Orchestrator
      │
      ├── media-probe
      ├── video-filmstrip
      ├── video-transcribe
      ├── video-summarize
      └── feishu-export
```

而不是：

```text
Web Platform
      │
      ▼
一个 analyzeVideo()
里面包含所有逻辑
```

---

# 四、什么情况下适合把能力做成 CLI

一个简单判断标准：

> **这项能力是否可以在不知道“业务是谁”的情况下独立完成？**

例如：

```text
视频 → 胶片流
```

它不需要知道：

```text
用户是谁
专题叫什么
飞书表在哪里
为什么要分析
```

它只需要知道：

```text
输入视频
输出位置
配置
```

那么它非常适合做成 CLI。

---

## 比较适合 CLI 的能力

例如：

```text
media-probe

video-filmstrip

video-transcribe

video-ocr

video-thumbnail

video-quality

video-summarize

music-analyze

audio-normalize

image-resize
```

这些能力都有一个共同特点：

```text
Input
↓
Processing
↓
Output
```

例如：

```text
video.mp4
↓
video-filmstrip
↓
filmstrip.json
```

或者：

```text
audio.wav
↓
video-transcribe
↓
transcript.json
```

这就是典型的原子能力。

---

# 五、什么东西不适合做成 CLI

例如：

```text
给所有昨天上传但还没有分析的视频执行分析，
成功后更新专题状态，
失败超过3次通知管理员，
如果专题已经同步飞书，
则自动更新对应记录。
```

这不是一个原子能力。

它包含：

```text
业务查询
状态判断
批处理
重试
通知
工作流
```

更适合交给：

```text
Node Service
n8n
Temporal
Airflow
BullMQ
其他 Workflow Engine
```

如果把这种逻辑全部塞进：

```bash
video-analyze-everything
```

CLI 很快就会变成第二个平台。

---

# 六、CLI 非常适合做原子能力

我认为 CLI 最大的价值之一，就是：

> **把能力从平台中解耦出来。**

例如：

```text
video-filmstrip
```

只负责：

```text
Video
↓
Frames
↓
4×4 Filmstrip
```

它不知道：

```text
n8n
React
Fastify
SQLite
飞书
```

因此同一个 CLI 可以被：

```text
开发者手工执行

Node.js 调用

Python 调用

n8n 调用

CI 调用

测试调用

AI Agent 调用
```

例如：

```text
                 video-filmstrip
                       ↑
        ┌──────────────┼──────────────┐
        │              │              │
       n8n           Node          Terminal
```

这就是复用性。

---

# 七、CLI 的可复用性来自“稳定 Contract”

并不是：

> 写成命令行程序 = 自动可复用。

真正决定复用性的，是接口。

一个好的 CLI 应该尽量满足：

```text
输入明确
输出明确
行为确定
错误结构明确
少依赖全局状态
可重复运行
版本可追踪
```

例如：

```bash
video-filmstrip \
  --input /data/a.mp4 \
  --output /jobs/123/filmstrip \
  --segment-duration 90 \
  --rows 4 \
  --columns 4
```

永远产生：

```text
/jobs/123/filmstrip/
├── manifest.json
├── 001.jpg
├── 002.jpg
└── 003.jpg
```

这种工具会非常容易组合。

---

# 八、CLI 最理想的设计是“接近纯函数”

程序不可能完全是数学意义上的纯函数，但可以尽量做到：

```text
Input + Config
        ↓
      CLI
        ↓
     Output
```

而不是：

```text
CLI
↓
偷偷查询数据库
↓
判断用户状态
↓
修改飞书
↓
修改其他业务数据
↓
顺便发通知
```

后一种会让 CLI 很难测试和复用。

因此：

```text
video-transcribe
```

最好只负责：

```text
video/audio
↓
transcript
```

而不是：

```text
video-transcribe
↓
转字幕
↓
保存专题
↓
更新数据库
↓
发送飞书
```

---

# 九、批量能力应该由 CLI 提供吗

这是一个非常重要的设计问题。

例如现在有：

```text
100 个视频
```

究竟应该：

```bash
video-filmstrip --input-dir ./videos
```

由 CLI 自己处理100个？

还是：

```text
n8n
↓
循环100次
↓
video-filmstrip a.mp4
video-filmstrip b.mp4
video-filmstrip c.mp4
...
```

我通常推荐：

> **默认让 CLI 处理一个逻辑 Item，批量由上游 Orchestrator 管理。**

也就是：

```text
CLI
=
Single Item

Workflow
=
Many Items
```

---

# 十、为什么 Single Item CLI 更好

假设：

```bash
video-filmstrip video.mp4
```

只处理一个视频。

那么：

```text
Video A → 成功

Video B → 失败

Video C → 成功
```

工作流可以非常容易知道：

```text
A Completed
B Failed
C Completed
```

而如果：

```bash
video-filmstrip --input-dir ./1000-videos
```

CLI 内部处理1000个文件，那么调用方只看到：

```text
一个 Process
```

这时：

```text
第327条失败了怎么办？

已经处理了多少？

能不能并行？

能不能只重试327？

用户取消怎么办？

进度在哪里？
```

全部需要 CLI 自己实现。

CLI 很快就变成一个 Workflow Engine。

---

# 十一、批量通常应该交给下游调用方

例如：

```text
n8n
      │
      ├── video-001
      │       ↓
      │ video-filmstrip
      │
      ├── video-002
      │       ↓
      │ video-filmstrip
      │
      └── video-003
              ↓
        video-filmstrip
```

这样：

```text
调度
并发
重试
取消
状态
进度
```

全部由 n8n 管。

CLI 只处理：

> 一条视频怎么正确生成胶片流。

职责非常清楚。

---

# 十二、但 CLI 并不是永远不能支持 Batch

有一个重要例外：

> **如果批量本身可以带来显著的底层性能优化，那么 CLI 可以提供 batch mode。**

例如机器学习模型：

```text
1张图片推理一次
```

可能非常慢。

而：

```text
32张图片一起进入 GPU
```

效率高很多。

那么：

```bash
image-embedding \
  --manifest inputs.json
```

支持 Batch 是合理的。

因为这属于：

> **能力层内部优化。**

而不是业务 Workflow。

另一个例子：

```text
数据库一次 insert 1000 条
```

明显比：

```text
1000次单条 HTTP Request
```

快。

这种情况下：

```text
feishu-record-batch-create
```

也是合理的能力。

---

# 十三、所以 Batch 可以分两种

### Workflow Batch

例如：

```text
1000条视频
```

这是：

```text
业务上的1000个独立Item
```

应该让 Orchestrator 管。

### Compute Batch

例如：

```text
GPU一次处理32个Embedding
```

这是：

```text
底层计算优化
```

可以由 CLI 管。

这是两种完全不同的 Batch。

---

# 十四、推荐设计

CLI 默认：

```bash
video-filmstrip video.mp4
```

Single Item。

必要时增加：

```bash
video-filmstrip batch \
  --manifest files.json
```

但 Batch API 仍然应该保持每个 item 独立结果：

```json
{
  "items": [
    {
      "id": "a",
      "success": true
    },
    {
      "id": "b",
      "success": false,
      "error": {}
    }
  ]
}
```

而不能只返回：

```text
Batch failed
```

---

# 十五、批量失败后，“成功状态”应该由谁保存

假设有：

```text
100 条视频
```

第一次运行：

```text
97 成功
3 失败
```

重新执行时希望：

```text
97 条跳过

只重试3条
```

那么谁负责记住：

```text
哪97条成功了？
```

这里应该区分两个概念：

```text
Execution State

和

Cache / Artifact State
```

---

# 十六、Execution State 应该由 Orchestrator 保存

例如 n8n、Node Job Engine、Temporal 或数据库。

它负责保存：

```text
Job ID

Item ID

Status

Attempt

Started At

Finished At

Error

Retry Count
```

例如：

```text
Batch Job
job_001
```

下面：

```text
video_001   COMPLETED

video_002   COMPLETED

video_003   FAILED

video_004   COMPLETED
```

重新执行：

```text
SELECT *

WHERE status != COMPLETED
```

于是只执行：

```text
video_003
```

这是非常标准的职责划分。

---

# 十七、CLI 不应该保存“整个 Batch 的执行状态”

例如不要让：

```text
video-filmstrip
```

内部维护：

```text
~/.video-filmstrip/jobs.json
```

里面记录：

```text
这个项目处理了哪些视频
```

否则会出现：

```text
n8n有一套状态

CLI又有一套状态

数据库还有一套状态
```

最后谁才是真实状态？

会非常混乱。

所以：

> **Workflow execution state 应该只有一个 Owner。**

通常就是 Orchestrator。

---

# 十八、但 CLI 可以保存 Cache

这和 Job State 完全不同。

例如：

```text
video.mp4

SHA256 =
abc123
```

配置：

```text
4x4
90s per sheet
```

计算：

```text
configHash =
xyz789
```

于是：

```text
cache key

abc123:xyz789
```

如果已经存在：

```text
filmstrip
```

CLI 可以直接返回：

```json
{
  "success": true,
  "cached": true,
  "data": {}
}
```

这不是：

> “上次 Job 成功了，所以我跳过。”

而是：

> **“相同输入 + 相同算法配置的结果已经存在，所以无需重复计算。”**

这叫：

```text
Idempotency / Cache
```

不是：

```text
Workflow State
```

---

# 十九、State 和 Cache 一定要分开

推荐：

```text
Orchestrator Database

jobs
job_items
```

保存：

```text
谁执行了
什么时候执行
成功还是失败
重试几次
```

而：

```text
Artifact Cache

cache/
```

保存：

```text
某输入经过某版本算法后的结果
```

例如：

```text
cache/
└── video-filmstrip/
    └── v2/
        └── abc123_xyz789/
            ├── manifest.json
            ├── 001.jpg
            └── 002.jpg
```

两者生命周期也完全不同。

---

# 二十、任务状态怎么设计

例如：

```text
Batch Job
```

推荐：

```text
QUEUED

RUNNING

PARTIAL_SUCCESS

COMPLETED

FAILED

CANCELLED
```

Item：

```text
PENDING

RUNNING

COMPLETED

FAILED

SKIPPED

CANCELLED
```

另外：

```text
attempt

max_attempts

last_error

retryable
```

例如：

```text
video_001
COMPLETED

video_002
FAILED
attempt = 3

video_003
COMPLETED
```

重新运行时：

```text
Completed
→ 不执行

Failed + retryable
→ 执行

Failed + !retryable
→ 不自动执行
```

---

# 二十一、“Retry”最好不是重新启动整个 Batch

推荐语义：

```text
Retry Job
```

实际上：

```text
查询失败的 Item
↓
重新加入 Queue
```

例如：

```text
Original:

A ✓
B ✓
C ×
D ✓
E ×
```

点击：

```text
Retry Failed
```

执行：

```text
C
E
```

而不是：

```text
A
B
C
D
E
```

---

# 二十二、如果想重新跑所有 Item

应该是另一个明确操作：

```text
Re-run All
```

或者：

```text
Force Reprocess
```

这样语义清楚：

```text
Retry Failed
≠
Re-run All
```

---

# 二十三、状态应该什么时候清除

Job State 不应该任务一结束就马上删除。

否则：

```text
今天：

100个任务
3失败

明天：
用户打开系统

↓

不知道昨天发生了什么
```

状态同时承担：

```text
Debug

Audit

History

Metrics

Retry
```

所以需要保留一段时间。

---

# 二十四、推荐生命周期

例如：

```text
RUNNING Job
→ 永不自动清除

FAILED Job
→ 保留30天

COMPLETED Job
→ 保留7～30天

CANCELLED Job
→ 保留7天
```

具体时间取决于系统规模。

如果内部工具任务量不大：

```text
30天
```

全部保留都没有什么问题。

---

# 二十五、不要真的完全删除历史

一种更好的方式是：

```text
jobs
```

保留 summary。

而大量：

```text
job_logs

job_events
```

定期删除。

例如：

```text
Job Summary
保留180天

Item State
保留30天

Verbose Logs
保留7天
```

这样既能审计，又不会无限增长。

---

# 二十六、临时文件的生命周期应该更短

例如：

```text
audio.wav

frame-001.jpg

frame-002.jpg
```

这些不是 Job State。

属于：

```text
Temporary Artifact
```

应该：

```text
Task Success
↓
立即删除
```

失败时可以：

```text
保留1小时
```

方便调试。

然后 GC 自动清理。

例如：

```text
tmp/
```

规则：

```text
mtime > 24h
→ delete
```

---

# 二十七、最终产物不要跟 Job 一起清除

例如：

```text
transcript.json

filmstrip.jpg

analysis.json
```

这些属于：

```text
Business Artifact
```

只要视频分析结果仍然存在，它们就应该继续保留。

所以不要：

```text
Job删除
↓
所有输出删除
```

应该分开。

---

# 二十八、推荐把文件分成三种生命周期

### Temporary

例如：

```text
audio.wav

raw-frame-*.jpg

temporary chunks
```

生命周期：

```text
分钟 / 小时
```

---

### Cache

例如：

```text
模型Embedding

某版本Filmstrip中间结果

转码缓存
```

生命周期：

```text
几天 / 几周
```

可以重新生成。

---

### Artifact

例如：

```text
最终Filmstrip

Transcript

Analysis JSON
```

生命周期：

```text
跟业务对象一致
```

不能自动随意删除。

---

# 二十九、缓存什么时候应该失效

不能只按时间。

最好使用：

```text
Input Hash

+

Tool Version

+

Config Hash
```

例如：

```text
video hash
abc123

video-filmstrip version
2.1.0

config
{
  rows: 4,
  columns: 4,
  segmentDuration: 90
}
```

生成：

```text
artifact key
=
abc123 + 2.1.0 + configHash
```

如果：

```text
video没有变化
工具没有变化
参数没有变化
```

直接缓存命中。

如果：

```text
video-filmstrip
2.1.0
↓
2.2.0
```

自然产生新的 Cache Key。

不需要手工：

```text
清一下旧状态
```

---

# 三十、什么时候自动清 Cache

推荐：

```text
LRU
+
TTL
+
磁盘容量
```

例如：

```text
Cache TTL
30天

最大Cache
50 GB

磁盘使用率
> 80%
```

开始删除：

```text
最久未使用的 Cache
```

这比固定：

```text
每天清空
```

合理很多。

---

# 三十一、一个推荐的完整目录

例如一个 Job：

```text
workspace/
│
├── jobs/
│   └── job_123/
│       ├── job.json
│       └── logs/
│
├── artifacts/
│   └── video_001/
│       ├── filmstrip/
│       ├── transcript.json
│       └── analysis.json
│
├── cache/
│   ├── filmstrip/
│   └── speech/
│
└── tmp/
    └── job_123/
```

其中：

```text
jobs/
→ Workflow执行历史

artifacts/
→ 最终业务数据

cache/
→ 可重建

tmp/
→ 随时可以删除
```

边界非常明确。

---

# 三十二、如果使用 n8n，谁来保存 Batch State

如果整个 Batch 生命周期完全属于 n8n：

```text
n8n
```

可以保存 Workflow execution state。

但如果这个 Batch 是你自己业务平台的一部分，例如：

```text
专题：
深圳 Vlog

分析：
128 / 300
```

那么我更推荐：

```text
业务数据库保存 Job / Item 状态
```

n8n 只是执行者。

例如：

```text
Web
 ↓
创建

analysis_jobs
analysis_job_items

 ↓
触发 n8n
```

n8n 每处理一个 Item：

```text
CALL API

PATCH /job-items/:id
```

更新：

```text
RUNNING
COMPLETED
FAILED
```

这样即使以后：

```text
n8n
↓
换 Temporal
```

你的业务平台也不会失去任务状态。

---

# 三十三、推荐最终职责划分

可以归纳成：

```text
                 Platform
                    │
            Business State
                    │
                    ▼
               Orchestrator
                    │
               Job State
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
     CLI A        CLI B        CLI C
       │            │            │
       ▼            ▼            ▼
    Artifact      Artifact     Artifact
       │
       └──── Capability Cache
```

其中：

### Platform

负责：

```text
专题
视频
用户
分析结果
人工修改
```

### Orchestrator

负责：

```text
批量
并发
依赖
重试
执行状态
```

### CLI

负责：

```text
一项能力
```

### Cache

负责：

```text
避免相同计算重复执行
```

---

# 三十四、一个实际例子

假设有100条视频。

平台创建：

```text
job_001
```

数据库：

```text
job_items

001 PENDING
002 PENDING
003 PENDING
...
100 PENDING
```

n8n开始：

```text
Video 001
↓
video-filmstrip
↓
success
↓
COMPLETED
```

运行到：

```text
Video 037
```

Azure超时：

```text
FAILED

retryable = true
```

最终：

```text
97 COMPLETED

3 FAILED
```

第二天用户点击：

```text
Retry Failed
```

业务层查询：

```sql
WHERE
status = 'FAILED'
AND retryable = true
```

只重新提交：

```text
037
061
088
```

CLI 根本不知道：

```text
这是第一次执行
还是第二次执行
```

它只知道：

```text
input
↓
process
↓
output
```

如果相同 Artifact 已经存在：

```text
CLI cache hit
```

直接返回。

这就是比较干净的架构。

---

# 三十五、什么时候应该从脚本升级成 CLI

可以使用一个简单标准。

如果一个脚本开始满足其中三个以上：

```text
被多个项目调用

被自动化系统调用

需要稳定参数

需要稳定输出

需要错误码

需要测试

需要版本控制

需要别人使用

需要重试

需要文档
```

基本就应该考虑升级成 CLI。

---

# 三十六、什么时候 CLI 应该升级成 Service

CLI也不是终点。

如果出现：

```text
启动模型非常贵

需要GPU常驻

每次启动需要30秒

需要大量并发

需要持续保持连接

需要请求队列

需要集中权限控制
```

那么 CLI 可能应该升级成：

```text
Service
```

例如：

```text
Whisper Large V3
```

如果每次：

```bash
video-transcribe
```

都：

```text
加载模型
↓
20秒

识别
↓
5秒

退出
```

明显不合理。

更好的方式可能变成：

```text
Transcription Service

模型常驻GPU
```

CLI：

```bash
video-transcribe
```

其实只是：

```text
HTTP Client
```

调用：

```text
POST /transcribe
```

外部 Contract 仍然不变。

这也是 CLI 的一个好处：

> 底层实现可以从 Local Process 换成 Remote Service，而调用者不一定需要变化。

---

# 三十七、CLI 的真正价值不是“命令行”

很多人看到 CLI 会想到：

```text
给人在 Terminal 里面用
```

其实对于基础设施来说，更重要的是：

> **CLI 是一个稳定的进程级 API。**

HTTP API 的边界是：

```text
Network
```

CLI 的边界是：

```text
Process
```

例如：

```text
Node
↓
spawn()
↓
CLI
```

这已经是一种非常清晰的模块边界。

它天然拥有：

```text
stdin
stdout
stderr
exit code
environment
filesystem
```

因此特别适合：

```text
媒体处理
开发工具
模型工具
自动化工具
数据转换
构建工具
```

---

# 三十八、最终建议

如果在建设一套 AI 媒体处理平台，我会遵循以下原则：

> **1. 一项可独立描述的能力，优先考虑 CLI。**

例如：

```text
视频 → 胶片流

视频 → 字幕

图片 + 字幕 → 总结
```

> **2. CLI 默认 Single Item。**

不要让每个 CLI 都重新发明批处理系统。

> **3. Workflow Batch 由 Orchestrator 管。**

例如：

```text
n8n
Temporal
Node Job Engine
```

> **4. Compute Batch 可以由 CLI 管。**

例如 GPU Batch Inference。

> **5. Execution State 由 Orchestrator 保存。**

例如：

```text
PENDING
RUNNING
FAILED
COMPLETED
```

> **6. CLI 不保存整个业务 Workflow 的状态。**

否则会出现多个 Source of Truth。

> **7. CLI 可以维护 Cache / Idempotency。**

通过：

```text
Input Hash
+
Tool Version
+
Config Hash
```

判断结果是否已经存在。

> **8. Job、Cache、Artifact、Temp 必须区分生命周期。**

```text
Job
→ 执行历史

Cache
→ 可以删除并重新计算

Artifact
→ 正式业务结果

Temp
→ 尽快删除
```

---

# 结语

一个容易扩展的系统，通常不是“一个非常聪明的大程序”，而是很多职责清晰的小能力组合起来。

例如：

```text
video-probe
       ↓
video-filmstrip ─────┐
                     │
video-transcribe ────┼→ video-summarize
                     │
video-ocr ───────────┘
                         ↓
                    feishu-export
```

今天可能只需要：

```text
Filmstrip + Transcript + Summary
```

明天可以加入：

```text
OCR
```

后天加入：

```text
Face Detection
```

再以后加入：

```text
Embedding
Quality Analysis
Music Matching
```

只要每个能力都有稳定 Contract，上层 Workflow 就可以不断重新组合这些积木。

这时 CLI 的角色就非常清楚：

> **CLI 不负责知道整个系统应该怎么运行。**

> **CLI 只需要把自己负责的那一件事做到稳定、可测试、可重复、可组合。**

而批量、重试、状态和流程，则交给真正擅长这些事情的 Orchestrator。

这通常比把所有能力、流程和状态都写死在一个服务里，更容易演进成长期可维护的平台。
