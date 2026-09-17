# 逐字歌词打轴工具开发计划 v1.0

## 1. 开发目标

本项目第一阶段目标是完成一个轻量、专注的桌面歌词打轴工具。

核心能力：

- 导入音频
- 粘贴或导入歌词
- 自动拆分歌词 Token
- 播放音频
- 使用快捷键连续逐字打轴
- 使用 Timeline 拖动调整时间
- 支持时间轴缩放和平移
- 支持 Undo / Redo
- 保存和恢复工程
- 导出普通 LRC
- 导出逐字歌词
- 导出 SRT / JSON
- 支持自定义格式导出

第一版不加入：

- AI
- 人声分离
- 在线歌词
- 音乐管理
- 多轨编辑
- DSP
- EQ
- 云同步
- 插件系统

开发原则：

> 每完成一个阶段，都必须得到一个可以实际运行和验证的版本。

---

# 2. 总体阶段划分

整个 v1.0 推荐拆成 7 个阶段。

```text
Phase 0
项目初始化

↓

Phase 1
播放器 + Project 数据层

↓

Phase 2
歌词编辑 + 手动打轴

↓

Phase 3
Timeline 基础

↓

Phase 4
Timeline 高级编辑

↓

Phase 5
工程保存 + Undo

↓

Phase 6
导出系统

↓

Phase 7
打磨与发布
```

其中最关键的里程碑是：

```text
Phase 2
```

因为完成 Phase 2 后，即使没有高级 Timeline，软件已经可以真正用于逐字歌词打轴。

---

# 3. Phase 0：项目初始化

## 目标

建立完整工程骨架，保证后续功能可以持续扩展。

## 任务

### 3.1 创建项目

技术栈：

```text
Electron
Vue 3
TypeScript
Vite
Pinia
```

推荐使用 Electron + electron-vite。

目录：

```text
src/
├─ main/
├─ preload/
├─ renderer/
└─ shared/
```

---

### 3.2 配置基础能力

完成：

```text
Electron Main
Renderer
Preload
IPC
```

确保：

```text
Vue 页面可以调用 Electron IPC
```

---

### 3.3 建立代码规范

加入：

```text
ESLint
Prettier
TypeScript strict
```

建议开启：

```json
{
  "strict": true
}
```

---

### 3.4 建立 Pinia

先创建：

```text
projectStore
playerStore
timelineStore
historyStore
settingsStore
```

此阶段不需要完整逻辑。

---

## Phase 0 验收

能够运行：

```text
npm run dev
```

看到：

```text
Lyric Timeline
```

主窗口。

Electron：

```text
Main
Preload
Renderer
```

通信正常。

---

# 4. Phase 1：Project 与音频播放

## 目标

完成最基础的：

```text
打开音频
播放
暂停
Seek
获取准确 currentTime
```

并建立软件最核心的数据结构。

---

# 5. 数据模型实现

创建：

```text
src/renderer/models/
```

包括：

```text
project.ts
lyric.ts
audio.ts
timeline.ts
```

---

## 5.1 LyricToken

```ts
export interface LyricToken {
  id: string
  text: string
  start: number | null
  end: number | null
}
```

---

## 5.2 LyricLine

```ts
export interface LyricLine {
  id: string
  text: string
  tokens: LyricToken[]
}
```

建议：

```text
line.start
line.end
```

第一版不要作为独立数据保存。

通过：

```text
第一个 Token.start
最后一个 Token.end
```

动态计算。

避免数据重复。

---

## 5.3 LyricProject

```ts
export interface LyricProject {
  version: number
  id: string
  name: string

  audio: AudioSource | null

  metadata: ProjectMetadata

  lines: LyricLine[]

  settings: ProjectSettings

  createdAt: number
  updatedAt: number
}
```

---

# 6. AudioPlayer

建立：

```text
services/audio-player.ts
```

第一版直接使用：

```text
HTMLAudioElement
```

---

## 6.1 Player 状态

```ts
interface PlayerState {
  source: string | null
  currentTime: number
  duration: number
  playing: boolean
  volume: number
  playbackRate: number
}
```

---

## 6.2 必须实现

```text
load
play
pause
toggle
seek
setVolume
setPlaybackRate
```

---

## 6.3 时间同步

禁止：

```text
setInterval(() => currentTime += ...)
```

应该通过：

```text
audio.currentTime
```

获取真实时间。

UI 更新：

