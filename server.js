const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const app = express();
const port = 3000;

// Set a global Content Security Policy header for all responses
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

// MongoDB connection
mongoose.connect(
  "mongodb+srv://azzhang3:Password123456789.@cluster0.2lt6b.mongodb.net/test",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

// Updated User Schema to include accountType and serviceType
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  googleId: { type: String, unique: true, sparse: true },
  password: {
    type: String,
    required: function () {
      return !this.googleId;
    },
  },
  email: { type: String },
  profilePhoto: { type: String },
  accountType: { type: String, enum: ["vendor", "user"], required: true },
  serviceType: {
    type: String,
    required: function () {
      return this.accountType === "vendor";
    },
  },
});

const User = mongoose.model("User", userSchema);

// New Event Schema replacing the Task Schema
const eventSchema = new mongoose.Schema({
  creationDate: { type: Date, default: Date.now },
  eventDate: { type: Date, required: true },
  eventTime: { type: String, required: true },
  location: { type: String, required: true },
  vendor: { type: String, required: true }, // Vendor's username
  description: { type: String },
  status: {
    type: String,
    enum: ["accepted", "declined", "pending", "canceled"],
    default: "pending",
  },
});

const Event = mongoose.model("Event", eventSchema);

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

// Passport serialize and deserialize
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

// Passport Google OAuth strategy with default accountType as "user"
passport.use(
  new GoogleStrategy(
    {
      clientID:
        "521313058439-ufmg5r2raagp9drd5515lauicgs0j24k.apps.googleusercontent.com",
      clientSecret: "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",
      callbackURL: "http://localhost:3000/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      const email =
        profile.emails && profile.emails.length > 0
          ? profile.emails[0].value
          : null;
      User.findOne({ googleId: profile.id }).then((existingUser) => {
        if (existingUser) {
          return done(null, existingUser);
        } else {
          new User({
            username: profile.displayName,
            googleId: profile.id,
            profilePhoto: profile.photos[0].value,
            email: email,
            accountType: "user",
          })
            .save()
            .then((newUser) => {
              return done(null, newUser);
            });
        }
      });
    }
  )
);

// Middleware to ensure the user is authenticated
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/");
}

// Serve login page for unauthenticated users
app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    return req.user.accountType === "vendor"
      ? res.redirect("/home-vendor")
      : res.redirect("/home-user");
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Home pages for different account types
app.get("/home-user", isLoggedIn, (req, res) => {
  if (req.user.accountType !== "user") return res.redirect("/home-vendor");
  res.sendFile(path.join(__dirname, "public", "home-user.html"));
});

app.get("/home-vendor", isLoggedIn, (req, res) => {
  if (req.user.accountType !== "vendor") return res.redirect("/home-user");
  res.sendFile(path.join(__dirname, "public", "home-vendor.html"));
});

// Google Auth Routes
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);
app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    if (req.user.accountType === "vendor") {
      res.redirect("/home-vendor");
    } else {
      res.redirect("/home-user");
    }
  }
);

// Registration endpoint updated with validation.
app.post("/register", async (req, res) => {
  const { username, password, accountType, serviceType } = req.body;
  console.log("Registration payload:", req.body);
  try {
    if (!accountType || (accountType !== "vendor" && accountType !== "user")) {
      return res.status(400).json({ message: "Invalid account type." });
    }
    if (
      accountType === "vendor" &&
      (!serviceType || serviceType.trim() === "")
    ) {
      return res
        .status(400)
        .json({ message: "Service type is required for vendor accounts." });
    }
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username is already taken" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      password: hashedPassword,
      accountType,
      serviceType: accountType === "vendor" ? serviceType : undefined,
    });
    await newUser.save();
    res.status(201).json({ message: "User created successfully!" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "An error occurred", error });
  }
});

// Updated login endpoint: Return JSON with redirectUrl instead of redirecting directly.
app.post("/login", async (req, res, next) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "Invalid username or password" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid username or password" });
    }
    req.login(user, function (err) {
      if (err) return next(err);
      const redirectUrl =
        user.accountType === "vendor" ? "/home-vendor" : "/home-user";
      return res.json({ redirectUrl });
    });
  } catch (error) {
    res.status(500).json({ message: "An error occurred", error });
  }
});

// Logout route
app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
