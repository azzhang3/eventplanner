document.addEventListener("DOMContentLoaded", () => {
  const userType = "consumer"; // Replace this with a backend check for account type

  if (userType === "consumer") {
    document.getElementById("consumer-section").style.display = "block";
  } else {
    document.getElementById("vendor-section").style.display = "block";
  }

  document.getElementById("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const serviceType = document.getElementById("search-serviceType").value;

    fetch(`/vendors?serviceType=${serviceType}`)
      .then((res) => res.json())
      .then((vendors) => {
        const resultsDiv = document.getElementById("searchResults");
        resultsDiv.innerHTML = vendors
          .map(
            (vendor) =>
              `<div>${vendor.username} (${vendor.serviceType})</div>
               <button onclick="bookVendor('${vendor._id}')">Book</button>`
          )
          .join("");
      });
  });

  window.bookVendor = (vendorId) => {
    const bookingDetails = {
      vendorId,
      date: "2023-12-25",
      time: "15:00",
      location: "New York",
      serviceType: "Music",
    };

    fetch("/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingDetails),
    })
      .then((res) => res.json())
      .then((response) => alert(response.message));
  };
});