```text
requestAnimationFrame
```

---

# 7. Player UI

建立：

```text
PlayerBar.vue
```

第一版：

```text
▶ / ⏸
00:10.360 / 04:20.000
进度条
音量
播放速度
```

支持：

```text
点击进度条 Seek
```

---

## Phase 1 验收

用户可以：

```text
选择 MP3 / FLAC / WAV

播放

暂停

拖动时间

改变播放位置

看到准确时间
```

同时项目中已经存在完整：

```text
LyricProject
LyricLine
LyricToken
```

模型。

---

# 8. Phase 2：歌词与手动打轴

## 目标

完成第一个真正可用版本。

完成后用户已经可以：

```text
粘贴歌词
播放音乐
不停按 F
完成逐字时间轴
```

---

# 9. 歌词输入

建立：

```text
LyricsImportDialog.vue
```

输入：

```text
textarea
```

例如：

```text
徘徊着的在路上的
你要走吗 via via
易碎的骄傲着
```

---

# 10. Tokenizer

建立：

```text
services/tokenizer.ts
```

定义：

```ts
interface Tokenizer {
  tokenize(text: string): string[]
}
```

---

## 第一版实现

```text
charTokenizer
wordTokenizer
smartTokenizer
```

---

### charTokenizer

```text
徘徊着的
```

→

```text
徘
徊
着
的
```

---

### wordTokenizer

```text
take me home
```

→

```text
take
me
home
```

---

### smartTokenizer

中文：

```text
逐字符
```

英文：

```text
逐单词
```

---

# 11. LyricsPanel

建立：

```text
LyricsPanel.vue
```

显示：

```text
当前句
下一句
上一句
```

和全部歌词。

---

## 状态

每行显示：

```text
○ 未开始

◐ 部分完成

● 完成
```

---

# 12. Active Token

ProjectStore 增加：

```ts
currentLineIndex
currentTokenIndex
```

计算：

```ts
activeLine
activeToken
```

---

# 13. F 打轴逻辑

实现：

```text
TimingService
```

核心：

```ts
markCurrentToken(time)
```

行为：

```text
activeToken.start = time

如果存在 previousToken：

previousToken.end = time

activeToken 自动前进
```

---

# 14. Timing Offset

加入：

```text
timingOffsetMs
```

实际记录：

```ts
const time = player.currentTime + settings.timingOffsetMs / 1000
```

---

# 15. 最后 Token

当下一行第一个 Token 打轴时：

自动：

```text
上一行最后一个 Token.end
=
当前时间
```

---

# 16. 快捷键

第一批：

```text
Space
播放 / 暂停

F
打轴

Left
上一个 Token

Right
下一个 Token

Up
上一行

Down
下一行
```

---

# 17. 手动时间编辑

增加：

```text
TokenInspector.vue
```

显示：

```text
Token

Start

End

Duration
```

允许输入：

```text
00:10.360
```

进行修改。

---

## Phase 2 验收

用户执行：

```text
打开歌曲

↓

粘贴歌词

↓

播放

↓

F F F F F

↓

完成整句逐字时间
```

并可以：

```text
上一字 / 下一字

手动修改时间
```

到这里已经形成第一个可用版本：

```text
v0.1
```

---

# 18. Phase 3：Timeline 基础

## 目标

加入类似剪辑软件的编辑体验。

第一阶段 Timeline 不需要一开始支持所有高级功能。

只实现：

```text
Waveform

时间刻度

Token

Playhead

Seek

Zoom

Pan
```

---

# 19. Timeline 架构

建立：

```text
components/timeline/
```

建议：

```text
Timeline.vue

TimelineCanvas.vue

TimelineToolbar.vue
```

---

# 20. Canvas Renderer

建立：

```text
timeline/
TimelineRenderer.ts
```

职责：

```text
drawBackground

drawRuler

drawWaveform

drawTokens

drawPlayhead

drawSelection
```

---

# 21. Viewport

定义：

```ts
interface TimelineViewport {
  startTime: number
  pixelsPerSecond: number
  width: number
}
```

实现：

```ts
timeToX(time)

xToTime(x)
```

---

# 22. 时间刻度

根据 Zoom 动态选择：

```text
1ms
10ms
100ms
500ms
1s
5s
10s
```

不需要一开始非常复杂。

---

# 23. Playhead

绘制：

```text
currentTime
```

鼠标点击 Timeline：

```text
audio.currentTime = xToTime(mouseX)
```

