# Lyric Timeline

一个面向桌面的逐字歌词打轴工具。首要目标是让用户导入音频与歌词后，通过连续按键快速完成逐字时间标记，再进行可视化微调和多格式导出。

## 当前状态

Phase 0 工程基线：Electron、Vue 3、TypeScript、Vite、Pinia、IPC、安全隔离、代码规范与测试框架已经搭好。

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
