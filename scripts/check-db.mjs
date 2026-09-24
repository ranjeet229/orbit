import "dotenv/config";
import mongoose from "mongoose";
try {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  console.log("Atlas connection successful.");
  await mongoose.disconnect();
} catch (error) {
  console.error(
    "Atlas connection failed:",
    error.name,
    error.code || error.cause?.code || "Check network access and credentials",
  );
  process.exitCode = 1;
}
