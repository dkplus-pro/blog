---
title: 'Vue3 Composable 最佳实践：以播放器为例'
date: 2026-05-02
tags: ['前端', 'Vue', '架构', 'TypeScript']
description: '通过播放器实例深入讲解 Vue3 Composable 的设计理念、store/service/composable 的职责划分'
draft: false
---

这句话的意思是：

```txt
播放器相关逻辑不要全部堆在页面或 store 里。
能复用的交互逻辑下沉到 composable。
真正跟音频能力、接口、持久化有关的逻辑下沉到 service。
```

可以这样分层理解：

```txt
页面 page：负责展示和调用
组件 component：负责 UI
store：负责全局播放状态
composable：负责播放器交互流程
service：负责底层播放能力 / 接口能力
```

---

# 1. 什么叫播放器控制逻辑？

比如一个播放器会有这些逻辑：

```txt
播放
暂停
切换上一首
切换下一首
拖动进度条
更新当前播放时间
更新总时长
监听播放结束
监听播放错误
设置播放列表
缓存当前播放歌曲
恢复上次播放进度
上报播放错误
上报播放埋点
```

如果这些全写在页面里，页面会越来越乱。

如果全写在 store 里，store 也会越来越重。

所以要拆。

---

# 2. store 应该放什么？

store 只放 **播放器全局状态**。

比如：

```ts
// stores/player.ts
export const usePlayerStore = defineStore('player', () => {
  const playlist = ref<Song[]>([])
  const currentSong = ref<Song | null>(null)
  const currentIndex = ref(0)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)

  function setPlaylist(list: Song[]) {
    playlist.value = list
  }

  function setCurrentSong(song: Song) {
    currentSong.value = song
  }

  function setPlaying(value: boolean) {
    isPlaying.value = value
  }

  function setCurrentTime(value: number) {
    currentTime.value = value
  }

  function setDuration(value: number) {
    duration.value = value
  }

  return {
    playlist,
    currentSong,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    setPlaylist,
    setCurrentSong,
    setPlaying,
    setCurrentTime,
    setDuration
  }
})
```

store 不应该写太多：

```txt
innerAudioContext 创建
接口请求
埋点上报
错误上报
播放业务流程
```

这些可以下沉。

---

# 3. composable 应该放什么？

`composable` 放 **播放器业务交互流程**。

比如：

```txt
点击播放按钮时要做什么
点击下一首时要怎么切歌
播放结束后怎么自动下一首
拖动进度条后怎么 seek
播放失败时怎么提示
页面进入时怎么恢复状态
```

示例：

```ts
// composables/usePlayerControl.ts
import { usePlayerStore } from '@/stores/player'
import { playerService } from '@/services/player.service'

export function usePlayerControl() {
  const playerStore = usePlayerStore()

  async function play(song = playerStore.currentSong) {
    if (!song) {
      return
    }

    playerStore.setCurrentSong(song)
    await playerService.play(song.url)
    playerStore.setPlaying(true)
  }

  function pause() {
    playerService.pause()
    playerStore.setPlaying(false)
  }

  async function togglePlay() {
    if (playerStore.isPlaying) {
      pause()
      return
    }

    await play()
  }

  async function playNext() {
    const nextSong = getNextSong()

    if (!nextSong) {
      return
    }

    await play(nextSong)
  }

  function seek(time: number) {
    playerService.seek(time)
    playerStore.setCurrentTime(time)
  }

  function getNextSong() {
    const nextIndex = playerStore.currentIndex + 1
    return playerStore.playlist[nextIndex]
  }

  return {
    play,
    pause,
    togglePlay,
    playNext,
    seek
  }
}
```

这就是“控制逻辑下沉到 composable”。

页面就不用知道内部细节了。

---

# 4. service 应该放什么？

`service` 放 **底层能力**。

播放器里一般是：

```txt
创建播放器实例
调用 uni.createInnerAudioContext
play / pause / stop / seek
监听 onPlay / onPause / onEnded / onError / onTimeUpdate
销毁播放器
请求播放地址
上报播放错误
```

示例：

```ts
// services/player.service.ts
class PlayerService {
  private audio = uni.createInnerAudioContext()

  play(url: string) {
    if (this.audio.src !== url) {
      this.audio.src = url
    }

    this.audio.play()
  }

  pause() {
    this.audio.pause()
  }

  stop() {
    this.audio.stop()
  }

  seek(time: number) {
    this.audio.seek(time)
  }

  onTimeUpdate(callback: () => void) {
    this.audio.onTimeUpdate(callback)
  }

  onEnded(callback: () => void) {
    this.audio.onEnded(callback)
  }

  onError(callback: (error: any) => void) {
    this.audio.onError(callback)
  }

  destroy() {
    this.audio.destroy()
  }
}

export const playerService = new PlayerService()
```

这个 service 不关心页面，也不关心 UI。

它只负责：

```txt
我怎么真正控制播放器。
```

---

# 5. page 应该变成什么样？

页面只负责把 UI 和逻辑接起来。

```vue
<script setup lang="ts">
import { usePlayerStore } from '@/stores/player'
import { usePlayerControl } from '@/composables/usePlayerControl'

const playerStore = usePlayerStore()
const { togglePlay, playNext, seek } = usePlayerControl()
</script>

<template>
  <PlayerBar
    :song="playerStore.currentSong"
    :is-playing="playerStore.isPlaying"
    :current-time="playerStore.currentTime"
    :duration="playerStore.duration"
    @toggle-play="togglePlay"
    @next="playNext"
    @seek="seek"
  />
</template>
```

页面不再关心：

```txt
uni.createInnerAudioContext 怎么创建
播放结束怎么监听
seek 怎么调用
下一首怎么计算
错误怎么上报
```

这些都下沉了。

---

# 6. component 应该做什么？

播放器组件只做展示和事件抛出。

```vue
<script setup lang="ts">
defineProps<{
  song: Song | null
  isPlaying: boolean
  currentTime: number
  duration: number
}>()

const emit = defineEmits<{
  togglePlay: []
  next: []
  seek: [time: number]
}>()
</script>
```

组件不直接调用：

```ts
usePlayerStore()
playerService.play()
uni.createInnerAudioContext()
```

否则组件会变得很重，不好复用。

---

# 7. 最终分工

| 层          | 做什么                      |
| ---------- | ------------------------ |
| component  | 播放器 UI，props + emit      |
| page       | 连接 UI、store、composable   |
| store      | 保存全局播放状态                 |
| composable | 播放、暂停、下一首、seek 等业务流程     |
| service    | 调用 uni 音频 API、接口、上报等底层能力 |

---

# 8. 一句话理解

```txt
store 存状态；
composable 管流程；
service 管能力；
page 负责组装；
component 负责展示。
```

所以“播放器控制逻辑下沉到 composable / service”的意思就是：

```txt
不要让页面和 store 变成播放器的大杂烩。
把可复用的控制流程放 composable，
把底层播放 API 和接口能力放 service。
```
