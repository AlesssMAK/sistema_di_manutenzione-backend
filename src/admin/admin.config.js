import AdminJS from 'adminjs';
import * as AdminJSMongoose from '@adminjs/mongoose';
import { resources } from './resources.js';

AdminJS.registerAdapter({
  Resource: AdminJSMongoose.Resource,
  Database: AdminJSMongoose.Database,
});

export const adminOptions = {
  rootPath: '/admin',
  resources: resources,
  branding: {
    companyName: 'Products Admin',
    softwareBrothers: false,
  },
};
