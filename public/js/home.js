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

  // Determine page by body id.
  const pageId = document.body.id;
  if (pageId === "home-user") {
    // ------------------
    // User Home Page Logic
    // ------------------
    // Vendor search functionality
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
                  <button class="btn reserve-btn" data-vendor="${
                    vendor.username
                  }">Make Reservation</button>
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
            document.getElementById("reservationVendor").value =
              btn.getAttribute("data-vendor");
            document.getElementById("reservationFormContainer").style.display =
              "block";
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

    // Reservation form submission
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
        alert(data.message);
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
                    ? `<button class="btn cancel-btn" data-id="${r._id}">Cancel Reservation</button>`
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
        document.querySelectorAll(".cancel-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const resId = btn.getAttribute("data-id");
            try {
              const resp = await fetch(`/reservations/${resId}/cancel`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
              });
              const result = await resp.json();
              alert(result.message);
              loadReservationHistory();
            } catch (err) {
              console.error("Error canceling reservation:", err);
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
              alert(result.message);
              loadReservations();
            } catch (err) {
              console.error("Error updating reservation:", err);
            }
          });
        });
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
              alert(result.message);
              loadReservations();
            } catch (err) {
              console.error("Error updating reservation:", err);
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
        console.error("Error fetching reservations:", error);
      }
    }
    loadReservations();
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

  // --- Review Functionality ---
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
        alert(data.message);
        document.getElementById("reviewForm").reset();
        loadReviews(vendor);
      } catch (error) {
        console.error("Error submitting review:", error);
      }
    });

  // Optional: Refresh chat messages every 5 seconds
  setInterval(() => {
    if (currentReservationId) {
      loadChatMessages();
    }
  }, 5000);
});
