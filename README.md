# Lyric Timeline

一个面向桌面的逐字歌词打轴工具。首要目标是让用户导入音频与歌词后，通过连续按键快速完成逐字时间标记，再进行可视化微调和多格式导出。

## 当前状态

Phase 4 时间轴编辑：安全本地音频播放、歌词打轴、Canvas Timeline、波形、Token 移动/缩放、相邻边界联动、整句移动、5 px 吸附和键盘微调已经完成。

时间轴操作：拖动 Token 中部移动，拖动两侧白色 Handle 调整边界；默认联动相邻 Token，按住 `Alt` 临时解锁；`Ctrl/⌘ + ←/→` 微调 1 ms，`Shift + ←/→` 微调 50 ms。

## 开发环境

- Node.js 22.22 或更高版本（推荐当前 LTS）
- npm 10 或更高版本
- macOS、Windows 或 Linux 桌面环境

## 开始开发

```bash
npm install
npm run dev
```

常用检查：

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## 目录

```text
src/
├── main/          Electron 主进程
├── preload/       安全的渲染进程桥接层
├── renderer/      Vue 桌面界面
└── shared/        跨进程类型、协议与领域模型
```

需求与完整功能阶段见 [原始开发计划](docs/plan.md)，可执行排期与交付门槛见 [开发路线图](docs/roadmap.md)。

## 安全约束

渲染进程不开启 Node.js，所有系统能力必须通过 preload 暴露窄接口，并使用共享类型约束 IPC。音频路径、工程文件和导出能力后续也沿用此边界。
