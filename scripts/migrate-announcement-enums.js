/**
 * One-off migration: rename the Italian announcement enum values that
 * predate the English-only refactor.
 *
 *   category: annuncio -> announcement, consegna -> handover
 *   severity: normale -> normal, comunicazione -> communication,
 *             importante -> important, attenzione -> attention
 *
 * Also backfills missing category/severity on legacy rows. Idempotent:
 * running it twice is a no-op once everything is migrated.
 *
 * Usage:  node scripts/migrate-announcement-enums.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { Announcement } from '../src/models/announcement.js';

const CATEGORY_MAP = { annuncio: 'announcement', consegna: 'handover' };
const SEVERITY_MAP = {
  normale: 'normal',
  comunicazione: 'communication',
  importante: 'important',
  attenzione: 'attention',
};

const main = async () => {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    console.error('Missing required env: MONGO_URL');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);

  try {
    let total = 0;
    const bump = (label, res) => {
      const n = res.modifiedCount ?? 0;
      total += n;
      console.log(`${label}: ${n}`);
    };

    for (const [from, to] of Object.entries(CATEGORY_MAP)) {
      bump(
        `category ${from} -> ${to}`,
        await Announcement.updateMany({ category: from }, { $set: { category: to } }),
      );
    }
    for (const [from, to] of Object.entries(SEVERITY_MAP)) {
      bump(
        `severity ${from} -> ${to}`,
        await Announcement.updateMany({ severity: from }, { $set: { severity: to } }),
      );
    }

    bump(
      'category (missing) -> announcement',
      await Announcement.updateMany(
        { category: { $exists: false } },
        { $set: { category: 'announcement' } },
      ),
    );
    bump(
      'severity (missing) -> normal',
      await Announcement.updateMany(
        { severity: { $exists: false } },
        { $set: { severity: 'normal' } },
      ),
    );

    console.log(`Done. ${total} document(s) updated.`);
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error('migrate-announcement-enums failed:', err);
  process.exit(1);
});
