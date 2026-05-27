# Plan Panel

Plan Panel is an Obsidian plugin for turning Markdown task lists into a lightweight planning board.

It follows the active Markdown file and helps you decide what to do today, what belongs in each quadrant, and what has already been started or completed.

## Features

- A Today list for tasks marked with `#today`
- Eisenhower-style quadrants
- Drag and drop ordering inside Today and quadrants
- Task completion tracking with `#done/YYYY-MM-DD`
- Start time tracking with `#started/YYYY-MM-DD-HHmm`
- Support for `- [ ]`, `* [ ]`, and `1. [ ]` task formats

## Install Manually

Copy these files into an Obsidian vault plugin folder:

```text
.obsidian/plugins/obsidian-plan-panel/
  main.js
  manifest.json
  styles.css
```

Then enable `Plan Panel` from Obsidian's Community plugins settings.

## Development

This repository currently uses a plain bundled `main.js` plugin structure.

During local development, copy the three plugin files into your vault's plugin folder and reload Obsidian.

## Markdown Tags

The plugin writes metadata directly into task lines:

```md
- [ ] Example task #today #started/2026-05-27-1432 #quadrant/Q1
- [x] Done task #started/2026-05-27-1432 #done/2026-05-27
```

## 中文说明

Plan Panel 是一个 Obsidian 插件，可以把 Markdown 任务列表增强成一个轻量的计划面板。

它会跟随当前打开的 Markdown 文件，帮助你管理今天要做的任务、四象限分类、开始时间和完成时间。

### 功能

- `Today` 区域：显示标记了 `#today` 的任务
- 四象限区域：按重要性和紧急程度分类任务
- 支持在 `Today` 和四象限内拖拽排序
- 完成任务时记录 `#done/YYYY-MM-DD`
- 点亮 `Today` 时记录 `#started/YYYY-MM-DD-HHmm`
- 支持 `- [ ]`、`* [ ]`、`1. [ ]` 三种任务格式

### 手动安装

把以下文件复制到 Obsidian vault 的插件目录：

```text
.obsidian/plugins/obsidian-plan-panel/
  main.js
  manifest.json
  styles.css
```

然后在 Obsidian 的 Community plugins 设置中启用 `Plan Panel`。

### Markdown 标签

插件会直接把状态标签写入任务行：

```md
- [ ] 示例任务 #today #started/2026-05-27-1432 #quadrant/Q1
- [x] 已完成任务 #started/2026-05-27-1432 #done/2026-05-27
```

## License

MIT
