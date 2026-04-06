const STORAGE_KEY = "recurring-task-manager.tasks";

const form = document.getElementById("task-form");
const taskNameInput = document.getElementById("task-name");
const taskIntervalInput = document.getElementById("task-interval");
const taskUnitInput = document.getElementById("task-unit");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const itemTemplate = document.getElementById("task-item-template");

const dayMs = 24 * 60 * 60 * 1000;

let tasks = loadTasks();
renderTasks();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = taskNameInput.value.trim();
  const interval = Number(taskIntervalInput.value);
  const unit = taskUnitInput.value;

  if (!name || interval < 1 || !["day", "week", "month"].includes(unit)) {
    return;
  }

  const nowIso = new Date().toISOString();
  const task = {
    id: crypto.randomUUID(),
    name,
    interval,
    unit,
    lastCompletedAt: null,
    createdAt: nowIso,
  };

  tasks.unshift(task);
  persistTasks();
  renderTasks();

  form.reset();
  taskIntervalInput.value = "1";
  taskUnitInput.value = "day";
  taskNameInput.focus();
});

function renderTasks() {
  taskList.innerHTML = "";
  emptyState.style.display = tasks.length ? "none" : "block";

  for (const task of tasks) {
    const node = itemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".task-title").textContent = task.name;
    node.querySelector(".task-meta").textContent = `Repeats every ${task.interval} ${task.unit}${task.interval > 1 ? "s" : ""}`;

    const nextDue = calculateNextDueDate(task);
    node.querySelector(".task-next").textContent = `Next due: ${formatDate(nextDue)}`;

    node.querySelector(".complete-btn").addEventListener("click", () => {
      markComplete(task.id);
    });

    node.querySelector(".delete-btn").addEventListener("click", () => {
      deleteTask(task.id);
    });

    taskList.appendChild(node);
  }
}

function markComplete(taskId) {
  tasks = tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          lastCompletedAt: new Date().toISOString(),
        }
      : task,
  );

  persistTasks();
  renderTasks();
}

function deleteTask(taskId) {
  tasks = tasks.filter((task) => task.id !== taskId);
  persistTasks();
  renderTasks();
}

function calculateNextDueDate(task) {
  const baseDate = task.lastCompletedAt ? new Date(task.lastCompletedAt) : new Date(task.createdAt);
  const nextDate = new Date(baseDate);

  if (task.unit === "day") {
    nextDate.setTime(nextDate.getTime() + task.interval * dayMs);
  } else if (task.unit === "week") {
    nextDate.setTime(nextDate.getTime() + task.interval * 7 * dayMs);
  } else {
    nextDate.setMonth(nextDate.getMonth() + task.interval);
  }

  return nextDate;
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (task) =>
        task &&
        typeof task.id === "string" &&
        typeof task.name === "string" &&
        Number.isInteger(task.interval) &&
        ["day", "week", "month"].includes(task.unit),
    );
  } catch {
    return [];
  }
}

function persistTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
