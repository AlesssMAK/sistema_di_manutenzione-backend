import 'dotenv/config';
import http from 'node:http';

import { buildApp } from './app.js';
import { connectMongoDB } from './db/connectMongoDB.js';
import { ensureSingleton as ensureSystemSettings } from './services/systemSettings.js';
import { ensureTtlIndex as ensureAuditTtlIndex } from './services/auditLog.js';
import { ensureMessageTtlIndex } from './services/message.js';
import { initSocket } from './socket/index.js';
import { startCronJobs, stopCronJobs } from './cron/index.js';

const PORT = process.env.PORT || 3040;

await connectMongoDB();
await ensureSystemSettings();
await ensureAuditTtlIndex();
await ensureMessageTtlIndex();
await startCronJobs();

const app = buildApp();
const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const shutdown = (signal) => {
  console.log(`Received ${signal}, shutting down…`);
  stopCronJobs();
  httpServer.close(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
