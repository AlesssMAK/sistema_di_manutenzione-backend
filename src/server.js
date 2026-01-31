import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { logger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errors } from 'celebrate';
import { connectMongoDB } from './db/connectMongoDB.js';
import helmet from 'helmet';
import authRoutes from './routes/authRoutes.js';

const app = express();
const PORT = process.env.PORT || 3030;

app.use(helmet());
app.use(logger);
app.use(express.json());
app.use(
  cors({
    origin: ['https://http://localhost:3000/'],
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(authRoutes);
app.use(notFoundHandler);
app.use(errors());
app.use(errorHandler);

await connectMongoDB();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