支持拖动。

---

# 24. Zoom

实现：

```text
Ctrl + Wheel
```

重点：

```text
鼠标位置保持对应同一时间
```

也就是 Zoom Anchor。

---

# 25. Pan

实现：

```text
Space + Drag
```

或者：

```text
Middle Mouse Drag
```

修改：

```text
viewport.startTime
```

---

# 26. Waveform

第一版可以使用：

```text
Web Audio decodeAudioData
```

生成 peak。

建立：

```text
services/waveform.ts
```

输出：

```ts
interface WaveformData {
  peaks: Float32Array
  duration: number
}
```

---

# 27. Peak 生成

先采用固定采样：

```text
约 5000 ~ 20000 个 peak
```

足够显示普通歌曲。

不要第一版就做复杂多级 waveform cache。

---

# 28. Token Block

Canvas 绘制：

```text
start → x1

end → x2
```

形成矩形。

矩形中显示：

```text
Token.text
```

如果：

```text
start === null
```

不显示在 Timeline。

---

## Phase 3 验收

用户可以：

```text
看到波形

看到逐字块

看到播放头

点击时间轴跳转

缩放

拖动画布
```

完成：

```text
v0.2
```

---

# 29. Phase 4：Timeline 编辑

## 目标

实现软件最关键的拖动编辑能力。

---

# 30. Hit Testing

建立：

```text
TimelineHitTester.ts
```

绘制时生成：

```ts
interface HitRegion {
  type: 'token-body' | 'token-left' | 'token-right' | 'playhead'

  id: string

  x: number
  y: number
  width: number
  height: number
}
```

---

# 31. Token Move

鼠标拖 Token 中间：

```text
start += delta

end += delta
```

---

# 32. Token Resize

左 Handle：

```text
start
```

右 Handle：

```text
end
```

---

# 33. Linked Boundary

默认打开：

```text
token[i].end
=
token[i + 1].start
```

拖动边界时：

```text
同时修改左右两个 Token
```

---

# 34. Alt 解锁

按住：

```text
Alt
```

只修改当前 Token。

允许：

```text
gap
```

或者：

```text
overlap
```

---

# 35. 拖动整句

点击 Line Block 或提供：

```text
Move Line
```

修改本行所有 Token：

```text
start += delta
end += delta
```

---

# 36. 时间吸附

第一版只实现：

```text
邻近 Token 边界

Playhead
```

阈值：

```text
5 px
```

---

# 37. 微调快捷键

选中 Token：

```text
Ctrl + Left / Right
1ms

Left / Right
10ms

Shift + Left / Right
50ms
```

具体快捷键可以后续调整。

---

# 38. Selection

Phase 4 第一阶段只需要：

```text
单选 Token
```

多选和框选放后。

---

## Phase 4 验收

用户可以：

```text
拖 Token

拖左边界

拖右边界

调整相邻字边界

拖动整句

微调时间
```

这时核心编辑体验基本完成。

版本：

```text
v0.3
```

---

# 39. Phase 5：History 与工程系统

## 目标

保证用户可以放心编辑。

---

# 40. Undo / Redo

建立 Command 系统。

```ts
interface Command {
  execute(): void
  undo(): void
}
```

---

## Command 类型

第一批：

```text
SetTokenTimeCommand

MoveTokenCommand

ResizeTokenCommand

MoveLineCommand

ImportLyricsCommand
```

---

# 41. Drag Command

拖动过程中：

```text
mousedown
↓
保存 original
↓
mousemove
↓
preview
↓
mouseup
↓
生成一个 Command
```

禁止：

```text
每 mousemove 一个 Undo
```

---

# 42. 工程保存

格式：

```text
.lyricproj
```

JSON。

Main Process 提供：

```text
saveProject

loadProject
```

---

# 43. 保存内容

保存：

```text
project metadata

audio path

lyrics

tokens

time

settings
```

不保存：

```text
Undo History
```

---

# 44. Dirty State

ProjectStore：

```ts
dirty: boolean
```

任何编辑：

```text
dirty = true
```

成功保存：

```text
dirty = false
```

---

# 45. 自动保存

建立：

```text
autosave
```

推荐：

```text
30 秒
```

但只在：

```text
dirty === true
```

时执行。

---

# 46. 音频路径恢复

打开项目时：

```text
检测 audio.path
```

不存在：

弹出：

```text
重新定位音频
```

---

