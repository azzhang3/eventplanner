const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

const app = express();
const port = 3000;

// Global Content Security Policy header
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
      "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
      "img-src 'self' data:;"
  );
  next();
});

// Connect to MongoDB (replace with your connection string)
mongoose.connect(
  "mongodb+srv://azzhang3:Password123456789.@cluster0.2lt6b.mongodb.net/test",
  { useNewUrlParser: true, useUnifiedTopology: true }
);

// --- User Schema ---
// Vendors have extra information stored in vendorInfo.
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  googleId: { type: String, unique: true, sparse: true }, // Unused now.
  password: {
    type: String,
    required: function () {
      return !this.googleId;
    },
  },
  email: { type: String },
  profilePhoto: { type: String },
  accountType: { type: String, enum: ["vendor", "user"], required: true },
  vendorInfo: {
    service: {
      type: String,
      enum: ["Food", "Music", "Photos", "Videos", "Decorations"],
    },
    companyName: { type: String },
    averageCost: { type: String, enum: ["$", "$$", "$$$"] },
    typeOfCuisine: { type: String },
    description: { type: String },
    tags: { type: [String] },
  },
});
const User = mongoose.model("User", userSchema);

// --- Event Schema (unchanged) ---
const eventSchema = new mongoose.Schema({
  creationDate: { type: Date, default: Date.now },
  eventDate: { type: Date, required: true },
  eventTime: { type: String, required: true },
  location: { type: String, required: true },
  vendor: { type: String, required: true },
  description: { type: String },
  status: {
    type: String,
    enum: ["accepted", "declined", "pending", "canceled"],
    default: "pending",
  },
});
const Event = mongoose.model("Event", eventSchema);

// --- Reservation Schema ---
// Stores separate date and time fields.
// "name" is the reservation holder's full name,
// "user" stores the username of the user who made it,
// "vendor" must match the vendor's username.
const reservationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true }, // Format "HH:MM"
  location: { type: String, required: true },
  details: { type: String },
  vendor: { type: String, required: true },
  user: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined", "canceled"],
    default: "pending",
  },
});
const Reservation = mongoose.model("Reservation", reservationSchema);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport Local Strategy
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await User.findOne({ username });
      if (!user)
        return done(null, false, { message: "Invalid username or password" });
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch)
        return done(null, false, { message: "Invalid username or password" });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Authentication middleware
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/");
}

// --- Routes ---
// Serve index.html for login/signup.
app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    return req.user.accountType === "vendor"
      ? res.redirect("/home-vendor")
      : res.redirect("/home-user");
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Home pages for users and vendors.
app.get("/home-user", isLoggedIn, (req, res) => {
  if (req.user.accountType !== "user") return res.redirect("/home-vendor");
  res.sendFile(path.join(__dirname, "public", "home-user.html"));
});
app.get("/home-vendor", isLoggedIn, (req, res) => {
  if (req.user.accountType !== "vendor") return res.redirect("/home-user");
  res.sendFile(path.join(__dirname, "public", "home-vendor.html"));
});

// Local authentication endpoints.
app.post("/login", passport.authenticate("local"), (req, res) => {
  const redirectUrl =
    req.user.accountType === "vendor" ? "/home-vendor" : "/home-user";
  res.json({ redirectUrl });
});

app.post("/register", async (req, res) => {
  const { username, password, accountType } = req.body;
  console.log("Registration payload:", req.body);
  try {
    if (!accountType || (accountType !== "vendor" && accountType !== "user")) {
      return res.status(400).json({ message: "Invalid account type." });
    }
    let vendorInfo = undefined;
    if (accountType === "vendor") {
      const {
        service,
        companyName,
        averageCost,
        typeOfCuisine,
        description,
        tags,
      } = req.body;
      if (!service || !companyName || !averageCost) {
        return res.status(400).json({
          message:
            "Service, Company Name, and Average Cost are required for vendor accounts.",
        });
      }
      if (
        service === "Food" &&
        (!typeOfCuisine || typeOfCuisine.trim() === "")
      ) {
        return res
          .status(400)
          .json({ message: "Type of Cuisine is required for Food vendors." });
      }
      let tagsArray = [];
      if (tags && typeof tags === "string") {
        tagsArray = tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t);
      }
      vendorInfo = {
        service,
        companyName,
        averageCost,
        typeOfCuisine: service === "Food" ? typeOfCuisine : undefined,
        description,
        tags: tagsArray,
      };
    }
    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.status(400).json({ message: "Username is already taken" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      password: hashedPassword,
      accountType,
      vendorInfo,
    });
    await newUser.save();
    res.status(201).json({ message: "User created successfully!" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "An error occurred", error });
  }
});

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
});

