require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB, getDbStatus } = require("./config/db");

const carRoutes = require("./routes/carRoutes");
const orderRoutes = require("./routes/orderRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend development
app.use(
  cors({
    origin: ["http://0.0.0.0/0:5173"],
    credentials: true,
  }),
);

app.use(express.json());

// Connect database (with fallback to JSON)
connectDB();

// API Routes
app.use("/api/cars", carRoutes);
app.use("/api/orders", orderRoutes);

// Health & Status endpoint
app.get("/api/status", (req, res) => {
  const dbStatus = getDbStatus();
  res.json({
    status: "online",
    database: dbStatus.isFallback
      ? "Local JSON Store"
      : "MongoDB Atlas / Local",
    fallbackStore: dbStatus.storePath,
    timestamp: new Date(),
  });
});

// Serve frontend static files if we build for production, but in development we keep them separate
app.get("/", (req, res) => {
  res.send("🚗 Car Shop Demo Backend API is running.");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/status`);
});
