import createHttpError from 'http-errors';
import { Announcement } from '../models/announcement.js';

// Public read — no auth. Newest first, paginated.
export const listPublicAnnouncements = async (req, res) => {
  const { page, perPage } = req.query;
  const skip = (page - 1) * perPage;

  const [total, items] = await Promise.all([
    Announcement.countDocuments(),
    Announcement.find()
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
  const { title, body } = req.body;

  const announcement = await Announcement.create({
    title,
    body,
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