## Phase 5 验收

用户可以：

```text
Ctrl + Z

Ctrl + Shift + Z

Ctrl + S

关闭项目

重新打开

恢复全部打轴数据
```

版本：

```text
v0.4
```

---

# 47. Phase 6：导出系统

## 目标

实现格式解耦和自定义导出。

---

# 48. Exporter Interface

定义：

```ts
export interface LyricExporter {
  id: string
  name: string
  extension: string

  export(project: LyricProject): string
}
```

---

# 49. 内置 Exporter

实现顺序：

```text
JSON

LRC

Enhanced LRC

SRT

TXT
```

---

# 50. JSON Exporter

最简单。

用于验证内部数据。

---

# 51. LRC Exporter

输出：

```text
[00:10.36]徘徊着的在路上的
```

时间来自：

```text
first token.start
```

---

# 52. Enhanced LRC

输出：

```text
[00:10.36]<00:10.36>徘<00:10.82>徊...
```

---

# 53. SRT

输出：

```text
1
00:00:10,360 --> 00:00:14,200
徘徊着的在路上的
```

---

# 54. Export Dialog

建立：

```text
ExportDialog.vue
```

左侧：

```text
格式
```

右侧：

```text
实时预览
```

下方：

```text
Export
```

---

# 55. 自定义模板

定义：

```ts
interface ExportTemplate {
  id: string
  name: string
  extension: string

  lineTemplate: string
  tokenTemplate: string
  separator: string
}
```

---

# 56. 支持变量

第一版：

```text
{{line.index}}
{{line.text}}
{{line.start}}
{{line.end}}
{{line.duration}}

{{token.index}}
{{token.text}}
{{token.start}}
{{token.end}}
{{token.duration}}
```

---

# 57. 时间格式

实现：

```text
seconds

milliseconds

mm:ss.xx

mm:ss.xxx

hh:mm:ss.xxx
```

---

# 58. 模板示例

Line：

```text
[{{line.start|mm:ss.xx}}]{{tokens}}
```

Token：

```text
<{{token.start|mm:ss.xx}}>{{token.text}}
```

---

# 59. Template Engine

不要引入：

```text
Handlebars
Liquid
EJS
```

第一版自己写简单 parser 即可。

只解析：

```text
{{variable}}
```

和：

```text
{{variable|formatter}}
```

---

# 60. Export Preset

保存位置：

```text
userData/export-presets.json
```

功能：

```text
新增

复制

编辑

删除
```

---

## Phase 6 验收

用户可以：

```text
导出普通 LRC

导出逐字 LRC

导出 SRT

导出 JSON

自己定义格式

看到实时预览
```

版本：

```text
v0.5
```

---

# 61. Phase 7：体验打磨

## 目标

从“能用”提升到“愿意长期使用”。

---

# 62. Loop Playback

选中 Token：

```text
R
```

循环：

```text
token.start - preRoll
~
token.end + postRoll
```

---

# 63. Pre-roll

设置：

```text
300ms
```

用于试听。

---

# 64. 自动跟随

播放头到达：

```text
80%
```

自动滚动 Timeline。

---

# 65. Timeline 视觉优化

增加：

```text
主要刻度

次要刻度

选中状态

Hover

Resize Cursor

Snap 指示线
```

---

# 66. 歌词状态

显示：

```text
未打轴

部分完成

完成
```

---

# 67. 快捷键设置

第一版可只提供：

```text
配置文件
```

后续再做 UI。

---

# 68. 最近工程

启动页：

```text
New Project

Open Project

Recent Projects
```

---

# 69. 异常恢复

处理：

```text
工程损坏

音频不存在

音频加载失败

非法时间

导出失败
```

---

# 70. 性能优化

重点检查：

```text
播放期间 Vue 是否频繁重新渲染

Timeline Canvas FPS

大量 Token 时性能

Waveform 生成耗时

拖动是否卡顿
```

---

## Phase 7 验收

连续编辑完整歌曲时：

```text
无明显卡顿

播放头平滑

拖动跟手

Zoom 流畅

Undo 可靠

工程不丢数据
```

达到：

```text
v1.0
```

---

# 71. 推荐开发顺序

实际写代码时推荐严格按照下面顺序。

