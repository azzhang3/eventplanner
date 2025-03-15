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

// Connect to MongoDB
mongoose.connect(
  "mongodb+srv://azzhang3:Password123456789.@cluster0.2lt6b.mongodb.net/test",
  { useNewUrlParser: true, useUnifiedTopology: true }
);

// --- User Schema ---
// For user accounts, displayName is required.
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  accountType: { type: String, enum: ["vendor", "user"], required: true },
  displayName: {
    type: String,
    required: function () {
      return this.accountType === "user";
    },
  },
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

// --- Event Schema ---
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
const reservationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true }, // Format "HH:MM"
  location: { type: String, required: true },
  details: { type: String },
  vendor: { type: String, required: true },
  vendorCompany: { type: String },
  user: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined", "canceled"],
    default: "pending",
  },
});
const Reservation = mongoose.model("Reservation", reservationSchema);

// --- Review Schema ---
// Each user can leave only one review per vendor.
const reviewSchema = new mongoose.Schema({
  vendor: { type: String, required: true },
  user: { type: String, required: true }, // stores the user's displayName
  rating: { type: Number, min: 1, max: 5, required: true },
  text: { type: String },
  timestamp: { type: Date, default: Date.now },
});
const Review = mongoose.model("Review", reviewSchema);

// --- Message Schema ---
const messageSchema = new mongoose.Schema({
  reservation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Reservation",
    required: true,
  },
  sender: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model("Message", messageSchema);

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

// Routes
app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    return req.user.accountType === "vendor"
      ? res.redirect("/home-vendor")
      : res.redirect("/home-user");
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/home-user", isLoggedIn, (req, res) => {
  if (req.user.accountType !== "user") return res.redirect("/home-vendor");
  res.sendFile(path.join(__dirname, "public", "home-user.html"));
});
app.get("/home-vendor", isLoggedIn, (req, res) => {
  if (req.user.accountType !== "vendor") return res.redirect("/home-user");
  res.sendFile(path.join(__dirname, "public", "home-vendor.html"));
});

app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user)
      return res
        .status(400)
        .json({ message: "Incorrect username or password" });
    req.login(user, (err) => {
      if (err) return next(err);
      const redirectUrl =
        user.accountType === "vendor" ? "/home-vendor" : "/home-user";
      return res.json({ redirectUrl });
    });
  })(req, res, next);
});

