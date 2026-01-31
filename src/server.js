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
import { authenticate } from './middleware/authenticate.js';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { adminOptions } from './admin/admin.config.js';
import MongoStore from 'connect-mongo';

const app = express();
const PORT = process.env.PORT || 3030;

// ADMIN
const isProd = process.env.NODE_ENV === 'production';
const createAdminJS = () => {
  const admin = new AdminJS(adminOptions);

  const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGO_URL,
    collectionName: 'admin_sessions',
    ttl: 24 * 60 * 60,
  });
  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate,
      cookieName: 'adminjs',
      cookiePassword: process.env.ADMIN_COOKIE_SECRET,
    },
    null,
    {
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      secret: process.env.ADMIN_SESSION_SECRET,
      cookie: {
        httpOnly: true,
        secure: isProd,
        maxAge: 1000 * 60 * 60 * 24,
      },
      name: 'adminjs',
    },
  );
  app.use(admin.options.rootPath, adminRouter);

  if (!isProd) {
    admin.watch();
  }
  console.log('✅ AdminJS mounted at:', admin.options.rootPath);
};

createAdminJS();

///ADMIN

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
