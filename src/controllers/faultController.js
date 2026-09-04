import createHttpError from 'http-errors';
import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import { Fault } from '../models/fault.js';
import { FaultView } from '../models/faultView.js';
import { Plant } from '../models/plant.js';
import { PlantPart } from '../models/part.js';
import { User } from '../models/user.js';

// Dot-free `<role>_<tab>` keys for the per-list "last seen" timestamps
// (User.listSeen). Kept in sync with the front-end tab definitions.
export const LIST_SEEN_KEYS = [
  'worker_active',
  'worker_inProgress',
  'worker_suspended',
  'worker_overdue',
  'worker_completed',
  'worker_pool',
  'manager_received',
  'manager_planned',
  'manager_suspended',
  'manager_inprogress',
  'manager_archive',
  'safety_all',
];
import { saveFileToCloudinary } from '../utils/saveFileToCloudinary.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { emitFaultCreated } from '../socket/emitters.js';
import {
  sendNewFaultEmail,
  sendNewFaultMaintainerEmail,
  sendSicurezzaHseEmail,
} from '../services/email/index.js';
import { logFromRequest } from '../services/auditLog.js';
import { sendPushToRole } from '../services/push/index.js';
import { getSettings } from '../services/systemSettings.js';

export const createFault = async (req, res) => {
  const {
    faultId,
    dataCreated,
    timeCreated,
    plantId,
    partId,
    typeFault,
    comment,
  } = req.body;

  const existsId = await Fault.findOne({ faultId });
  if (existsId) {
    throw createHttpError(409, 'This ID already exists');
  }

  const userId = req.user?._id;

  if (!userId) {
    throw createHttpError(401, 'User is not authenticated');
  }

  const plant = await Plant.findById(plantId);
  if (!plant) {
    throw createHttpError(400, 'Plant not found');
  }

  const part = await PlantPart.findById(partId);
  if (!part) {
    throw createHttpError(400, 'Part of plant not found');
  }

  if (String(part.plantId) !== String(plantId)) {
    throw createHttpError(400, 'This part does not belong to this plant');
  }

  let imageUrls = [];

  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const cloudinaryResult = await saveFileToCloudinary(
        file.buffer,
        'faults',
      );
      imageUrls.push(cloudinaryResult.secure_url);
    }
  }

  const newFault = await Fault.create({
    faultId,
    userId,
    nameOperator: req.user?.fullName || 'Unknown Operator',
    dataCreated,
    timeCreated,
    plantId,
    partId,
    typeFault,
    comment,
    img: imageUrls,
    history: [
      {
        action: 'created',
        userId: userId,
        userName: req.user?.fullName || 'Operator',
        timestamp: new Date(),
      },
    ],
  });

  const populatedFault = await Fault.findById(newFault._id)
    .populate({ path: 'plantId', select: 'namePlant code' })
    .populate({ path: 'partId', select: 'namePlantPart codePlantPart' });

  emitFaultCreated(populatedFault);

  await logFromRequest(req, {
    action: 'fault.create',
    targetType: 'Fault',
    targetId: populatedFault._id,
    summary: `Created fault ${faultId} for plant ${populatedFault.plantId?.namePlant ?? plantId}`,
    meta: { plantId, partId, typeFault },
  });

  setImmediate(() => {
    (async () => {
      const [managers, hseUsers, maintainers] = await Promise.all([
        User.find({ role: 'manager', status: 'active' }),
        typeFault === 'Safety'
          ? User.find({ role: 'safety', status: 'active' })
          : Promise.resolve([]),
        User.find({ role: 'maintenanceWorker', status: 'active' }),
      ]);
      await sendNewFaultEmail(populatedFault, managers);
      await sendNewFaultMaintainerEmail(populatedFault, maintainers);
      if (typeFault === 'Safety') {
        await sendSicurezzaHseEmail(populatedFault, hseUsers);
      }
    })().catch((err) =>
      console.error('[email] post-create dispatch failed', err.message),
    );

    // Browser push alongside email — managers always, HSE for safety
    // faults. Mirrors the email recipients above.
    const plantName = populatedFault.plantId?.namePlant ?? '';
    sendPushToRole('manager', {
      title: 'Nuova segnalazione',
      body: `${populatedFault.faultId} — ${plantName}`,
      url: `/manager/${populatedFault._id}`,
      tag: `fault-${populatedFault._id}`,
    }).catch((err) => console.error('[push] new-fault failed', err.message));

    // Maintainers get the heads-up too (pool work they can claim) — same
    // payload, but pointed at their own detail page.
    sendPushToRole('maintenanceWorker', {
      title: 'Nuova segnalazione',
      body: `${populatedFault.faultId} — ${plantName}`,
      url: `/maintenance-worker/${populatedFault._id}`,
      tag: `fault-${populatedFault._id}`,
    }).catch((err) =>
      console.error('[push] new-fault maintainer failed', err.message),
    );

    if (typeFault === 'Safety') {
      sendPushToRole('safety', {
        title: '[Sicurezza] Nuova segnalazione',
        body: `${populatedFault.faultId} — ${plantName}`,
        url: `/safety/${populatedFault._id}`,
        tag: `fault-${populatedFault._id}`,
      }).catch((err) => console.error('[push] hse failed', err.message));
    }
  });

  return res.status(201).json(populatedFault);
};

