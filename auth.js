const SUPABASE_URL = ""; // e.g. https://YOUR-PROJECT.supabase.co
const SUPABASE_ANON_KEY = ""; // Project Settings -> API -> anon/public key

const authForm = document.getElementById("auth-form");
const authEmailInput = document.getElementById("auth-email");
const authPasswordInput = document.getElementById("auth-password");
const signupButton = document.getElementById("signup-btn");
const authStatus = document.getElementById("auth-status");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  updateStatus("Set SUPABASE_URL and SUPABASE_ANON_KEY in auth.js and app.js first.");
} else {
  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  initAuth(supabaseClient);
}

async function initAuth(supabaseClient) {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session?.user) {
    window.location.replace("index.html");
    return;
  }

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;

    updateStatus("Logging in...");

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      updateStatus(`Login failed: ${error.message}`);
      return;
    }

    window.location.replace("index.html");
  });

  signupButton.addEventListener("click", async () => {
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;

    updateStatus("Creating account...");

    const { error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
      updateStatus(`Sign up failed: ${error.message}`);
      return;
    }

    updateStatus("Account created. Check email confirmation settings, then log in.");
  });
}

function updateStatus(message) {
  authStatus.textContent = message;
}
