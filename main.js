const { ItemView, Notice, Plugin, TFile } = require("obsidian");

const VIEW_TYPE = "plan-priority-board-view";
const QUADRANT_ORDER = { Q1: 0, Q2: 1, Q3: 2, Q4: 3 };
const QUADRANTS = [
  { id: "Q1", label: "Important / Urgent" },
  { id: "Q2", label: "Important / Later" },
  { id: "Q3", label: "Low Value / Urgent" },
  { id: "Q4", label: "Low Value / Later" }
];
const TASK_RE = /^(\s*)((?:[-*]|\d+\.)\s+\[[ xX]\]\s*)(.*)$/;

function cleanTitle(raw) {
  return raw
    .replace(/\s*#priority\/P[0-3]\b/g, "")
    .replace(/\s*#quadrant\/Q[1-4]\b/g, "")
    .replace(/\s*#done\/\d{4}-\d{2}-\d{2}\b/g, "")
    .replace(/\s*#started\/\d{4}-\d{2}-\d{2}-\d{4}\b/g, "")
    .replace(/\s*#today\b/g, "")
    .trim();
}

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startedString() {
  const date = new Date();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${todayString()}-${hours}${minutes}`;
}

function parseTasks(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const tasks = [];
  const stack = [];
  const taskStack = [];

  lines.forEach((line, lineIndex) => {
    const match = line.match(TASK_RE);
    if (!match) return;

    const indent = match[1] || "";
    const indentWidth = indent.replace(/\t/g, "    ").length;
    while (taskStack.length && indentWidth <= taskStack[taskStack.length - 1].indentWidth) {
      taskStack.pop();
      stack.pop();
    }
    const level = taskStack.length;
    const body = match[3] || "";
    const quadrant = (body.match(/#quadrant\/(Q[1-4])\b/) || [])[1] || "";
    const completedAt = (body.match(/#done\/(\d{4}-\d{2}-\d{2})\b/) || [])[1] || "";
    const startedAt = (body.match(/#started\/(\d{4}-\d{2}-\d{2}-\d{4})\b/) || [])[1] || "";
    const today = /#today\b/.test(body);
    const title = cleanTitle(body);
    const parent = taskStack[taskStack.length - 1] || null;
    if (parent) parent.hasChildren = true;

    stack[level] = title;
    stack.length = level + 1;

    const task = {
      id: `task-${lineIndex}`,
      lineIndex,
      indent,
      indentWidth,
      prefix: match[2],
      title,
      completed: /\[[xX]\]/.test(match[2]),
      completedAt,
      startedAt,
      today,
      level,
      parentId: parent ? parent.id : "",
      children: [],
      path: stack.slice(0, -1).join(" / "),
      quadrant,
      hasChildren: false
    };
    tasks.push(task);
    if (parent) parent.children.push(task);
    taskStack.push(task);
  });

  return { lines, tasks };
}

class PlanPriorityBoardView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.currentFile = null;
    this.lines = [];
    this.tasks = [];
    this.expanded = new Set();
    this.dragTaskId = "";
    this.isSaving = false;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "Plan Panel";
  }

  getIcon() {
    return "layout-dashboard";
  }

  async onOpen() {
    this.containerEl.empty();
    this.containerEl.addClass("plan-board-view");
    await this.loadActiveMarkdown();
  }

  isMarkdownFile(file) {
    return file instanceof TFile && file.extension === "md";
  }

  async loadActiveMarkdown() {
    const activeFile = this.app.workspace.getActiveFile();
    if (this.isMarkdownFile(activeFile)) {
      await this.loadFile(activeFile);
      return;
    }
    this.clearFile();
  }

  async loadActiveFile(file) {
    if (!this.isMarkdownFile(file)) {
      this.clearFile();
      return;
    }
    if (this.currentFile && this.currentFile.path === file.path) return;
    await this.loadFile(file);
  }

  clearFile() {
    this.currentFile = null;
    this.lines = [];
    this.tasks = [];
    this.expanded = new Set();
    this.render();
  }

  async loadFile(file) {
    if (this.isSaving) return;
    this.currentFile = file;
    const parsed = parseTasks(await this.app.vault.read(file));
    this.lines = parsed.lines;
    this.tasks = parsed.tasks;
    this.expanded = new Set();
    this.render();
  }

  applyTaskTagsToLine(task) {
    const base = `${task.indent}${task.prefix}${task.title}`;
    const tags = [];
    if (task.quadrant) tags.push(`#quadrant/${task.quadrant}`);
    if (task.today && !task.completed) tags.push("#today");
    if (task.startedAt) tags.push(`#started/${task.startedAt}`);
    if (task.completedAt) tags.push(`#done/${task.completedAt}`);
    this.lines[task.lineIndex] = [base, ...tags].join(" ");
  }

  async save(silent = true) {
    if (!this.currentFile) {
      new Notice("Open a plan file first");
      return;
    }
    this.tasks.forEach((task) => this.applyTaskTagsToLine(task));
    this.isSaving = true;
    await this.app.vault.modify(this.currentFile, this.lines.join("\n"));
    window.setTimeout(() => {
      this.isSaving = false;
    }, 250);
    if (!silent) new Notice(`已保存 ${this.currentFile.path}`);
  }

  rootTasks() {
    return this.sortTaskGroup(this.tasks.filter((task) => !task.parentId));
  }

  nextTasks() {
    return this.orderedTodayTasks();
  }

  sortTaskGroup(tasks) {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.lineIndex - b.lineIndex;
    });
  }

  taskById(id) {
    return this.tasks.find((task) => task.id === id);
  }

  ancestorsOf(task) {
    const ancestors = [];
    let current = task;
    while (current && current.parentId) {
      current = this.taskById(current.parentId);
      if (current) ancestors.push(current);
    }
    return ancestors;
  }

  descendantsOf(task) {
    const descendants = [];
    const collect = (item) => {
      item.children.forEach((child) => {
        descendants.push(child);
        collect(child);
      });
    };
    collect(task);
    return descendants;
  }

  treeTaskIsGrey(task) {
    if (task.completed || task.quadrant) return true;
    if (!task.children.length) return false;
    return task.children.every((child) => this.treeTaskIsGrey(child));
  }

  taskKey(task) {
    return `${task.path ? `${task.path} / ` : ""}${task.title}`;
  }

  orderFor(quadrant) {
    if (!this.currentFile) return [];
    return (((this.plugin.quadrantOrder || {})[this.currentFile.path] || {})[quadrant] || []);
  }

  todayOrderForCurrentFile() {
    if (!this.currentFile) return [];
    return ((this.plugin.todayOrder || {})[this.currentFile.path] || []);
  }

  orderedQuadrantTasks(quadrant) {
    const order = this.orderFor(quadrant);
    const orderIndex = new Map(order.map((key, index) => [key, index]));
    return this.tasks
      .filter((task) => task.quadrant === quadrant)
      .sort((a, b) => {
        const ai = orderIndex.has(this.taskKey(a)) ? orderIndex.get(this.taskKey(a)) : 9999;
        const bi = orderIndex.has(this.taskKey(b)) ? orderIndex.get(this.taskKey(b)) : 9999;
        if (ai !== bi) return ai - bi;
        return a.lineIndex - b.lineIndex;
      });
  }

  orderedTodayTasks() {
    const order = this.todayOrderForCurrentFile();
    const orderIndex = new Map(order.map((key, index) => [key, index]));
    return this.tasks
      .filter((task) => task.today && !task.completed)
      .sort((a, b) => {
        const ai = orderIndex.has(this.taskKey(a)) ? orderIndex.get(this.taskKey(a)) : 9999;
        const bi = orderIndex.has(this.taskKey(b)) ? orderIndex.get(this.taskKey(b)) : 9999;
        if (ai !== bi) return ai - bi;
        const qa = a.quadrant ? QUADRANT_ORDER[a.quadrant] : 9;
        const qb = b.quadrant ? QUADRANT_ORDER[b.quadrant] : 9;
        if (qa !== qb) return qa - qb;
        if (a.level !== b.level) return a.level - b.level;
        return a.lineIndex - b.lineIndex;
      });
  }

  async setQuadrantOrder(quadrant, tasks) {
    if (!this.currentFile) return;
    await this.plugin.setQuadrantOrder(this.currentFile.path, quadrant, tasks.map((task) => this.taskKey(task)));
  }

  async setTodayOrder(tasks) {
    if (!this.currentFile) return;
    await this.plugin.setTodayOrder(this.currentFile.path, tasks.map((task) => this.taskKey(task)));
  }

  async reorderToday(task, beforeTask = null) {
    if (!task.today || task.completed) return;
    const ordered = this.orderedTodayTasks().filter((item) => item.id !== task.id);
    const beforeIndex = beforeTask ? ordered.findIndex((item) => item.id === beforeTask.id) : -1;
    if (beforeIndex >= 0) ordered.splice(beforeIndex, 0, task);
    else ordered.push(task);
    await this.setTodayOrder(ordered);
    this.render();
  }

  async assignQuadrant(task, quadrant, beforeTask = null) {
    if (this.descendantsOf(task).some((item) => item.quadrant && !item.completed)) {
      return;
    }
    const oldQuadrant = task.quadrant;
    if (oldQuadrant && oldQuadrant !== quadrant) {
      await this.setQuadrantOrder(oldQuadrant, this.orderedQuadrantTasks(oldQuadrant).filter((item) => item.id !== task.id));
    }
    for (const ancestor of this.ancestorsOf(task)) {
      if (!ancestor.quadrant) continue;
      const ancestorQuadrant = ancestor.quadrant;
      ancestor.quadrant = "";
      this.applyTaskTagsToLine(ancestor);
      await this.setQuadrantOrder(ancestorQuadrant, this.orderedQuadrantTasks(ancestorQuadrant).filter((item) => item.id !== ancestor.id));
    }
    task.quadrant = quadrant;
    this.applyTaskTagsToLine(task);
    const ordered = this.orderedQuadrantTasks(quadrant).filter((item) => item.id !== task.id);
    const beforeIndex = beforeTask ? ordered.findIndex((item) => item.id === beforeTask.id) : -1;
    if (beforeIndex >= 0) ordered.splice(beforeIndex, 0, task);
    else ordered.push(task);
    await this.setQuadrantOrder(quadrant, ordered);
    await this.save();
    this.render();
  }

  async clearQuadrant(task) {
    const oldQuadrant = task.quadrant;
    task.quadrant = "";
    this.applyTaskTagsToLine(task);
    if (oldQuadrant) await this.setQuadrantOrder(oldQuadrant, this.orderedQuadrantTasks(oldQuadrant).filter((item) => item.id !== task.id));
    await this.save();
    this.render();
  }

  async toggleTaskDone(task, done) {
    task.completed = done;
    task.completedAt = done ? todayString() : "";
    if (done) task.today = false;
    task.prefix = task.prefix.replace(/\[[ xX]\]/, done ? "[x]" : "[ ]");
    this.applyTaskTagsToLine(task);
    if (done) await this.setTodayOrder(this.orderedTodayTasks().filter((item) => item.id !== task.id));
    await this.save();
    this.render();
  }

  async toggleToday(task) {
    task.today = !task.today;
    if (task.today && !task.startedAt) task.startedAt = startedString();
    if (!task.today) task.startedAt = "";
    this.applyTaskTagsToLine(task);
    if (task.today) await this.setTodayOrder([...this.orderedTodayTasks().filter((item) => item.id !== task.id), task]);
    else await this.setTodayOrder(this.orderedTodayTasks().filter((item) => item.id !== task.id));
    await this.save();
    this.render();
  }

  render() {
    this.containerEl.empty();

    const header = this.containerEl.createDiv("plan-board-header");
    const titleWrap = header.createDiv();
    titleWrap.createDiv({ cls: "plan-board-title", text: "Plan Panel" });
    const toolbar = header.createDiv("plan-board-toolbar");
    toolbar.createDiv({
      cls: "plan-board-current-file",
      text: this.currentFile ? this.currentFile.path : ""
    });

    this.renderNextSection();
    this.renderAllPlans(this.containerEl);
    this.renderQuadrants(this.containerEl);
  }

  renderNextSection() {
    const section = this.containerEl.createDiv("plan-board-section");
    const head = section.createDiv("plan-board-section-head");
    head.createDiv({ cls: "plan-board-section-title", text: "Today" });
    const list = section.createDiv("plan-board-todo-list");
    list.ondragover = (event) => {
      event.preventDefault();
    };
    list.ondrop = (event) => {
      event.preventDefault();
      const task = this.tasks.find((item) => item.id === this.dragTaskId);
      if (task) this.reorderToday(task);
    };
    const tasks = this.nextTasks();
    if (!tasks.length) {
      list.createDiv({ cls: "plan-board-empty" });
      return;
    }
    tasks.forEach((task) => list.appendChild(this.renderTodoTask(task)));
  }

  renderAllPlans(parent) {
    const section = parent.createDiv("plan-board-section");
    const head = section.createDiv("plan-board-section-head");
    head.createDiv({ cls: "plan-board-section-title", text: "All Plans" });
    const panel = section.createDiv("plan-board-panel");
    const list = panel.createDiv("plan-board-list");

    if (!this.currentFile) {
      list.createDiv({ cls: "plan-board-empty" });
    } else {
      this.rootTasks().forEach((task) => this.renderTreeTask(list, task));
    }

  }

  renderTodoTask(task) {
    const row = createDiv("plan-board-todo");
    row.dataset.id = task.id;
    row.draggable = true;
    row.ondragstart = () => {
      this.dragTaskId = task.id;
    };
    row.ondragover = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    row.ondrop = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const dragged = this.tasks.find((item) => item.id === this.dragTaskId);
      if (!dragged || dragged.id === task.id) return;
      this.reorderToday(dragged, task);
    };
    if (task.quadrant) row.addClass(`plan-board-todo-${task.quadrant.toLowerCase()}`);
    if (task.completed) row.addClass("is-done");
    const checkbox = row.createEl("input", { type: "checkbox" });
    checkbox.checked = task.completed;
    checkbox.onchange = () => this.toggleTaskDone(task, checkbox.checked);
    const text = row.createDiv("plan-board-todo-text");
    text.createDiv({ cls: "plan-board-task-title", text: task.title || "未命名任务" });
    if (task.path) text.createDiv({ cls: "plan-board-path", text: task.path });
    return row;
  }

  renderTreeTask(parent, task) {
    parent.appendChild(this.renderTask(task, {
      tree: true,
      draggable: true,
      fadeWhenQuadrant: true,
      forceFaded: this.treeTaskIsGrey(task),
      list: true,
      todayButton: true
    }));
    if (!this.expanded.has(task.id)) return;
    this.sortTaskGroup(task.children).forEach((child) => this.renderTreeTask(parent, child));
  }

  renderQuadrants(parent) {
    const section = parent.createDiv("plan-board-section");
    const head = section.createDiv("plan-board-section-head");
    head.createDiv({ cls: "plan-board-section-title", text: "Quadrants" });
    const quads = section.createDiv("plan-board-quads");
    QUADRANTS.forEach(({ id: q, label }) => {
      const quad = quads.createDiv(`plan-board-quad plan-board-quad-${q.toLowerCase()}`);
      quad.dataset.q = q;
      const quadHead = quad.createDiv("plan-board-quad-head");
      quadHead.createDiv({ text: label });
      quad.ondragover = (event) => {
        event.preventDefault();
        quad.addClass("is-over");
      };
      quad.ondragleave = () => quad.removeClass("is-over");
      quad.ondrop = (event) => {
        event.preventDefault();
        quad.removeClass("is-over");
        const task = this.tasks.find((item) => item.id === this.dragTaskId);
        if (!task) return;
        this.assignQuadrant(task, q);
      };
      this.orderedQuadrantTasks(q)
        .filter((task) => !task.completed)
        .forEach((task) => quad.appendChild(this.renderTask(task, { flat: true, showPath: true, draggable: true, dropQuadrant: q, todayButton: true })));
    });
    const removeZone = section.createDiv("plan-board-remove-zone");
    removeZone.createSpan({ text: "Remove from Quadrants" });
    removeZone.ondragover = (event) => {
      event.preventDefault();
      removeZone.addClass("is-over");
    };
    removeZone.ondragleave = () => removeZone.removeClass("is-over");
    removeZone.ondrop = (event) => {
      event.preventDefault();
      removeZone.removeClass("is-over");
      const task = this.tasks.find((item) => item.id === this.dragTaskId);
      if (!task) return;
      this.clearQuadrant(task);
    };
  }

  renderTask(task, options = {}) {
    const row = createDiv("plan-board-task");
    row.dataset.id = task.id;
    row.style.setProperty("--level", String(options.flat ? 0 : task.level));
    if (options.list) row.addClass("is-list");
    if (task.completed) row.addClass("is-done");
    if (options.draggable) {
      row.draggable = true;
      row.ondragstart = () => {
        this.dragTaskId = task.id;
      };
    }
    if (options.dropQuadrant) {
      row.ondragover = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };
      row.ondrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const dragged = this.tasks.find((item) => item.id === this.dragTaskId);
        if (!dragged || dragged.id === task.id) return;
        this.assignQuadrant(dragged, options.dropQuadrant, task);
      };
    }
    if (options.forceFaded || (options.fadeWhenQuadrant && task.quadrant)) row.addClass("is-faded");

    const checkbox = row.createEl("input", { type: "checkbox" });
    checkbox.checked = task.completed;
    checkbox.onchange = () => this.toggleTaskDone(task, checkbox.checked);

    const main = row.createDiv("plan-board-task-main");
    main.createDiv("plan-board-indent");

    if (options.tree) {
      const isOpen = this.expanded.has(task.id);
      const toggle = main.createEl("button", {
        cls: `plan-board-toggle${task.hasChildren ? "" : " is-empty"}${isOpen ? " is-open" : ""}`,
        attr: { "aria-label": isOpen ? "Collapse" : "Expand" }
      });
      toggle.onclick = (event) => {
        event.stopPropagation();
        if (isOpen) this.expanded.delete(task.id);
        else this.expanded.add(task.id);
        this.render();
      };
    }

    const text = main.createDiv();
    text.createDiv({ cls: "plan-board-task-title", text: task.title || "未命名任务" });
    if (task.path && (options.showPath || options.flat)) text.createDiv({ cls: "plan-board-path", text: task.path });
    if (task.completedAt) text.createDiv({ cls: "plan-board-done-date", text: task.completedAt });

    if (options.todayButton && !task.completed) {
      const today = row.createEl("button", { cls: `plan-board-today${task.today ? " is-active" : ""}`, text: "Today" });
      today.onclick = (event) => {
        event.stopPropagation();
        this.toggleToday(task);
      };
    }

    return row;
  }
}

