const LOCAL_TASKS_KEY = "recurring-task-manager.tasks";
const SYNC_CONFIG_KEY = "recurring-task-manager.sync-config";

const form = document.getElementById("task-form");
const taskNameInput = document.getElementById("task-name");
const taskIntervalInput = document.getElementById("task-interval");
const taskUnitInput = document.getElementById("task-unit");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const itemTemplate = document.getElementById("task-item-template");

const syncForm = document.getElementById("sync-form");
const supabaseUrlInput = document.getElementById("supabase-url");
const supabaseAnonKeyInput = document.getElementById("supabase-anon-key");
const syncKeyInput = document.getElementById("sync-key");
const pullNowButton = document.getElementById("pull-now-btn");
const disableSyncButton = document.getElementById("disable-sync-btn");
const syncStatus = document.getElementById("sync-status");

const dayMs = 24 * 60 * 60 * 1000;

let syncConfig = loadSyncConfig();
let tasks = [];

bootstrap();

async function bootstrap() {
  hydrateSyncInputs();
  bindSyncEvents();
  bindTaskEvents();
  updateSyncStatus("Loading tasks...");

  await loadTasks();
  renderTasks();
}

function bindTaskEvents() {
  form.addEventListener("submit", async (event) => {
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
    await persistTasks();
    renderTasks();

    form.reset();
    taskIntervalInput.value = "1";
    taskUnitInput.value = "day";
    taskNameInput.focus();
  });
}

function bindSyncEvents() {
  syncForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    syncConfig = {
      supabaseUrl: supabaseUrlInput.value.trim().replace(/\/$/, ""),
      supabaseAnonKey: supabaseAnonKeyInput.value.trim(),
      syncKey: syncKeyInput.value.trim(),
    };

    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(syncConfig));
    updateSyncStatus("Sync settings saved. Pulling cloud tasks...");

    await pullFromCloud();
    renderTasks();
  });

  disableSyncButton.addEventListener("click", () => {
    syncConfig = { supabaseUrl: "", supabaseAnonKey: "", syncKey: "" };
    localStorage.removeItem(SYNC_CONFIG_KEY);
    hydrateSyncInputs();
    updateSyncStatus("Sync disabled (local only).");
  });

  pullNowButton.addEventListener("click", async () => {
    await pullFromCloud();
    renderTasks();
  });
}

function hydrateSyncInputs() {
  supabaseUrlInput.value = syncConfig.supabaseUrl || "";
  supabaseAnonKeyInput.value = syncConfig.supabaseAnonKey || "";
  syncKeyInput.value = syncConfig.syncKey || "";
}

function renderTasks() {
  taskList.innerHTML = "";
  emptyState.style.display = tasks.length ? "none" : "block";

  for (const task of tasks) {
    const node = itemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".task-title").textContent = task.name;
    node.querySelector(".task-meta").textContent = `Repeats every ${task.interval} ${task.unit}${task.interval > 1 ? "s" : ""}`;

    const nextDue = calculateNextDueDate(task);
    node.querySelector(".task-next").textContent = `Next due: ${formatDate(nextDue)}`;

    node.querySelector(".complete-btn").addEventListener("click", async () => {
      await markComplete(task.id);
    });

    node.querySelector(".delete-btn").addEventListener("click", async () => {
      await deleteTask(task.id);
    });

    taskList.appendChild(node);
  }
}

async function markComplete(taskId) {
  tasks = tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          lastCompletedAt: new Date().toISOString(),
        }
      : task,
  );

  await persistTasks();
  renderTasks();
}

async function deleteTask(taskId) {
  tasks = tasks.filter((task) => task.id !== taskId);
  await persistTasks();
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

function loadSyncConfig() {
  const raw = localStorage.getItem(SYNC_CONFIG_KEY);

  if (!raw) {
    return { supabaseUrl: "", supabaseAnonKey: "", syncKey: "" };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      supabaseUrl: parsed.supabaseUrl || "",
      supabaseAnonKey: parsed.supabaseAnonKey || "",
      syncKey: parsed.syncKey || "",
    };
  } catch {
    return { supabaseUrl: "", supabaseAnonKey: "", syncKey: "" };
  }
}

function hasCloudSync() {
  return Boolean(syncConfig.supabaseUrl && syncConfig.supabaseAnonKey && syncConfig.syncKey);
}

async function loadTasks() {
  const local = loadTasksFromLocal();

  if (!hasCloudSync()) {
    tasks = local;
    updateSyncStatus("Sync disabled (local only).");
    return;
  }

  tasks = local;
  await pullFromCloud();
}

function loadTasksFromLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_TASKS_KEY);

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

async function pullFromCloud() {
  if (!hasCloudSync()) {
    updateSyncStatus("Missing sync settings. Using local storage only.");
    return;
  }

  updateSyncStatus("Pulling tasks from cloud...");

  const url = `${syncConfig.supabaseUrl}/rest/v1/recurring_tasks?sync_key=eq.${encodeURIComponent(syncConfig.syncKey)}&select=id,name,interval,unit,last_completed_at,created_at&order=created_at.desc`;
  const response = await fetch(url, {
    method: "GET",
    headers: buildCloudHeaders(),
  });

  if (!response.ok) {
    updateSyncStatus(`Cloud pull failed (${response.status}). Still using local copy.`);
    return;
  }

  const cloudRows = await response.json();
  tasks = cloudRows.map(mapCloudRowToTask);
  localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(tasks));
  updateSyncStatus(`Cloud sync active: ${tasks.length} task(s) loaded.`);
}

async function persistTasks() {
  localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(tasks));

  if (!hasCloudSync()) {
    return;
  }

  updateSyncStatus("Pushing tasks to cloud...");

  const deleteUrl = `${syncConfig.supabaseUrl}/rest/v1/recurring_tasks?sync_key=eq.${encodeURIComponent(syncConfig.syncKey)}`;
  const deleteResponse = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      ...buildCloudHeaders(),
      Prefer: "return=minimal",
    },
  });

  if (!deleteResponse.ok) {
    updateSyncStatus(`Cloud push failed (${deleteResponse.status}). Local save kept.`);
    return;
  }

  if (tasks.length > 0) {
    const insertUrl = `${syncConfig.supabaseUrl}/rest/v1/recurring_tasks`;
    const body = tasks.map((task) => ({
      id: task.id,
      sync_key: syncConfig.syncKey,
      name: task.name,
      interval: task.interval,
      unit: task.unit,
      last_completed_at: task.lastCompletedAt,
      created_at: task.createdAt,
    }));

    const insertResponse = await fetch(insertUrl, {
      method: "POST",
      headers: {
        ...buildCloudHeaders(),
        Prefer: "return=minimal",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!insertResponse.ok) {
      updateSyncStatus(`Cloud push failed (${insertResponse.status}). Local save kept.`);
      return;
    }
  }

  updateSyncStatus(`Cloud sync active: ${tasks.length} task(s) saved.`);
}

function buildCloudHeaders() {
  return {
    apikey: syncConfig.supabaseAnonKey,
    Authorization: `Bearer ${syncConfig.supabaseAnonKey}`,
  };
}

function mapCloudRowToTask(row) {
  return {
    id: row.id,
    name: row.name,
    interval: Number(row.interval),
    unit: row.unit,
    lastCompletedAt: row.last_completed_at,
    createdAt: row.created_at,
  };
}

function updateSyncStatus(message) {
  syncStatus.textContent = message;
}
