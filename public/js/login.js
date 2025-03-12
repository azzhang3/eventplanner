document.addEventListener("DOMContentLoaded", () => {
  // Initialize Materialize select elements for dropdowns
  const selectElems = document.querySelectorAll("select");
  M.FormSelect.init(selectElems);

  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const registerSection = document.getElementById("registerSection");
  const showRegisterBtn = document.getElementById("showRegister");
  const showLoginBtn = document.getElementById("showLogin");

  // Elements for toggling the Display Name field and vendor extra fields
  const displayNameField = document.getElementById("displayNameField");
  const regDisplayName = document.getElementById("reg-displayName");
  const vendorExtraFields = document.getElementById("vendorExtraFields");

  // Toggle between login and registration views
  showRegisterBtn.addEventListener("click", (e) => {
    e.preventDefault();
    registerSection.style.display = "block";
    document.getElementById("loginSection").style.display = "none";
    M.FormSelect.init(document.querySelectorAll("select"));
  });

  showLoginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    registerSection.style.display = "none";
    document.getElementById("loginSection").style.display = "block";
  });

  // Toggle extra fields based on selected account type
  const accountTypeSelect = document.getElementById("reg-accountType");
  accountTypeSelect.addEventListener("change", (e) => {
    if (e.target.value === "vendor") {
      vendorExtraFields.style.display = "block";
      // Enable vendor fields
      vendorExtraFields
        .querySelectorAll("input, select, textarea")
        .forEach((el) => {
          el.disabled = false;
        });
      displayNameField.style.display = "none";
      regDisplayName.disabled = true;
      regDisplayName.required = false;
    } else if (e.target.value === "user") {
      vendorExtraFields.style.display = "none";
      // Disable vendor fields so they don't trigger validation
      vendorExtraFields
        .querySelectorAll("input, select, textarea")
        .forEach((el) => {
          el.disabled = true;
        });
      displayNameField.style.display = "block";
      regDisplayName.disabled = false;
      regDisplayName.required = true;
    } else {
      vendorExtraFields.style.display = "none";
      vendorExtraFields
        .querySelectorAll("input, select, textarea")
        .forEach((el) => {
          el.disabled = true;
        });
      displayNameField.style.display = "none";
      regDisplayName.disabled = true;
      regDisplayName.required = false;
    }
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

  // Handle login submission
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

  // Handle registration submission
  registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("reg-username").value;
    const password = document.getElementById("reg-password").value;
    const accountType = document.getElementById("reg-accountType").value;
    let registrationData = { username, password, accountType };

    // For user accounts, include displayName.
    if (accountType === "user") {
      const displayName = document.getElementById("reg-displayName").value;
      registrationData.displayName = displayName;
    }
    // For vendor accounts, gather additional fields.
    if (accountType === "vendor") {
      const service = document.getElementById("vendor-service").value;
      const companyName = document.getElementById("vendor-companyName").value;
      const averageCost = document.getElementById("vendor-averageCost").value;
      const typeOfCuisine = document.getElementById(
        "vendor-typeOfCuisine"
      ).value;
      const description = document.getElementById("vendor-description").value;
      const tags = document.getElementById("vendor-tags").value;
      registrationData = {
        ...registrationData,
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
          showLoginBtn.click();
        } else {
          alert(data.message);
        }
      })
      .catch((error) => console.error("Error:", error));
  });
});
