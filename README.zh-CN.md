# Plan Panel

[English](README.md) | 中文

Plan Panel 是一个 Obsidian 插件，可以把 Markdown 任务列表增强成一个轻量的计划面板。

它会跟随当前打开的 Markdown 文件，帮助你管理今天要做的任务、四象限分类、开始时间和完成时间。

## 功能

- `Today` 区域：显示标记了 `#today` 的任务
- 四象限区域：按重要性和紧急程度分类任务
- 支持在 `Today` 和四象限内拖拽排序
- 完成任务时记录 `#done/YYYY-MM-DD`
- 点亮 `Today` 时记录 `#started/YYYY-MM-DD-HHmm`
- 支持 `- [ ]`、`* [ ]`、`1. [ ]` 三种任务格式

## 手动安装

把以下文件复制到 Obsidian vault 的插件目录：

```text
.obsidian/plugins/obsidian-plan-panel/
  main.js
  manifest.json
  styles.css
```

然后在 Obsidian 的 Community plugins 设置中启用 `Plan Panel`。

## 开发

当前仓库使用简单的 `main.js` 插件结构，还没有构建步骤。

本地开发时，把三个插件文件复制到你的 vault 插件目录，然后重载 Obsidian。

## Markdown 标签

插件会直接把状态标签写入任务行：

```md
- [ ] 示例任务 #today #started/2026-05-27-1432 #quadrant/Q1
- [x] 已完成任务 #started/2026-05-27-1432 #done/2026-05-27
```

## 许可证

MIT