// Vendor search endpoint.
app.get("/vendors", isLoggedIn, async (req, res) => {
  try {
    const service = req.query.service;
    let query = { accountType: "vendor" };
    if (service) query["vendorInfo.service"] = service;
    const vendors = await User.find(query, "vendorInfo username");
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ message: "Error fetching vendors", error: err });
  }
});

// Reservation creation endpoint – only for users.
app.post("/reservations", isLoggedIn, async (req, res) => {
  if (req.user.accountType !== "user") {
    return res
      .status(403)
      .json({ message: "Only users can create reservations." });
  }
  const { name, date, time, location, details, vendor } = req.body;
  if (!name || !date || !time || !location || !vendor) {
    return res
      .status(400)
      .json({ message: "Please fill in all required fields." });
  }
  try {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format." });
    }
    const newReservation = new Reservation({
      name,
      date: parsedDate,
      time,
      location,
      details,
      vendor,
      user: req.user.username,
      status: "pending",
    });
    await newReservation.save();
    res.status(201).json({ message: "Reservation created successfully!" });
  } catch (error) {
    console.error("Reservation error:", error);
    res.status(500).json({ message: "An error occurred", error });
  }
});

// Endpoint for vendors to update a reservation (accept or decline)
app.put("/reservations/:id", isLoggedIn, async (req, res) => {
  if (req.user.accountType !== "vendor") {
    return res
      .status(403)
      .json({ message: "Only vendors can update reservations." });
  }
  const reservationId = req.params.id;
  const { status } = req.body;
  if (!["accepted", "declined"].includes(status)) {
    return res
      .status(400)
      .json({ message: "Invalid status. Must be 'accepted' or 'declined'." });
  }
  try {
    const reservation = await Reservation.findOneAndUpdate(
      { _id: reservationId, vendor: req.user.username, status: "pending" },
      { status },
      { new: true }
    );
    if (!reservation) {
      return res
        .status(404)
        .json({ message: "Reservation not found or already updated." });
    }
    res.json({ message: "Reservation updated successfully.", reservation });
  } catch (error) {
    res.status(500).json({ message: "An error occurred", error });
  }
});

// Endpoint for users to cancel their reservation.
app.put("/reservations/:id/cancel", isLoggedIn, async (req, res) => {
  if (req.user.accountType !== "user") {
    return res
      .status(403)
      .json({ message: "Only users can cancel reservations." });
  }
  const reservationId = req.params.id;
  try {
    const reservation = await Reservation.findOneAndUpdate(
      { _id: reservationId, user: req.user.username, status: "pending" },
      { status: "canceled" },
      { new: true }
    );
    if (!reservation) {
      return res
        .status(404)
        .json({ message: "Reservation not found or cannot be canceled." });
    }
    res.json({ message: "Reservation canceled successfully.", reservation });
  } catch (error) {
    res.status(500).json({ message: "An error occurred", error });
  }
});

// Endpoint for vendors to fetch their reservations.
app.get("/reservations", isLoggedIn, async (req, res) => {
  if (req.user.accountType !== "vendor") {
    return res
      .status(403)
      .json({ message: "Only vendors can view reservations." });
  }
  try {
    const reservations = await Reservation.find({ vendor: req.user.username });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: "An error occurred", error });
  }
});

// Endpoint for users to fetch their reservation history.
app.get("/user-reservations", isLoggedIn, async (req, res) => {
  if (req.user.accountType !== "user") {
    return res
      .status(403)
      .json({ message: "Only users can view their reservations." });
  }
  try {
    const reservations = await Reservation.find({ user: req.user.username });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: "An error occurred", error });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
