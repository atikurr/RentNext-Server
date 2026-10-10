
import mongoose from "mongoose";

let cached = globalThis.mongoose;

if (!cached) {
  cached = globalThis.mongoose = {
    conn: null,
    promise: null,
  };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!process.env.MONGODB_URL) {
    throw new Error("MONGODB_URL environment variable is missing");
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGODB_URL, {
        dbName: "property_db",
      })
      .then((mongooseInstance) => mongooseInstance)
      .catch((error) => {
        cached.promise = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;
  console.log("MongoDB connected successfully");

  return cached.conn;
};

export default connectDB;
