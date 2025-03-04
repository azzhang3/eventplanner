document.addEventListener("DOMContentLoaded", () => {
  // Initialize Materialize select elements.
  M.FormSelect.init(document.querySelectorAll("select"));

  // Determine the current page by body id.
  const pageId = document.body.id;

  if (pageId === "home-user") {
    // ------------------
    // User Home Page Logic
    // ------------------
    // Vendor search functionality and reservation form handling.

    // Vendor search form
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
                <p>Service: ${info.service || "N/A"}</p>
                <p>Average Cost: ${info.averageCost || "N/A"}</p>
                <p>Description: ${info.description || ""}</p>
                <p>Tags: ${info.tags ? info.tags.join(", ") : ""}</p>
                <button class="btn reserve-btn" data-vendor="${
                  vendor.username
                }">Make Reservation</button>
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
            M.FormSelect.init(document.querySelectorAll("select")); // reinitialize selects if needed.
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

    // Cancel reservation form
    document
      .getElementById("cancelReservation")
      .addEventListener("click", () => {
        reservationForm.reset();
        document.getElementById("reservationFormContainer").style.display =
          "none";
      });

    // Load user's reservation history
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
              <p>Date: ${new Date(r.date).toLocaleDateString()}</p>
              <p>Time: ${r.time}</p>
              <p>Location: ${r.location}</p>
              <p>Details: ${r.details || ""}</p>
              <p>Status: ${r.status}</p>
              ${
                r.status === "pending"
                  ? `<button class="btn cancel-btn" data-id="${r._id}">Cancel Reservation</button>`
                  : ""
              }
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
        console.log("Fetched reservations:", reservations);
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
              <p>Date: ${new Date(r.date).toLocaleDateString()}</p>
              <p>Time: ${r.time}</p>
              <p>Location: ${r.location}</p>
              <p>Details: ${r.details || ""}</p>
              <p>Status: ${r.status}</p>
              ${
                r.status === "pending"
                  ? `
                <button class="btn accept-btn" data-id="${r._id}">Accept</button>
                <button class="btn decline-btn" data-id="${r._id}">Decline</button>
              `
                  : ""
              }
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
      } catch (error) {
        console.error("Error fetching reservations:", error);
      }
    }
    loadReservations();
  }
});
