function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  return params.get("next") || "index.html";
}

function saveSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

function showFormError(message) {
  const el = document.getElementById("form-error");
  if (el) el.textContent = message;
}

async function handleLogin(e) {
  e.preventDefault();
  showFormError("");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      showFormError(data.message || "Login failed");
      return;
    }

    saveSession(data.token, data.user);
    window.location.href = getRedirectTarget();
  } catch (err) {
    showFormError("Couldn't reach the server. Is the backend running?");
    console.error(err);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  showFormError("");

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      showFormError(data.message || "Registration failed");
      return;
    }

    saveSession(data.token, data.user);
    window.location.href = getRedirectTarget();
  } catch (err) {
    showFormError("Couldn't reach the server. Is the backend running?");
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm) loginForm.addEventListener("submit", handleLogin);

  const registerForm = document.getElementById("register-form");
  if (registerForm) registerForm.addEventListener("submit", handleRegister);

  const passwordToggle = document.getElementById("password-toggle");
  const passwordInput = document.getElementById("password");

  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";

      passwordInput.type = isPassword ? "text" : "password";
      passwordToggle.textContent = isPassword ? "🙈" : "👁";
      passwordToggle.setAttribute(
        "aria-label",
        isPassword ? "Hide password" : "Show password"
      );
    });
  }
});
