
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";

import { auth } from "./config/auth.js";

import uploadRoutes from "./routes/uploadRoutes.js";
import propertyRoutes from "./routes/propertyRoutes.js";

import adminPropertyRoutes from "./routes/adminPropertyRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import adminBookingRoutes from "./routes/adminBookingRoutes.js";
import adminTransactionRoutes from "./routes/adminTransactionRoutes.js";
import adminAnalyticsRoutes from "./routes/adminAnalyticsRoutes.js";

import bookingRoutes from "./routes/bookingRoutes.js";
import ownerAnalyticsRoutes from "./routes/ownerAnalyticsRoutes.js";
import favoriteRoutes from "./routes/favoriteRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";

const app = express();

/*
|--------------------------------------------------------------------------
| CORS CONFIGURATION
|--------------------------------------------------------------------------
*/

const allowedOrigins = [
  "http://localhost:3000",
  "https://rent-next-client.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

/*
|--------------------------------------------------------------------------
| BETTER AUTH
|--------------------------------------------------------------------------
*/

app.all("/api/auth/*splat", toNodeHandler(auth));

/*
|--------------------------------------------------------------------------
| BODY PARSERS
|--------------------------------------------------------------------------
*/

// JSON parser
app.use(express.json());

// Form data parser
app.use(
  express.urlencoded({
    extended: true,
  })
);

// Cookie parser
app.use(cookieParser());

/*
|--------------------------------------------------------------------------
| UPLOAD ROUTES
|--------------------------------------------------------------------------
*/

app.use("/api/upload", uploadRoutes);

/*
|--------------------------------------------------------------------------
| PUBLIC PROPERTY ROUTES
|--------------------------------------------------------------------------
*/

app.use("/api/properties", propertyRoutes);

/*
|--------------------------------------------------------------------------
| BOOKING ROUTES
|--------------------------------------------------------------------------
*/

app.use("/api/bookings", bookingRoutes);

/*
|--------------------------------------------------------------------------
| FAVORITE ROUTES
|--------------------------------------------------------------------------
*/

app.use("/api/favorites", favoriteRoutes);

/*
|--------------------------------------------------------------------------
| PAYMENT ROUTES
|--------------------------------------------------------------------------
*/

app.use("/api/payments", paymentRoutes);

/*
|--------------------------------------------------------------------------
| REVIEW ROUTES
|--------------------------------------------------------------------------
*/

app.use("/api/reviews", reviewRoutes);

/*
|--------------------------------------------------------------------------
| ADMIN PROPERTY ROUTES
|--------------------------------------------------------------------------
*/

app.use("/api/admin/properties", adminPropertyRoutes);

/*
|--------------------------------------------------------------------------
| ADMIN USER ROUTES
|--------------------------------------------------------------------------
*/

app.use("/api/admin/users", adminUserRoutes);

/*
|--------------------------------------------------------------------------
| ADMIN BOOKING ROUTES
|--------------------------------------------------------------------------
*/

app.use("/api/admin/bookings", adminBookingRoutes);

/*
|--------------------------------------------------------------------------
| ADMIN TRANSACTION ROUTES
|--------------------------------------------------------------------------
*/

app.use("/api/admin/transactions", adminTransactionRoutes);

/*
|--------------------------------------------------------------------------
| ADMIN ANALYTICS ROUTES
|--------------------------------------------------------------------------
*/

app.use("/api/admin/analytics", adminAnalyticsRoutes);

/*
|--------------------------------------------------------------------------
| OWNER ANALYTICS ROUTES
|--------------------------------------------------------------------------
*/

app.use("/api/owner", ownerAnalyticsRoutes);

/*
|--------------------------------------------------------------------------
| ROOT HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Property Rental API is running",
  });
});

/*
|--------------------------------------------------------------------------
| 404 HANDLER
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

/*
|--------------------------------------------------------------------------
| GLOBAL ERROR HANDLER
|--------------------------------------------------------------------------
*/

app.use((error, req, res, next) => {
  console.error("Global error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  if (error.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed by CORS.",
    });
  }

  return res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error.",
  });
});

export default app;