export const getAllFault = async (req, res) => {
  const {
    faultId,
    nameOperator,
    search,
    createdById,
    priority,
    plant,
    plantPart,
    typeFault,
    dataCreated,
    dataCreatedFrom,
    timeCreated,
    deadline,
    deadlineFrom,
    deadlineTo,
    plannedDate,
    plannedDateFrom,
    plannedDateTo,
    plannedDateEmpty,
    plannedDateNotEmpty,
    completedFrom,
    completedTo,
    // "Periodo" filter — a fault matches if ANY of its lifecycle dates
    // (created / planned / deadline / completed) falls in the range.
    anyDateFrom,
    anyDateTo,
    statusFault,
    assignedTo,
    assignedToEmpty,
    sort = 'desc',
    sortBy = 'dataCreated',
    sortOrder = 'asc',
    page = 1,
    perPage = 2,
    // Unseen annotation: when withUnseen is set, each returned fault gets
    // an `unseen` flag and the response carries a board-level `hasUnseen`.
    // `seenSince` is the current list's lastSeen timestamp (drives model A
    // for faults assigned to others). celebrate coerces both.
    withUnseen,
    seenSince,
  } = req.query;

  const query = {};
  // Each entry is an array of OR-conditions; combined with $and at the end
  // so independent OR groups (search + the "any date" period) don't clobber
  // each other on query.$or.
  const orGroups = [];

  // Deadline: a range (calendar day / Filtri) wins over the single value.
  // Stored as 'YYYY-MM-DD' strings, so lexicographic bounds are chronological.
  if (deadlineFrom || deadlineTo) {
    query.deadline = {};
    if (deadlineFrom) query.deadline.$gte = deadlineFrom;
    if (deadlineTo) query.deadline.$lte = deadlineTo;
  } else if (deadline) {
    query.deadline = deadline;
  }
  if (priority) query.priority = priority;
  if (faultId) query.faultId = faultId;
  if (nameOperator) query.nameOperator = nameOperator;
  // Free-text search — partial match on the fault code, the reporter,
  // or the machine / part (by name or code). Plant/part live in other
  // collections, so resolve the matching ids first.
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    const [matchedPlants, matchedParts] = await Promise.all([
      Plant.find({ $or: [{ namePlant: rx }, { code: rx }] }).select('_id'),
      PlantPart.find({
        $or: [{ namePlantPart: rx }, { codePlantPart: rx }],
      }).select('_id'),
    ]);
    orGroups.push([
      { faultId: rx },
      { nameOperator: rx },
      { plantId: { $in: matchedPlants.map((p) => p._id) } },
      { partId: { $in: matchedParts.map((p) => p._id) } },
    ]);
  }
  if (createdById) query.userId = createdById;
  if (typeFault) query.typeFault = typeFault;
  // Exact day wins over the range; otherwise apply the "created since"
  // lower bound. dataCreated is a Date path, so Mongoose casts the
  // YYYY-MM-DD string to a Date for the $gte comparison.
  if (dataCreated) {
    query.dataCreated = dataCreated;
  } else if (dataCreatedFrom) {
    query.dataCreated = { $gte: dataCreatedFrom };
  }
  if (timeCreated) query.timeCreated = timeCreated;
  // A plannedDate range (from Filtri) wins over the single-day filter
  // (from the calendar). plannedDate is a 'YYYY-MM-DD' string, so string
  // comparison orders it correctly.
  // "Ricevute" = not yet planned (no plannedDate); "Pianificate" = already
  // planned (a plannedDate is set). An explicit date / range is more
  // specific and wins over the presence checks.
  if (plannedDateEmpty === true || plannedDateEmpty === 'true') {
    query.plannedDate = { $in: [null, ''] };
  } else if (plannedDateFrom || plannedDateTo) {
    query.plannedDate = {};
    if (plannedDateFrom) query.plannedDate.$gte = plannedDateFrom;
    if (plannedDateTo) query.plannedDate.$lte = plannedDateTo;
  } else if (plannedDate) {
    query.plannedDate = plannedDate;
  } else if (plannedDateNotEmpty === true || plannedDateNotEmpty === 'true') {
    query.plannedDate = { $nin: [null, ''] };
  }
  // completedAt is a Date, so a 'YYYY-MM-DD' bound has to be turned into a
  // timezone-aware instant range (start-of-day → start of the day after),
  // matching how the Completate calendar buckets the closes.
  if (completedFrom || completedTo) {
    const settings = await getSettings();
    const tz = settings?.timezone ?? 'Europe/Rome';
    query.completedAt = {};
    if (completedFrom) {
      query.completedAt.$gte = DateTime.fromISO(completedFrom, { zone: tz })
        .startOf('day')
        .toJSDate();
    }
    if (completedTo) {
      query.completedAt.$lt = DateTime.fromISO(completedTo, { zone: tz })
        .plus({ days: 1 })
        .startOf('day')
        .toJSDate();
    }
  }
  // "Periodo" (any-date) filter — a fault matches if ANY lifecycle date is
  // in the range. plannedDate/deadline are 'YYYY-MM-DD' strings (lexical
  // bounds); dataCreated/completedAt are Dates (tz-aware instant range).
  if (anyDateFrom || anyDateTo) {
    const settings = await getSettings();
    const tz = settings?.timezone ?? 'Europe/Rome';
    const strRange = {};
    if (anyDateFrom) strRange.$gte = anyDateFrom;
    if (anyDateTo) strRange.$lte = anyDateTo;
    const dateRange = {};
    if (anyDateFrom) {
      dateRange.$gte = DateTime.fromISO(anyDateFrom, { zone: tz })
        .startOf('day')
        .toJSDate();
    }
    if (anyDateTo) {
      dateRange.$lt = DateTime.fromISO(anyDateTo, { zone: tz })
        .plus({ days: 1 })
        .startOf('day')
        .toJSDate();
    }
    orGroups.push([
      { plannedDate: strRange },
      { deadline: strRange },
      { dataCreated: dateRange },
      { completedAt: dateRange },
    ]);
  }

  // assignedToEmpty — pool fault filter (unassigned faults).
  if (assignedToEmpty === true || assignedToEmpty === 'true') {
    query.assignedMaintainers = { $size: 0 };
  } else if (assignedTo) {
    query.assignedMaintainers = assignedTo;
  }
  if (statusFault) {
    const list = Array.isArray(statusFault)
      ? statusFault
      : String(statusFault)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    query.statusFault = list.length > 1 ? { $in: list } : list[0];
  }

  if (plant) {
    const plants = await Plant.find({
      $or: [
        { namePlant: new RegExp(plant, 'i') },
        { code: new RegExp(plant, 'i') },
      ],
    });

    const plantIds = plants.map((p) => p._id);
    query.plantId = { $in: plantIds };
  }

  if (plantPart) {
    const parts = await PlantPart.find({
      $or: [
        { namePlantPart: new RegExp(plantPart, 'i') },
        { codePlantPart: new RegExp(plantPart, 'i') },
      ],
    });

    const partIds = parts.map((p) => p._id);
    query.partId = { $in: partIds };
  }

  // Apply the collected OR groups: one → $or, several → $and of $ors.
  if (orGroups.length === 1) {
    query.$or = orGroups[0];
  } else if (orGroups.length > 1) {
    query.$and = orGroups.map((group) => ({ $or: group }));
  }

  const sortOption = sort === 'asc' ? 1 : -1;
  // An explicit field sort (e.g. completedAt for the completed history)
  // wins; otherwise order by creation time via `sort`. `sortBy` defaults
  // to 'dataCreated', which keeps the legacy creation-order behaviour.
  const sortSpec =
    sortBy && sortBy !== 'dataCreated'
      ? { [sortBy]: sortOrder === 'asc' ? 1 : -1 }
      : { createdAt: sortOption };
  const skip = (page - 1) * perPage;

  const [totalFault, fault] = await Promise.all([
    Fault.countDocuments(query),
    Fault.find(query)
      .populate({ path: 'plantId', select: 'namePlant code' })
      .populate({ path: 'partId', select: 'namePlantPart codePlantPart' })
      .populate({ path: 'assignedMaintainers', select: 'fullName email' })
      .sort(sortSpec)
      .skip(skip)
      .limit(perPage)
      .lean(),
  ]);

  const totalPage = Math.ceil(totalFault / perPage);

  // Unseen annotation (opt-in). Adds a per-card `unseen` flag and a
  // board-level `hasUnseen`. See computeUnseenState for the model A/B rules.
  let hasUnseen;
  if (withUnseen === true || withUnseen === 'true') {
    const userId = req.user?._id;
    const seenSinceDate = seenSince ? new Date(seenSince) : null;

    // Per-card flags for the current page: one lookup of the viewer's
    // FaultView rows for the visible ids.
    const pageIds = fault.map((f) => f._id);
    const views = await FaultView.find({
      user: userId,
      fault: { $in: pageIds },
    })
      .select('fault seenAt')
      .lean();
    const viewMap = new Map(
      views.map((v) => [String(v.fault), new Date(v.seenAt)]),
    );
    for (const f of fault) {
      f.unseen = isFaultUnseen(f, userId, viewMap, seenSinceDate);
    }

    // Board-level flag over the WHOLE query (not just the page) so a tab
    // dot reflects unseen faults on later pages too.
    hasUnseen = await queryHasUnseen(query, userId, seenSinceDate);
  }

  res.status(200).json({
    page,
    perPage,
    totalFault,
    totalPage,
    ...(hasUnseen === undefined ? {} : { hasUnseen }),
    fault,
  });
};

