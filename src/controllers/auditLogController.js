import createHttpError from 'http-errors';
import { AuditLog } from '../models/auditLog.js';

const buildFilter = (q) => {
  const filter = {};
  if (q.actorId) filter.actorId = q.actorId;
  if (q.actorRole) filter.actorRole = q.actorRole;
  if (q.action) filter.action = q.action;
  if (q.targetType) filter.targetType = q.targetType;
  if (q.targetId) filter.targetId = q.targetId;

  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) filter.createdAt.$gte = new Date(q.from);
    if (q.to) filter.createdAt.$lte = new Date(q.to);
  }
  return filter;
};

export const listAuditLogs = async (req, res) => {
  const { page, perPage, sort } = req.query;
  const filter = buildFilter(req.query);
  const skip = (page - 1) * perPage;

  const [total, items] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .populate({ path: 'actorId', select: 'name lastname email role' })
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
    .populate({ path: 'actorId', select: 'name lastname email role' })
    .lean();

  if (!entry) throw createHttpError(404, 'Audit log entry not found');
  res.status(200).json(entry);
};
