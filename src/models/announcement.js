import { model, Schema } from 'mongoose';

// Public bulletin board ("la bacheca"). Readable by anyone (no auth),
// created only by authorized users. Kept separate from the internal
// Message/broadcast system so internal communications can never leak
// onto the public board by accident.
const announcementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: { type: String, required: true },
  },
  { timestamps: true, versionKey: false },
);

announcementSchema.index({ createdAt: -1 });

export const Announcement = model('Announcement', announcementSchema);
