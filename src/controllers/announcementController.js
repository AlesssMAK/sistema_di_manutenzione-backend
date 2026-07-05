import createHttpError from 'http-errors';
import { Announcement } from '../models/announcement.js';
import { Plant } from '../models/plant.js';
import { User } from '../models/user.js';
import { saveFileToCloudinary } from '../utils/saveFileToCloudinary.js';

// Upload every multer-buffered image to Cloudinary and return the
// secure URLs in the order the FE sent them. Returns [] when no files
// are attached.
const uploadAttachments = async (req) => {
  if (!req.files || req.files.length === 0) return [];
  const urls = [];
  for (const file of req.files) {
    const result = await saveFileToCloudinary(file.buffer, 'announcements');
    urls.push(result.secure_url);
  }
  return urls;
};

// Admin-only — users currently granted the create-announcement right,
// used by the settings UI to render the "authorized authors" chips.
export const listAnnouncementAuthors = async (req, res) => {
  const users = await User.find(
    { 'permissions.canCreateAnnouncements': true },
    '_id fullName role',
  )
    .sort({ fullName: 1 })
    .lean();
  res.status(200).json({ users });
};

// Public read — no auth. Newest first, paginated. Optionally scoped
// to one board column so each column fetches only its own list.
// 'announcement' is the catch-all: it matches everything that is NOT a
// 'handover', so legacy rows created before the category field existed
// still show up (and never appear in both columns).
export const listPublicAnnouncements = async (req, res) => {
  const { page, perPage, category } = req.query;
  const skip = (page - 1) * perPage;

  let filter = {};
  if (category === 'handover') {
    filter = { category: 'handover' };
  } else if (category === 'announcement') {
    filter = { category: { $ne: 'handover' } };
  }

  const [total, items] = await Promise.all([
    Announcement.countDocuments(filter),
    Announcement.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean(),
  ]);

  res.status(200).json({
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
    items,
  });
};

export const createAnnouncement = async (req, res) => {
  const canCreate =
    req.user.role === 'admin' ||
    req.user.permissions?.canCreateAnnouncements === true;
  if (!canCreate) {
    throw createHttpError(403, 'Not allowed to create announcements');
  }

  const {
    title,
    body,
    category = 'announcement',
    plantId,
    severity = 'normal',
  } = req.body;

  // Title + body are only required when there's no photo — a
  // photo-only announcement is allowed.
  const hasPhoto = (req.files?.length ?? 0) > 0;
  if (!hasPhoto && (!title?.trim() || !body?.trim())) {
    throw createHttpError(
      400,
      'Title and body are required unless a photo is attached',
    );
  }

  // A machine reference is only meaningful for shift-handover
  // ('handover') entries. When one is provided, denormalize its name
  // (like authorName) so the public board renders without a populate.
  let plant = { plantId: undefined, plantName: undefined };
  if (category === 'handover' && plantId) {
    const found = await Plant.findById(plantId, 'namePlant').lean();
    if (!found) {
      throw createHttpError(400, 'Plant not found');
    }
    plant = { plantId: found._id, plantName: found.namePlant };
  }

  const img = await uploadAttachments(req);

  const announcement = await Announcement.create({
    title,
    body,
    category,
    severity,
    plantId: plant.plantId,
    plantName: plant.plantName,
    img,
    authorId: req.user._id,
    authorName: req.user.fullName ?? 'Unknown',
  });

  res.status(201).json(announcement);
};

export const deleteAnnouncement = async (req, res) => {
  const { id } = req.params;

  const announcement = await Announcement.findById(id);
  if (!announcement) {
    throw createHttpError(404, 'Announcement not found');
  }

  const isAuthor = String(announcement.authorId) === String(req.user._id);
  const isAdmin = req.user.role === 'admin';
  if (!isAuthor && !isAdmin) {
    throw createHttpError(403, 'Only the author or an admin can delete');
  }

  await Announcement.deleteOne({ _id: id });
  res.status(200).json({ success: true });
};
