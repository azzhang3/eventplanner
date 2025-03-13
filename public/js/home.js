document.addEventListener("DOMContentLoaded", () => {
  // Initialize Materialize components.
  M.FormSelect.init(document.querySelectorAll("select"));
  M.Modal.init(document.querySelectorAll(".modal"));

  let currentReservationId = null;
  let currentReviewVendor = null;

  // Helper function to render stars using Font Awesome icons.
  function renderStars(rating) {
    let starsHTML = "";
    for (let i = 1; i <= 5; i++) {
      if (i <= rating) {
        starsHTML += '<i class="fa fa-star" style="color: gold;"></i>';
      } else {
        starsHTML += '<i class="fa fa-star-o" style="color: gold;"></i>';
      }
    }
    return starsHTML;
  }

  // --- Dark Mode Toggle ---
  const darkModeToggle = document.getElementById("darkModeToggle");
  if (darkModeToggle) {
    darkModeToggle.addEventListener("click", (e) => {
      e.preventDefault();
      document.body.classList.toggle("dark-mode");
      if (document.body.classList.contains("dark-mode")) {
        darkModeToggle.innerText = "Light Mode";
      } else {
        darkModeToggle.innerText = "Dark Mode";
      }
    });
  }

  // --- Fetch current user and update header greeting ---
  fetch("/current-user")
    .then((res) => res.json())
    .then((user) => {
      if (user.accountType === "user") {
        const welcomeMessage = document.getElementById("welcomeMessage");
        if (welcomeMessage) {
          welcomeMessage.innerText = "Welcome back, " + user.displayName + "!";
        }
      } else if (user.accountType === "vendor") {
        const dashboardMessage = document.getElementById("dashboardMessage");
        if (dashboardMessage) {
          const company =
            user.vendorInfo && user.vendorInfo.companyName
              ? user.vendorInfo.companyName
              : user.username;
          dashboardMessage.innerText = "Dashboard for " + company;
        }
      }
    })
    .catch((error) => console.error("Error fetching current user:", error));

  // --- Time Table Setup for Reservations ---
  const timeSlots = document.querySelectorAll(
    "#reservationTimeTable .time-slot"
  );
  timeSlots.forEach((button) => {
    button.addEventListener("click", function () {
      // Remove active class from all time slots
      timeSlots.forEach((btn) => btn.classList.remove("active"));
      // Add active class to the clicked button
      this.classList.add("active");
      // Update hidden input with selected time
      document.getElementById("reservationTime").value =
        this.getAttribute("data-time");
    });
  });

  // Determine current page by body id.
  const pageId = document.body.id;
  if (pageId === "home-user") {
    // ------------------
    // User Home Page Logic
    // ------------------
    const vendorSearchForm = document.getElementById("vendorSearchForm");
    vendorSearchForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const service = document.getElementById("searchService").value;
      try {
        const response = await fetch(
          `/vendors?service=${encodeURIComponent(service)}`
        );
        const vendors = await response.json();
        const vendorResultsDiv = document.getElementById("vendorResults");
        if (vendors.length === 0) {
          vendorResultsDiv.innerHTML = "<p>No vendors found.</p>";
          return;
        }
        vendorResultsDiv.innerHTML = vendors
          .map((vendor) => {
            const info = vendor.vendorInfo || {};
            return `
              <div class="card">
                <div class="card-content">
                  <span class="card-title">${info.companyName || "N/A"}</span>
                  <p><strong>Service:</strong> ${info.service || "N/A"}</p>
                  <p><strong>Average Cost:</strong> ${
                    info.averageCost || "N/A"
                  }</p>
                  <p>${info.description || ""}</p>
                  <p>Tags: ${info.tags ? info.tags.join(", ") : ""}</p>
                  <button 
                    class="btn reserve-btn" 
                    data-vendor="${vendor.username}" 
                    data-company-name="${info.companyName || vendor.username}">
                    Make Reservation
                </button>
                  <button class="btn review-btn" data-vendor="${
                    vendor.username
                  }">Leave Review</button>
                </div>
              </div>
            `;
          })
          .join("");
        document.querySelectorAll(".reserve-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            // Set the vendor field with the username (for internal logic)
            document.getElementById("reservationVendor").value =
              btn.getAttribute("data-vendor");

            // Get the company name from the data attribute
            const companyName = btn.getAttribute("data-company-name");

            // Update the reservation form header to include the company name
            document.querySelector("#reservationFormContainer h5").innerText =
              "Make a Reservation for " + companyName;

            // Show the reservation form container
            const reservationFormContainer = document.getElementById(
              "reservationFormContainer"
            );
            reservationFormContainer.style.display = "block";

            // Scroll to the top of the page smoothly
            window.scrollTo({ top: 0, behavior: "smooth" });
          });
        });
        document.querySelectorAll(".review-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            openReview(btn.getAttribute("data-vendor"));
          });
        });
      } catch (error) {
        console.error("Error searching vendors:", error);
      }
    });

    const reservationForm = document.getElementById("reservationForm");
    reservationForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("reservationName").value;
      const date = document.getElementById("reservationDate").value;
      const time = document.getElementById("reservationTime").value;
      const location = document.getElementById("reservationLocation").value;
      const details = document.getElementById("reservationDetails").value;
      const vendor = document.getElementById("reservationVendor").value;
      if (!time) {
        alert("Please select a time.");
        return;
      }
      try {
        const response = await fetch("/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, date, time, location, details, vendor }),
        });
        const data = await response.json();
        M.toast({ html: data.message, classes: "rounded" });
        reservationForm.reset();
        document.getElementById("reservationFormContainer").style.display =
          "none";
        loadReservationHistory();
      } catch (error) {
        console.error("Reservation error:", error);
      }
    });

    document
      .getElementById("cancelReservation")
      .addEventListener("click", () => {
        reservationForm.reset();
        document.getElementById("reservationFormContainer").style.display =
          "none";
      });

    async function loadReservationHistory() {
      try {
        const response = await fetch("/user-reservations");
        const reservations = await response.json();
        const historyDiv = document.getElementById("reservationHistory");
        if (reservations.length === 0) {
          historyDiv.innerHTML = "<p>No reservations made.</p>";
          return;
        }
        historyDiv.innerHTML = reservations
          .map(
            (r) => `
          <div class="card">
            <div class="card-content">
              <!-- Display vendor's company name if available, else fallback to vendor username -->
              <div class="company-name" style="font-size: 1.3em; color: #34495e;">
                ${r.vendorCompany || r.vendor}
              </div>
              <!-- Reservation name -->
              <div class="reservation-name" style="font-size: 1.1em; color: #34495e;">
                ${r.name}
              </div>
              <p><strong>Date:</strong> ${new Date(
                r.date
              ).toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${r.time}</p>
              <p><strong>Location:</strong> ${r.location}</p>
              <p>${r.details || ""}</p>
              <p><strong>Status:</strong> ${r.status}</p>
              ${
                r.status === "pending"
                  ? `<button class="btn cancel-btn" data-id="${r._id}">Cancel Reservation</button>`
                  : r.status === "canceled" || r.status === "declined"
                  ? `<button class="btn delete-btn" data-id="${r._id}">Delete Reservation</button>`
                  : ""
              }
              <button class="btn chat-btn" data-id="${r._id}">Chat</button>
              <button class="btn review-btn" data-vendor="${
                r.vendor
              }">Leave Review</button>
            </div>
          </div>
        `
          )
          .join("");

        // Attach event listeners for cancel, delete, chat, and review actions:
        document.querySelectorAll(".cancel-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const resId = btn.getAttribute("data-id");
            try {
              const resp = await fetch(`/reservations/${resId}/cancel`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
              });
              const result = await resp.json();
              M.toast({ html: result.message, classes: "rounded" });
              loadReservationHistory();
            } catch (err) {
              console.error("Error canceling reservation:", err);
            }
          });
        });

        document.querySelectorAll(".delete-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const resId = btn.getAttribute("data-id");
            try {
              const resp = await fetch(`/reservations/${resId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
              });
              const result = await resp.json();
              M.toast({ html: result.message, classes: "rounded" });
              loadReservationHistory();
            } catch (err) {
              console.error("Error deleting reservation:", err);
            }
          });
        });

        document.querySelectorAll(".chat-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            openChat(btn.getAttribute("data-id"));
          });
        });
        document.querySelectorAll(".review-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            openReview(btn.getAttribute("data-vendor"));
          });
        });
      } catch (error) {
        console.error("Error fetching reservation history:", error);
      }
    }

    loadReservationHistory();
  } else if (pageId === "home-vendor") {
    // ------------------
    // Vendor Home Page Logic
    // ------------------
    async function loadReservations() {
      try {
        const response = await fetch("/reservations");
        const reservations = await response.json();
        const reservationListDiv = document.getElementById("reservationList");
        if (reservations.length === 0) {
          reservationListDiv.innerHTML = "<p>No reservations yet.</p>";
          return;
        }
        reservationListDiv.innerHTML = reservations
          .map(
            (r) => `
          <div class="card">
            <div class="card-content">
              <span class="card-title">${r.name}</span>
              <p><strong>Date:</strong> ${new Date(
                r.date
              ).toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${r.time}</p>
              <p><strong>Location:</strong> ${r.location}</p>
              <p>${r.details || ""}</p>
              <p><strong>Status:</strong> ${r.status}</p>
              ${
                r.status === "pending"
                  ? `
                    <button class="btn accept-btn" data-id="${r._id}">Accept</button>
                    <button class="btn decline-btn" data-id="${r._id}">Decline</button>
                  `
                  : r.status === "canceled" || r.status === "declined"
                  ? `<button class="btn delete-btn" data-id="${r._id}">Delete Reservation</button>`
                  : ""
              }
              <button class="btn chat-btn" data-id="${r._id}">Chat</button>
            </div>
          </div>
        `
          )
          .join("");

        // Attach accept event listeners
        document.querySelectorAll(".accept-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            try {
              const res = await fetch(`/reservations/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "accepted" }),
              });
              const result = await res.json();
              M.toast({ html: result.message, classes: "rounded" });
              loadReservations();
            } catch (err) {
              console.error("Error updating reservation:", err);
            }
          });
        });

        // Attach decline event listeners
        document.querySelectorAll(".decline-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            try {
              const res = await fetch(`/reservations/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "declined" }),
              });
              const result = await res.json();
              M.toast({ html: result.message, classes: "rounded" });
              loadReservations();
            } catch (err) {
              console.error("Error updating reservation:", err);
            }
          });
        });

        // Attach delete event listeners (for canceled/declined reservations)
        document.querySelectorAll(".delete-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            try {
              const res = await fetch(`/reservations/${id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
              });
              const result = await res.json();
              M.toast({ html: result.message, classes: "rounded" });
              loadReservations();
            } catch (err) {
              console.error("Error deleting reservation:", err);
            }
          });
        });

        // Attach chat event listeners
        document.querySelectorAll(".chat-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            openChat(btn.getAttribute("data-id"));
          });
        });
      } catch (error) {
        console.error("Error fetching reservations:", error);
      }
    }
    loadReservations();

    // --- Load Vendor Reviews ---
    async function loadVendorReviews() {
      try {
        // First, get the current user's details
        const userRes = await fetch("/current-user");
        const user = await userRes.json();
        const vendorUsername = user.username;
        const reviewsRes = await fetch(
          `/reviews?vendor=${encodeURIComponent(vendorUsername)}`
        );
        const reviews = await reviewsRes.json();
        const reviewsDiv = document.getElementById("vendorReviews");
        if (reviews.length === 0) {
          reviewsDiv.innerHTML = "<p>No reviews yet.</p>";
          return;
        }
        reviewsDiv.innerHTML = reviews
          .map(
            (r) => `
            <div class="card-panel">
              <div class="review-rating">${renderStars(r.rating)}</div>
              <p><strong>${r.user}</strong></p>
              <p>${r.text || ""}</p>
              <p><small>${new Date(r.timestamp).toLocaleString()}</small></p>
            </div>
          `
          )
          .join("");
      } catch (error) {
        console.error("Error loading vendor reviews:", error);
      }
    }
    loadVendorReviews();
  }

  // Chat functionality
  function openChat(reservationId) {
    currentReservationId = reservationId;
    document.getElementById("chatInput").value = "";
    loadChatMessages();
    M.Modal.getInstance(document.getElementById("chatModal")).open();
  }
  async function loadChatMessages() {
    if (!currentReservationId) return;
    try {
      const response = await fetch(`/messages/${currentReservationId}`);
      const messages = await response.json();
      const chatMessagesDiv = document.getElementById("chatMessages");
      chatMessagesDiv.innerHTML = messages
        .map(
          (msg) => `
        <p><strong>${msg.sender}:</strong> ${
            msg.text
          } <small class="grey-text">${new Date(
            msg.timestamp
          ).toLocaleTimeString()}</small></p>
      `
        )
        .join("");
      chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    } catch (error) {
      console.error("Error loading chat messages:", error);
    }
  }
  document.getElementById("sendChatBtn").addEventListener("click", async () => {
    const text = document.getElementById("chatInput").value.trim();
    if (!text || !currentReservationId) return;
    try {
      const response = await fetch("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: currentReservationId, text }),
      });
      const data = await response.json();
      if (data.message) {
        document.getElementById("chatInput").value = "";
        loadChatMessages();
      } else {
        alert("Failed to send message.");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  });

  // --- Review Functionality for Users ---
  function openReview(vendorUsername) {
    currentReviewVendor = vendorUsername;
    document.getElementById("reviewVendor").value = vendorUsername;
    loadReviews(vendorUsername);
    M.Modal.getInstance(document.getElementById("reviewModal")).open();
  }
  async function loadReviews(vendorUsername) {
    try {
      const response = await fetch(
        `/reviews?vendor=${encodeURIComponent(vendorUsername)}`
      );
      const reviews = await response.json();
      const reviewsListDiv = document.getElementById("reviewsList");
      if (reviews.length === 0) {
        reviewsListDiv.innerHTML = "<p>No reviews yet.</p>";
        return;
      }
      reviewsListDiv.innerHTML = reviews
        .map(
          (r) => `
          <div class="card-panel">
            <div class="review-rating">${renderStars(r.rating)}</div>
            <p><strong>${r.user}</strong></p>
            <p>${r.text || ""}</p>
            <p><small>${new Date(r.timestamp).toLocaleString()}</small></p>
          </div>
        `
        )
        .join("");
    } catch (error) {
      console.error("Error loading reviews:", error);
    }
  }
  document
    .getElementById("reviewForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const vendor = document.getElementById("reviewVendor").value;
      const rating = document.getElementById("reviewRating").value;
      const text = document.getElementById("reviewText").value;
      try {
        const response = await fetch("/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendor, rating, text }),
        });
        const data = await response.json();
        M.toast({ html: data.message, classes: "rounded" });
        document.getElementById("reviewForm").reset();
        loadReviews(vendor);
      } catch (error) {
        console.error("Error submitting review:", error);
      }
    });

  // Refresh chat messages every 5 seconds
  setInterval(() => {
    if (currentReservationId) {
      loadChatMessages();
    }
  }, 5000);
});
