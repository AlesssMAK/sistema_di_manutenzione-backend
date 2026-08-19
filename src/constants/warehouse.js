// Stock movement kinds — the ledger is append-only and the on-hand
// quantity is always derived from the sum of movements.
//   IN     — goods received into a warehouse (+)
//   OUT    — goods issued/consumed out of a warehouse (-)
//   ADJUST — inventory correction, sets the level to a counted value
export const MOVEMENT_TYPE = {
  IN: 'in',
  OUT: 'out',
  ADJUST: 'adjust',
};

// What an OUT movement was consumed for. A write-off can be tied to a
// fault, to a free-text task/order, or to nothing (ad-hoc).
export const REFERENCE_TYPE = {
  FAULT: 'fault',
  TASK: 'task',
  NONE: 'none',
};