// A fault is individually "seen" only while a FaultView.seenAt is at or
// after its updatedAt — a later change re-flags it. mineOrPool faults
// (model B) rely purely on that; faults assigned to others (model A) are
// additionally cleared once the list's lastSeen (seenSince) passes their
// updatedAt.
const isFaultUnseen = (fault, userId, viewMap, seenSinceDate) => {
  const uid = String(userId ?? '');
  const assigned = fault.assignedMaintainers ?? [];
  // Completed faults are historical — always model A (a glance at the list
  // clears them), never the persist-until-opened model B.
  const isCompleted = fault.statusFault === 'Completed';
  const treatAsB =
    !isCompleted &&
    (assigned.length === 0 ||
      assigned.some((m) => String(m?._id ?? m) === uid));

  const viewSeenAt = viewMap.get(String(fault._id)) ?? null;
  const individuallySeen =
    viewSeenAt !== null && viewSeenAt >= new Date(fault.updatedAt);

  if (treatAsB) return !individuallySeen;

  const tabNew = seenSinceDate
    ? new Date(fault.updatedAt) > seenSinceDate
    : false;
  return tabNew && !individuallySeen;
};

// Does any fault in `query` count as unseen for this user? Mirrors
// isFaultUnseen but in an aggregation so it spans every page. Returns as
// soon as one match is found ($limit 1).
const queryHasUnseen = async (query, userId, seenSinceDate) => {
  const meId = new mongoose.Types.ObjectId(String(userId));

  // Aggregation's $match does NOT auto-cast string ids to ObjectId the way
  // .find() does, so id filters built as strings (assignedTo, createdById)
  // would silently match nothing. Cast the known id fields.
  const match = { ...query };
  if (typeof match.assignedMaintainers === 'string') {
    match.assignedMaintainers = new mongoose.Types.ObjectId(
      match.assignedMaintainers,
    );
  }
  if (typeof match.userId === 'string') {
    match.userId = new mongoose.Types.ObjectId(match.userId);
  }

  const aBranch = seenSinceDate
    ? {
        $and: [
          { $gt: ['$updatedAt', seenSinceDate] },
          { $eq: ['$individuallySeen', false] },
        ],
      }
    : false;

  const rows = await Fault.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'faultviews',
        let: { fid: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$user', meId] }, { $eq: ['$fault', '$$fid'] }],
              },
            },
          },
          { $project: { seenAt: 1 } },
        ],
        as: 'view',
      },
    },
    {
      $addFields: {
        // Completed faults are historical — force model A (see isFaultUnseen).
        mineOrPool: {
          $and: [
            { $ne: ['$statusFault', 'Completed'] },
            {
              $or: [
                {
                  $eq: [
                    { $size: { $ifNull: ['$assignedMaintainers', []] } },
                    0,
                  ],
                },
                { $in: [meId, { $ifNull: ['$assignedMaintainers', []] }] },
              ],
            },
          ],
        },
        viewSeenAt: { $arrayElemAt: ['$view.seenAt', 0] },
      },
    },
    {
      $addFields: {
        individuallySeen: {
          $and: [
            { $ne: ['$viewSeenAt', null] },
            { $gte: ['$viewSeenAt', '$updatedAt'] },
          ],
        },
      },
    },
    {
      $match: {
        $expr: {
          $cond: [
            '$mineOrPool',
            { $eq: ['$individuallySeen', false] },
            aBranch,
          ],
        },
      },
    },
    { $limit: 1 },
    { $project: { _id: 1 } },
  ]);

  return rows.length > 0;
};