app.post("/register", async (req, res) => {
  const { username, password, accountType, displayName } = req.body;
  try {
    if (!accountType || (accountType !== "vendor" && accountType !== "user")) {
      return res.status(400).json({ message: "Invalid account type." });
    }
    if (accountType === "user") {
      if (!displayName || displayName.trim() === "") {
        return res
          .status(400)
          .json({ message: "Display Name is required for user accounts." });
      }
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
        typeOfCuisine,
        description,
        tags: tagsArray,
      };
    }
    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.status(400).json({ message: "Username is already taken" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUserData = {
      username,
      password: hashedPassword,
      accountType,
      vendorInfo,
    };
    if (accountType === "user") newUserData.displayName = displayName;
    const newUser = new User(newUserData);
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

app.get("/vendors", isLoggedIn, async (req, res) => {
  try {
    const service = req.query.service;
    const name = req.query.name;
    const price = req.query.price;
    const tags = req.query.tags;
    let match = { accountType: "vendor" };

    if (service) {
      match["vendorInfo.service"] = service;
    }

    if (name) {
      // Only search by company name (case-insensitive)
      match["vendorInfo.companyName"] = { $regex: name, $options: "i" };
    }

    if (price) {
      match["vendorInfo.averageCost"] = price;
    }

    if (tags) {
      // Convert comma-separated tags into an array and match any tag using $in
      const tagsArray = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag);
      if (tagsArray.length > 0) {
        match["vendorInfo.tags"] = { $in: tagsArray };
      }
    }

    const vendors = await User.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "reviews", // collection for reviews
          localField: "username",
          foreignField: "vendor",
          as: "reviews",
        },
      },
      {
        $addFields: {
          averageRating: { $avg: "$reviews.rating" },
        },
      },
      {
        $project: {
          vendorInfo: 1,
          username: 1,
          averageRating: { $ifNull: ["$averageRating", 0] },
        },
      },
    ]);
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ message: "Error fetching vendors", error: err });
  }
});

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
    // Look up the vendor record to get the company name
    const vendorRecord = await User.findOne({ username: vendor });
    let vendorCompany = vendor; // fallback to vendor username if not found
    if (vendorRecord && vendorRecord.vendorInfo) {
      vendorCompany = vendorRecord.vendorInfo.companyName || vendor;
    }
    const newReservation = new Reservation({
      name,
      date: parsedDate,
      time,
      location,
      details,
      vendor, // vendor username for internal use
      vendorCompany, // vendor company name for display
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

// --- Chat Endpoints ---
app.post("/messages", isLoggedIn, async (req, res) => {
  const { reservationId, text } = req.body;
  if (!reservationId || !text) {
    return res
      .status(400)
      .json({ message: "Reservation ID and text are required." });
  }
  try {
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found." });
    }
    if (
      req.user.username !== reservation.user &&
      req.user.username !== reservation.vendor
    ) {
      return res.status(403).json({
        message: "You are not authorized to message for this reservation.",
      });
    }
    let senderName = "";
    if (req.user.accountType === "vendor") {
      senderName = req.user.vendorInfo?.companyName || "Vendor";
    } else {
      senderName = req.user.displayName;
    }
    const message = new Message({
      reservation: reservationId,
      sender: senderName,
      text,
    });
    await message.save();
    res.status(201).json({ message: "Message sent successfully!" });
  } catch (error) {
    console.error("Message error:", error);
    res.status(500).json({ message: "An error occurred", error });
  }
});

app.get("/messages/:reservationId", isLoggedIn, async (req, res) => {
  const reservationId = req.params.reservationId;
  try {
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found." });
    }
    if (
      req.user.username !== reservation.user &&
      req.user.username !== reservation.vendor
    ) {
      return res.status(403).json({
        message:
          "You are not authorized to view messages for this reservation.",
      });
    }
    const messages = await Message.find({ reservation: reservationId }).sort({
      timestamp: 1,
    });
    res.json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ message: "An error occurred", error });
  }
});

// --- Review Endpoints ---
app.post("/reviews", isLoggedIn, async (req, res) => {
  if (req.user.accountType !== "user") {
    return res.status(403).json({ message: "Only users can leave reviews." });
  }
  const { vendor, rating, text } = req.body;
  if (!vendor || !rating) {
    return res.status(400).json({ message: "Vendor and rating are required." });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be between 1 and 5." });
  }
  try {
    const existingReview = await Review.findOne({
      vendor,
      user: req.user.displayName,
    });
    if (existingReview) {
      return res
        .status(400)
        .json({ message: "You have already left a review for this vendor." });
    }
    const review = new Review({
      vendor,
      user: req.user.displayName,
      rating,
      text,
    });
    await review.save();
    res.status(201).json({ message: "Review submitted successfully!" });
  } catch (error) {
    console.error("Review error:", error);
    res.status(500).json({ message: "An error occurred", error });
  }
});

app.get("/reviews", isLoggedIn, async (req, res) => {
  const vendor = req.query.vendor;
  if (!vendor) {
    return res.status(400).json({ message: "Vendor is required." });
  }
  try {
    const reviews = await Review.find({ vendor }).sort({ timestamp: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "An error occurred", error });
  }
});

app.delete("/reservations/:id", isLoggedIn, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found." });
    }
    // Only allow deletion if the reservation is canceled or declined.
    if (
      reservation.status !== "canceled" &&
      reservation.status !== "declined"
    ) {
      return res.status(400).json({
        message: "Only canceled or declined reservations can be deleted.",
      });
    }
    await Reservation.deleteOne({ _id: req.params.id });
    res.json({ message: "Reservation deleted successfully." });
  } catch (error) {
    console.error("Delete reservation error:", error);
    res.status(500).json({ message: "An error occurred", error });
  }
});

// --- New: Current User Endpoint ---
// This endpoint returns the currently logged-in user's info.
app.get("/current-user", isLoggedIn, (req, res) => {
  res.json(req.user);
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
