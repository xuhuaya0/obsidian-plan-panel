# Plan Panel

Plan Panel is an Obsidian plugin for turning Markdown task lists into a lightweight planning board.

It follows the active Markdown file and provides:

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

## License

MIT