export const getFaultById = async (req, res) => {
  const { faultId } = req.params;

  const fault = await Fault.findById(faultId)
    .populate({ path: 'plantId', select: 'namePlant code' })
    .populate({ path: 'partId', select: 'namePlantPart codePlantPart' })
    .populate({ path: 'assignedMaintainers', select: 'fullName email' });

  if (!fault) {
    throw createHttpError(404, 'Fault not found');
  }

  res.status(200).json(fault);
};

/**
 * GET /faults/deadlines
 *
 * Aggregated per-day counts in a date range. Replaces the
 * `?perPage=200` workaround on the maintenance-worker calendar
 * (planned counts + overdue heatmap). Returns an array sorted by
 * date so the calendar can render badges directly.
 *
 * `field` picks which Fault date column to aggregate on:
 *   - 'plannedDate' — calendar's per-day planned-intervention badges
 *   - 'deadline'    — overdue heatmap (combine with statusFault=Overdue)
 *
 * Both columns are stored as 'YYYY-MM-DD' strings on the model, so a
 * lexicographic $gte/$lte filter is equivalent to chronological.
 */
export const getFaultDeadlines = async (req, res) => {
  const {
    dateFrom,
    dateTo,
    field = 'plannedDate',
    statusFault,
    priority,
    assignedTo,
    assignedToEmpty,
  } = req.query;

  // completedAt is a Date column; plannedDate/deadline are 'YYYY-MM-DD'
  // strings. For the Date column the bounds become a timezone-aware instant
  // range and the group key is the day string in that zone, so both string-
  // and date-backed fields bucket per calendar day the same way.
  const isDateField = field === 'completedAt';
  let tz = 'Europe/Rome';
  if (isDateField) {
    const settings = await getSettings();
    tz = settings?.timezone ?? tz;
  }

  const match = isDateField
    ? {
        completedAt: {
          $gte: DateTime.fromISO(dateFrom, { zone: tz })
            .startOf('day')
            .toJSDate(),
          $lt: DateTime.fromISO(dateTo, { zone: tz })
            .plus({ days: 1 })
            .startOf('day')
            .toJSDate(),
          $ne: null,
        },
      }
    : { [field]: { $gte: dateFrom, $lte: dateTo, $ne: null } };

  if (priority) match.priority = priority;

  if (statusFault) {
    const list = Array.isArray(statusFault)
      ? statusFault
      : String(statusFault)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    match.statusFault = list.length > 1 ? { $in: list } : list[0];
  }

  // assignedToEmpty takes precedence over assignedTo (pool filter).
  if (assignedToEmpty === true || assignedToEmpty === 'true') {
    match.assignedMaintainers = { $size: 0 };
  } else if (assignedTo) {
    match.assignedMaintainers = new mongoose.Types.ObjectId(assignedTo);
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: isDateField
          ? {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$completedAt',
                timezone: tz,
              },
            }
          : `$${field}`,
        count: { $sum: 1 },
        low: { $sum: { $cond: [{ $eq: ['$priority', 'Low'] }, 1, 0] } },
        medium: { $sum: { $cond: [{ $eq: ['$priority', 'Medium'] }, 1, 0] } },
        high: { $sum: { $cond: [{ $eq: ['$priority', 'High'] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const aggregated = await Fault.aggregate(pipeline);

  const dates = aggregated.map((row) => ({
    date: row._id,
    count: row.count,
    byPriority: { Low: row.low, Medium: row.medium, High: row.high },
  }));

  res.status(200).json({ field, dateFrom, dateTo, dates });
};

// ---------- POST /faults/:faultId/seen ----------
// Mark a single fault as individually seen (model B / detail-open / claim).
// Upserts the viewer's FaultView so its unseen dot clears until the fault
// next changes.
export const markFaultSeen = async (req, res) => {
  const userId = req.user._id;
  const { faultId } = req.params;
  await FaultView.updateOne(
    { user: userId, fault: faultId },
    { $set: { seenAt: new Date() } },
    { upsert: true },
  );
  return res.status(204).end();
};

// ---------- GET /faults/list-seen ----------
// The viewer's per-list lastSeen timestamps ({ '<role>_<tab>': ISO }).
// The front-end feeds these back as `seenSince` when loading each board.
export const getListSeen = async (req, res) => {
  const user = await User.findById(req.user._id).select('listSeen');
  const obj = user?.listSeen ? Object.fromEntries(user.listSeen) : {};
  return res.status(200).json(obj);
};

// ---------- PATCH /faults/list-seen ----------
// Advance one list's lastSeen to now — the "opening the list clears its
// others-assigned (model A) cards" action.
export const patchListSeen = async (req, res) => {
  const { key } = req.body;
  await User.updateOne(
    { _id: req.user._id },
    { $set: { [`listSeen.${key}`]: new Date() } },
  );
  return res.status(204).end();
};
