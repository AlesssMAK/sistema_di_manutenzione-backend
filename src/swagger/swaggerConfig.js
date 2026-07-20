import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Sistema di manutenzione API Documentation',
    version: '1.0.0',
    description: 'API documentation Sistema di manutenzione',
    contact: {
      name: 'Sistema di manutenzione API Support',
      email: 'makovii88@gmail.com',
    },
  },
  servers: [
    {
      url: 'https://sistema-di-manutenzione-backend.onrender.com',
      description: 'Production server',
    },
    {
      url: 'http://localhost:3030',
      description: 'Local development server',
    },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'accessToken',
        description:
          'Opaque session token set as an httpOnly cookie by POST /auth/login. ' +
          'Valid for 15 minutes; POST /auth/refresh rotates it using the ' +
          'refreshToken and sessionId cookies.',
      },
    },
  },
};

const options = {
  definition: swaggerDefinition,
  apis: [
    path.join(__dirname, './paths/*.js'),
    path.join(__dirname, './schemas/*.js'),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
