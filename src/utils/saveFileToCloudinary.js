import { Readable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import { isDemoMode } from '../constants/demo.js';

cloudinary.config({
  secure: true,
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Self-contained placeholder returned in demo mode so the public demo
// never uploads visitor images to the real Cloudinary account. Same
// shape ({ secure_url }) as a real upload, so callers need no changes.
const DEMO_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'>" +
    "<rect width='100%' height='100%' fill='#e2e8f0'/>" +
    "<text x='50%' y='50%' fill='#64748b' font-family='sans-serif' " +
    "font-size='28' text-anchor='middle' dominant-baseline='middle'>" +
    'Demo</text></svg>',
)}`;

export async function saveFileToCloudinary(buffer, folderName) {
  if (isDemoMode()) {
    return { secure_url: DEMO_IMAGE };
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `sm-app/${folderName}`,
        resource_type: 'image',
        overwrite: true,
        unique_filename: true,
        use_filename: false,
      },
      (err, result) => (err ? reject(err) : resolve(result)),
    );

    Readable.from(buffer).pipe(uploadStream);
  });
}