```text
01
Electron + Vue 初始化

02
Project Models

03
Player Store

04
AudioPlayer

05
PlayerBar

06
Lyrics Import

07
Tokenizer

08
LyricsPanel

09
Active Token

10
F Timing

11
Timing Offset

12
Token Inspector

13
Timeline Viewport

14
Time Ruler

15
Playhead

16
Zoom / Pan

17
Waveform

18
Token Renderer

19
Hit Test

20
Token Move

21
Resize

22
Linked Boundary

23
Line Move

24
History

25
Project Save

26
Project Load

27
Autosave

28
LRC Export

29
Enhanced LRC

30
SRT

31
Custom Template

32
Export Preview

33
Loop

34
Follow Playhead

35
体验打磨
```

---

# 72. 推荐版本节点

## v0.1

目标：

```text
能打轴
```

包括：

```text
播放器

歌词

Tokenizer

F 打轴

时间编辑
```

---

## v0.2

目标：

```text
能看到 Timeline
```

包括：

```text
Waveform

Playhead

Token

Zoom

Pan
```

---

## v0.3

目标：

```text
能拖动编辑
```

包括：

```text
Move

Resize

Linked Boundary

Line Move
```

---

## v0.4

目标：

```text
工程可靠
```

包括：

```text
Undo

Redo

Save

Load

Autosave
```

---

## v0.5

目标：

```text
能完整输出
```

包括：

```text
LRC

Enhanced LRC

SRT

JSON

Custom
```

---

## v1.0

目标：

```text
整个使用流程顺畅
```

增加：

```text
Loop

Pre-roll

Follow

Recent Project

异常处理

性能优化

UI 打磨
```

---

# 73. MVP 最小完成线

如果开发过程中希望尽快拿到一个能自己使用的版本，那么做到：

```text
Player

Lyrics Import

Tokenizer

F Timing

Token Inspector

Project Save

Enhanced LRC Export
```

就可以暂停其它开发，先实际打几首歌曲。

这是非常重要的一步。

因为实际使用后很可能会发现：

```text
F 的行为需要调整

句尾规则需要调整

英文 Token 逻辑需要调整

快捷键需要调整
```

这些体验问题应当在 Timeline 大量开发之前发现。

---

# 74. Timeline 开发优先级

Timeline 功能很多，但优先级必须明确。

第一优先级：

```text
Playhead

Waveform

Token Block

Zoom

Pan
```

第二优先级：

```text
Move

Resize

Linked Boundary
```

第三优先级：

```text
Snap

Line Move

Loop
```

第四优先级：

```text
多选

框选

复杂吸附

高级快捷键
```

不要反过来。

---

# 75. 风险点

## 75.1 HTMLAudioElement 精度

对于歌词打轴已经基本足够。

暂时不要为：

```text
sample accurate playback
```

重写音频引擎。

如果后续发现明显精度问题，再考虑 Web Audio。

---

## 75.2 Canvas Timeline

最容易膨胀成整个项目最大的模块。

因此必须拆成：

```text
Renderer

Viewport

HitTester

Interaction

Selection
```

不要全部写进：

```text
Timeline.vue
```

---

## 75.3 Undo

一定要在 Timeline 开始编辑时尽早加入设计。

否则大量修改状态的代码完成后再补 Undo，会很痛苦。

---

## 75.4 Project Model

内部数据结构一旦稳定：

```text
不要围绕某个歌词格式修改
```

所有格式转换必须存在于 Exporter 层。

---

# 76. 推荐核心模块边界

最终核心代码可以收敛成：

```text
Project
负责数据

Player
负责音频

Timing
负责打轴

Timeline
负责可视化与交互

History
负责撤销

Exporter
负责格式转换
```

各模块不要交叉承担职责。

---

# 77. 完成标准

v1.0 发布前至少实际完成：

```text
3~5 首完整歌曲
```

测试。

覆盖：

```text
纯中文

纯英文

中英混合

快节奏

慢歌
```

验证：

```text
Token 拆分

F 打轴

长音

空白段

句尾

拖动

保存恢复

不同格式导出
```

---

# 78. 最终开发策略

整个开发过程应遵循：

```text
先做数据

再做行为

再做 Timeline

最后做视觉
```

而不是：

```text
先把编辑器画得很漂亮
```

第一阶段真正需要验证的是：

```text
能不能快速完成一首歌的逐字打轴
```

只要这个体验成立，后面的 Timeline、导出格式、AI 都只是逐步增强。

因此整个项目最重要的第一个开发目标不是 v1.0，而是尽快做出：

```text
v0.1
```

并拿它真正打完一首歌。
