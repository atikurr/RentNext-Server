import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URL,
      {
        dbName: "property_db",
      }
    );

    console.log("MongoDB connected successfully");
    console.log("Database: property_db");
  } catch (error) {
    console.error(
      "MongoDB connection failed:",
      error.message
    );

    process.exit(1);
  }
};

export default connectDB;