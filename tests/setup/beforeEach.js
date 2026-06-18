import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';

beforeAll(async () => {
  // globalSetup populates MONGO_URL with the in-memory instance URI.
  await mongoose.connect(process.env.MONGO_URL);
});

afterEach(async () => {
  // Drop every collection between tests so cases don't leak into
  // each other. Faster than dropping/recreating the database.
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((c) => c.deleteMany({})),
  );
});

afterAll(async () => {
  await mongoose.disconnect();
});