module.exports = class PlanPriorityBoardPlugin extends Plugin {
  async onload() {
    const data = await this.loadData() || {};
    this.quadrantOrder = data.quadrantOrder || data || {};
    this.todayOrder = data.todayOrder || {};
    this.registerView(VIEW_TYPE, (leaf) => new PlanPriorityBoardView(leaf, this));
    this.addRibbonIcon("layout-dashboard", "Plan Panel", () => this.activateView());
    this.addCommand({
      id: "open-plan-priority-board",
      name: "Open Plan Panel",
      callback: () => this.activateView()
    });
    this.registerEvent(this.app.workspace.on("file-open", (file) => this.syncViewsToFile(file)));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.syncViewsToFile(this.app.workspace.getActiveFile())));
    this.registerEvent(this.app.vault.on("modify", (file) => this.syncViewsToModifiedFile(file)));
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (existing) {
      this.app.workspace.revealLeaf(existing);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  syncViewsToFile(file) {
    this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((leaf) => {
      if (leaf.view instanceof PlanPriorityBoardView) leaf.view.loadActiveFile(file);
    });
  }

  syncViewsToModifiedFile(file) {
    this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((leaf) => {
      if (!(leaf.view instanceof PlanPriorityBoardView)) return;
      if (!leaf.view.currentFile || !file || leaf.view.currentFile.path !== file.path) return;
      leaf.view.loadFile(file);
    });
  }

  async setQuadrantOrder(filePath, quadrant, keys) {
    if (!this.quadrantOrder[filePath]) this.quadrantOrder[filePath] = {};
    this.quadrantOrder[filePath][quadrant] = keys;
    await this.savePlanPanelData();
  }

  async setTodayOrder(filePath, keys) {
    this.todayOrder[filePath] = keys;
    await this.savePlanPanelData();
  }

  async savePlanPanelData() {
    await this.saveData({
      quadrantOrder: this.quadrantOrder,
      todayOrder: this.todayOrder
    });
  }
};
