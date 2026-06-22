import createHttpError from 'http-errors';
import { AuditLog } from '../models/auditLog.js';
import { User } from '../models/user.js';

// auth.* events power the "access history" section; everything else
// is a "system change". Keep this list in sync with the enum in
// constants/auditLog.js.
const ACCESS_ACTIONS = [
  'auth.login',
  'auth.logout',
  'auth.refresh',
  'auth.register',
];

// buildFilter is async because the free-text `search` resolves actor
// names to ids via a User lookup before filtering the log.
const buildFilter = async (q) => {
  const filter = {};
  if (q.actorId) filter.actorId = q.actorId;
  if (q.actorRole) filter.actorRole = q.actorRole;
  if (q.action) filter.action = q.action;
  if (q.targetType) filter.targetType = q.targetType;
  if (q.targetId) filter.targetId = q.targetId;

  // Section split — access vs changes (the two dashboard cards).
  if (q.category === 'access') {
    filter.action = { $in: ACCESS_ACTIONS };
  } else if (q.category === 'changes') {
    filter.action = { $nin: ACCESS_ACTIONS };
  }

  // Free-text actor search: match User.fullName, then constrain the
  // log to those actors. An empty match set yields an impossible
  // filter so the result is empty rather than unfiltered.
  if (q.search) {
    const actors = await User.find(
      { fullName: { $regex: q.search, $options: 'i' } },
      '_id',
    ).lean();
    filter.actorId = { $in: actors.map((a) => a._id) };
  }

  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) filter.createdAt.$gte = new Date(q.from);
    if (q.to) filter.createdAt.$lte = new Date(q.to);
  }
  return filter;
};

export const listAuditLogs = async (req, res) => {
  const { page, perPage, sort } = req.query;
  const filter = await buildFilter(req.query);
  const skip = (page - 1) * perPage;

  const [total, items] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .populate({ path: 'actorId', select: 'fullName email role' })
      .sort(sort)
      .skip(skip)
      .limit(perPage)
      .lean(),
  ]);

  const totalPages = Math.ceil(total / perPage) || 0;

  res.status(200).json({
    page,
    perPage,
    total,
    totalPages,
    items,
  });
};

export const getAuditLogById = async (req, res) => {
  const { id } = req.params;
  const entry = await AuditLog.findById(id)
    .populate({ path: 'actorId', select: 'fullName email role' })
    .lean();

  if (!entry) throw createHttpError(404, 'Audit log entry not found');
  res.status(200).json(entry);
};
