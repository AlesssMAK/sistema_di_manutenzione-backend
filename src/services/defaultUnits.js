import { Unit } from '../models/unit.js';

// Units of measure a fresh install should always have available, so the
// warehouse module is usable the moment an admin enables it (without one
// having to hand-create every unit first). Piece-like units stay integer;
// continuous ones allow fractional quantities.
const DEFAULT_UNITS = [
  { code: 'pz', name: 'Pezzi', allowsDecimals: false },
  { code: 'm', name: 'Metri', allowsDecimals: true },
  { code: 'cm', name: 'Centimetri', allowsDecimals: true },
  { code: 'kg', name: 'Chilogrammi', allowsDecimals: true },
  { code: 'l', name: 'Litri', allowsDecimals: true },
];

// Idempotent: inserts each default only when its code is missing. Uses
// $setOnInsert so re-runs never overwrite edits and never resurrect a
// unit an admin has deactivated or renamed.
export const ensureDefaultUnits = async () => {
  await Promise.all(
    DEFAULT_UNITS.map((u) =>
      Unit.updateOne({ code: u.code }, { $setOnInsert: u }, { upsert: true }),
    ),
  );
};
