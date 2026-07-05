import { model, Schema } from 'mongoose';

// Public bulletin board ("la bacheca"). Readable by anyone (no auth),
// created only by authorized users. Kept separate from the internal
// Message/broadcast system so internal communications can never leak
// onto the public board by accident.
const announcementSchema = new Schema(
  {
    // Title/body are optional — a photo-only announcement is valid.
    // The controller enforces "at least a photo or title+body".
    title: { type: String, trim: true, maxlength: 200, default: '' },
    body: { type: String, trim: true, maxlength: 5000, default: '' },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: { type: String, required: true },
    // 'announcement' = general board post, 'handover' = shift-handover
    // note (may reference a machine). Split into two columns on the UI.
    category: {
      type: String,
      enum: ['announcement', 'handover'],
      default: 'announcement',
      index: true,
    },
    // Optional machine reference — only meaningful for `handover`
    // entries. plantName is denormalized like authorName so the public
    // board renders without a populate.
    plantId: { type: Schema.Types.ObjectId, ref: 'Plant' },
    plantName: { type: String },
    // Optional visual emphasis for the card (badge + colored accent).
    // 'normal' = plain card, no badge.
    severity: {
      type: String,
      enum: ['normal', 'communication', 'note', 'important', 'attention'],
      default: 'normal',
    },
    // Cloudinary URLs of attached photos (max 5, enforced by multer).
    img: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false },
);

announcementSchema.index({ createdAt: -1 });

export const Announcement = model('Announcement', announcementSchema);
