document.addEventListener("DOMContentLoaded", () => {
  // Initialize Materialize select elements for dropdowns
  const selectElems = document.querySelectorAll("select");
  M.FormSelect.init(selectElems);

  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const registerSection = document.getElementById("registerSection");
  const googleLoginBtn = document.getElementById("google-login-btn");
  const showRegisterBtn = document.getElementById("showRegister");
  const darkModeToggle = document.getElementById("darkModeToggle");
  const body = document.body;

  // Check localStorage for dark mode preference
  if (localStorage.getItem("darkMode") === "enabled") {
    body.classList.add("dark-mode");
    darkModeToggle.checked = true;
  }
  darkModeToggle.addEventListener("change", function () {
    if (darkModeToggle.checked) {
      body.classList.add("dark-mode");
      localStorage.setItem("darkMode", "enabled");
    } else {
      body.classList.remove("dark-mode");
      localStorage.setItem("darkMode", "disabled");
    }
  });

  // Toggle registration form display
  showRegisterBtn.addEventListener("click", (e) => {
    e.preventDefault();
    registerSection.style.display = "block";
    registerSection.classList.add("slide-in");
  });

  // Toggle service type field based on account type selection
  const accountTypeSelect = document.getElementById("reg-accountType");
  const serviceTypeField = document.getElementById("serviceTypeField");
  accountTypeSelect.addEventListener("change", (e) => {
    if (e.target.value === "vendor") {
      serviceTypeField.style.display = "block";
    } else {
      serviceTypeField.style.display = "none";
    }
  });

  // Handle login
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;

    fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          alert(data.message || "Invalid username or password");
        }
      })
      .catch((error) => console.error("Error:", error));
  });

  // Handle Google login button
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", () => {
      window.location.href = "/auth/google";
    });
  }

  // Handle registration
  registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("reg-username").value;
    const password = document.getElementById("reg-password").value;
    const accountType = document.getElementById("reg-accountType").value;
    const serviceType = document.getElementById("reg-serviceType").value;

    if (!accountType) {
      alert("Please select an account type.");
      return;
    }

    fetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, accountType, serviceType }),
    })
      .then((response) =>
        response.json().then((data) => ({ status: response.status, data }))
      )
      .then(({ status, data }) => {
        if (status === 201) {
          alert(data.message);
          registerForm.reset();
          location.reload();
        } else {
          alert(data.message);
        }
      })
      .catch((error) => console.error("Error:", error));
  });
});
