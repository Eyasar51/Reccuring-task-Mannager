const SUPABASE_URL = ""; // e.g. https://YOUR-PROJECT.supabase.co
const SUPABASE_ANON_KEY = ""; // Project Settings -> API -> anon/public key

const authForm = document.getElementById("auth-form");
const authEmailInput = document.getElementById("auth-email");
const authPasswordInput = document.getElementById("auth-password");
const authStatus = document.getElementById("auth-status");
const authCard = document.getElementById("auth-card");
const configWarning = document.getElementById("config-warning");
const taskSection = document.getElementById("task-section");
const logoutButton = document.getElementById("logout-btn");

const taskForm = document.getElementById("task-form");
const taskNameInput = document.getElementById("task-name");
const taskIntervalInput = document.getElementById("task-interval");
const taskUnitInput = document.getElementById("task-unit");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const itemTemplate = document.getElementById("task-item-template");

const dayMs = 24 * 60 * 60 * 1000;

let supabaseClient = null;
let currentUser = null;
let tasks = [];

bootstrap();

async function bootstrap() {
  const hasConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

  if (!hasConfig) {
    configWarning.hidden = false;
    authCard.hidden = true;
    taskSection.hidden = true;
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  bindAuthEvents();
  bindTaskEvents();

  const { data } = await supabaseClient.auth.getSession();
  await handleSession(data.session);

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    await handleSession(session);
  });
}

function bindAuthEvents() {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await login();
  });

  authForm.querySelector("[data-action='signup']").addEventListener("click", async () => {
    await signup();
  });

  logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
  });
}

function bindTaskEvents() {
  taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      return;
    }

    const name = taskNameInput.value.trim();
    const interval = Number(taskIntervalInput.value);
    const unit = taskUnitInput.value;

    if (!name || interval < 1 || !["day", "week", "month"].includes(unit)) {
      return;
    }

    const nowIso = new Date().toISOString();
    const newTask = {
      id: crypto.randomUUID(),
      user_id: currentUser.id,
      name,
      interval,
      unit,
      last_completed_at: null,
      created_at: nowIso,
    };

    const { error } = await supabaseClient.from("recurring_tasks").insert(newTask);

    if (error) {
      updateAuthStatus(`Failed to add task: ${error.message}`);
      return;
    }

    taskForm.reset();
    taskIntervalInput.value = "1";
    taskUnitInput.value = "day";
    taskNameInput.focus();

    await loadTasks();
  });
}

async function signup() {
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  if (!email || password.length < 6) {
    updateAuthStatus("Use a valid email and password (min 6 chars).");
    return;
  }

  updateAuthStatus("Creating account...");

  const { error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    updateAuthStatus(`Sign up failed: ${error.message}`);
    return;
  }

  updateAuthStatus("Account created. Check your email if confirmation is enabled, then log in.");
}

async function login() {
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  if (!email || password.length < 6) {
    updateAuthStatus("Use a valid email and password (min 6 chars).");
    return;
  }

  updateAuthStatus("Logging in...");

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    updateAuthStatus(`Login failed: ${error.message}`);
    return;
  }

  updateAuthStatus("Logged in.");
}

async function handleSession(session) {
  currentUser = session?.user ?? null;

  if (!currentUser) {
    tasks = [];
    renderTasks();
    taskSection.hidden = true;
    authCard.hidden = false;
    updateAuthStatus("Not logged in.");
    return;
  }

  authCard.hidden = false;
  taskSection.hidden = false;
  updateAuthStatus(`Logged in as ${currentUser.email}`);

  await loadTasks();
}

async function loadTasks() {
  if (!currentUser) {
    tasks = [];
    renderTasks();
    return;
  }

  const { data, error } = await supabaseClient
    .from("recurring_tasks")
    .select("id,name,interval,unit,last_completed_at,created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    updateAuthStatus(`Could not load tasks: ${error.message}`);
    return;
  }

  tasks = data.map((task) => ({
    id: task.id,
    name: task.name,
    interval: Number(task.interval),
    unit: task.unit,
    lastCompletedAt: task.last_completed_at,
    createdAt: task.created_at,
  }));

  renderTasks();
}

function renderTasks() {
  taskList.innerHTML = "";
  emptyState.style.display = tasks.length ? "none" : "block";

  for (const task of tasks) {
    const node = itemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".task-title").textContent = task.name;
    node.querySelector(".task-meta").textContent = `Repeats every ${task.interval} ${task.unit}${task.interval > 1 ? "s" : ""}`;
    node.querySelector(".task-next").textContent = `Next due: ${formatDate(calculateNextDueDate(task))}`;

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
  if (!currentUser) {
    return;
  }

  const { error } = await supabaseClient
    .from("recurring_tasks")
    .update({ last_completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", currentUser.id);

  if (error) {
    updateAuthStatus(`Could not update task: ${error.message}`);
    return;
  }

  await loadTasks();
}

async function deleteTask(taskId) {
  if (!currentUser) {
    return;
  }

  const { error } = await supabaseClient
    .from("recurring_tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", currentUser.id);

  if (error) {
    updateAuthStatus(`Could not delete task: ${error.message}`);
    return;
  }

  await loadTasks();
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

function updateAuthStatus(message) {
  authStatus.textContent = message;
}
