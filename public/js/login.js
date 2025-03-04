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

  // Toggle vendor extra fields based on account type selection
  const accountTypeSelect = document.getElementById("reg-accountType");
  const vendorExtraFields = document.getElementById("vendorExtraFields");
  accountTypeSelect.addEventListener("change", (e) => {
    if (e.target.value === "vendor") {
      vendorExtraFields.style.display = "block";
    } else {
      vendorExtraFields.style.display = "none";
    }
    // Reinitialize Materialize selects in case new ones were revealed.
    M.FormSelect.init(document.querySelectorAll("select"));
  });

  // Toggle Type of Cuisine field based on vendor service selection
  const vendorServiceSelect = document.getElementById("vendor-service");
  const foodCuisineField = document.getElementById("foodCuisineField");
  vendorServiceSelect.addEventListener("change", (e) => {
    if (e.target.value === "Food") {
      foodCuisineField.style.display = "block";
    } else {
      foodCuisineField.style.display = "none";
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

    // For vendor accounts, gather additional fields.
    let vendorData = {};
    if (accountType === "vendor") {
      const service = document.getElementById("vendor-service").value;
      const companyName = document.getElementById("vendor-companyName").value;
      const averageCost = document.getElementById("vendor-averageCost").value;
      const typeOfCuisine = document.getElementById(
        "vendor-typeOfCuisine"
      ).value;
      const description = document.getElementById("vendor-description").value;
      const tags = document.getElementById("vendor-tags").value; // comma-separated

      vendorData = {
        service,
        companyName,
        averageCost,
        typeOfCuisine,
        description,
        tags,
      };
    }

    if (!accountType) {
      alert("Please select an account type.");
      return;
    }

    // Combine common registration fields with vendor data if applicable.
    const registrationData = { username, password, accountType, ...vendorData };

    fetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registrationData),
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
