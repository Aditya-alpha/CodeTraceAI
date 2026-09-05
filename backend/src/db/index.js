const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const config = require('../config');

let memoryServer = null;

async function connectDb() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  let uri = config.mongoUri;

  if (!uri) {
    console.log('[DB] No MONGODB_URI provided. Initializing in-memory MongoDB server...');
    try {
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri();
      console.log(`[DB] In-memory MongoDB running at: ${uri}`);
    } catch (err) {
      console.error('[DB] Failed to start in-memory MongoDB:', err.message);
      throw err;
    }
  } else {
    console.log(`[DB] Connecting to configured MongoDB: ${uri.replace(/\/\/[^@]+@/, '//***:***@')}`);
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log('[DB] MongoDB connected successfully.');
  return mongoose.connection;
}

async function disconnectDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = { connectDb, disconnectDb };
