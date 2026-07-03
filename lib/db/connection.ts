// Creates and reuses the shared MongoDB connection for server operations.
import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not set")
}

type MongooseCache = {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache | undefined
}

const cached = global.mongoose ?? { conn: null, promise: null }

global.mongoose = cached

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI)
  }

  try {
    cached.conn = await cached.promise
  } catch (error) {
    // Reset the cached promise so a failed connection does not get reused on
    // every later request. Without this, one network failure makes the app
    // report "cannot reach the database" until the server restarts.
    cached.promise = null
    throw error
  }
  return cached.conn
}
