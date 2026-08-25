// Demo dataset — a full reset-and-seed used by both `npm run seed` and
// the DEMO_MODE reset cron. It WIPES the demo collections and inserts a
// fresh, known state, so re-running always yields the same demo world.
//
// Never point this at a real database: it deletes users, plants, faults,
// announcements, messages and sessions unconditionally.
//
// Assumes an active mongoose connection (the caller connects/disconnects).

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from '../models/user.js';
import { Plant } from '../models/plant.js';
import { PlantPart } from '../models/part.js';
import { Fault } from '../models/fault.js';
import { Announcement } from '../models/announcement.js';
import { Message } from '../models/message.js';
import { Session } from '../models/session.js';
import { Unit } from '../models/unit.js';
import { Warehouse } from '../models/warehouse.js';
import { InventoryItem } from '../models/inventoryItem.js';
import { Category } from '../models/category.js';
import { StockLevel } from '../models/stockLevel.js';
import { StockMovement } from '../models/stockMovement.js';
import { STATUS_FAULT } from '../constants/statusFault.js';
import { TYPE_FAULT } from '../constants/typeFault.js';
import { TYPE_PRIORITY } from '../constants/typePriority.js';

// Passwords for the demo accounts are intentionally weak. Operators log
// in with a personalCode (no password); everyone else uses this.
export const DEMO_PASSWORD = 'Demo1234!';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = n => new Date(Date.now() - n * DAY);
const ymd = date => date.toISOString().slice(0, 10);

// Safety net against a misconfigured MONGO_URL: refuse to wipe unless
// the connected database name clearly belongs to a demo (contains
// "demo"). Without this, a wrong MONGO_URL pointing at real data would
// let the reset cron or seed destroy production.
const assertDemoDatabase = () => {
  const dbName = mongoose.connection?.name || '';
  if (!/demo/i.test(dbName)) {
    throw new Error(
      `[demo] refusing to wipe database "${dbName}" — resetAndSeedDemo only runs on a demo database (name must contain "demo"). Check MONGO_URL.`,
    );
  }
};

export const resetAndSeedDemo = async () => {
  assertDemoDatabase();

  await Promise.all([
    User.deleteMany({}),
    Plant.deleteMany({}),
    PlantPart.deleteMany({}),
    Fault.deleteMany({}),
    Announcement.deleteMany({}),
    Message.deleteMany({}),
    Session.deleteMany({}),
    Unit.deleteMany({}),
    Category.deleteMany({}),
    Warehouse.deleteMany({}),
    InventoryItem.deleteMany({}),
    StockLevel.deleteMany({}),
    StockMovement.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Deliberately fictional placeholder names (Rossi/Bianchi/Verdi are
  // Italy's "John Doe") — the public demo must never show real people.
  const [operator, manager, maintainer, safety, admin, maintainer2, maintainer3] =
    await User.create([
    {
      role: 'operator',
      fullName: 'Mario Rossi',
      email: 'operator@demo.local',
      personalCode: 'OP00001',
      isFirstLogin: false,
    },
    {
      role: 'manager',
      fullName: 'Giulia Bianchi',
      email: 'manager@demo.local',
      password: passwordHash,
      isFirstLogin: false,
    },
    {
      role: 'maintenanceWorker',
      fullName: 'Luca Verdi',
      email: 'maintainer@demo.local',
      password: passwordHash,
      isFirstLogin: false,
      permissions: { canManageWarehouse: true, canOperateWarehouse: true },
    },
    {
      role: 'safety',
      fullName: 'Anna Esposito',
      email: 'safety@demo.local',
      password: passwordHash,
      isFirstLogin: false,
    },
    {
      role: 'admin',
      fullName: 'Paolo Colombo',
      email: 'admin@demo.local',
      password: passwordHash,
      isFirstLogin: false,
    },
    {
      role: 'maintenanceWorker',
      fullName: 'Sofia Marino',
      email: 'maintainer2@demo.local',
      password: passwordHash,
      isFirstLogin: false,
      permissions: { canOperateWarehouse: true },
    },
    {
      role: 'maintenanceWorker',
      fullName: 'Davide Greco',
      email: 'maintainer3@demo.local',
      password: passwordHash,
      isFirstLogin: false,
    },
  ]);

  const plant1 = await Plant.create({
    namePlant: 'Linea Imbottigliamento',
    code: 'L-IMB-01',
    location: 'Capannone A',
    description: 'Demo line for bottling',
  });
  const plant2 = await Plant.create({
    namePlant: 'Linea Etichettatura',
    code: 'L-ETI-02',
    location: 'Capannone B',
    description: 'Demo line for labelling',
  });

  const parts1 = await PlantPart.create([
    { plantId: plant1._id, namePlantPart: 'Cilindro idraulico', codePlantPart: 'CIL-01' },
    { plantId: plant1._id, namePlantPart: 'Motore principale', codePlantPart: 'MOT-01' },
    { plantId: plant1._id, namePlantPart: 'Nastro trasportatore', codePlantPart: 'NAS-01' },
  ]);
  const parts2 = await PlantPart.create([
    { plantId: plant2._id, namePlantPart: 'Motore etichettatrice', codePlantPart: 'MOT-01' },
    { plantId: plant2._id, namePlantPart: 'Sensore di posizione', codePlantPart: 'SEN-01' },
  ]);

  const faults = await Fault.create([
    {
      faultId: 'GUASTO-0001',
      nameOperator: operator.fullName,
      userId: operator._id,
      dataCreated: daysAgo(1),
      timeCreated: '09:15',
      plantId: plant1._id,
      partId: parts1[0]._id,
      typeFault: TYPE_FAULT.PRODUCTION,
      statusFault: STATUS_FAULT.CREATED,
      priority: TYPE_PRIORITY.MEDIUM,
      comment: 'Perdita di olio dal cilindro idraulico.',
    },
    {
      faultId: 'GUASTO-0002',
      nameOperator: operator.fullName,
      userId: operator._id,
      dataCreated: daysAgo(2),
      timeCreated: '11:40',
      plantId: plant1._id,
      partId: parts1[1]._id,
      typeFault: TYPE_FAULT.PRODUCTION,
      statusFault: STATUS_FAULT.IN_PROGRESS,
      priority: TYPE_PRIORITY.HIGH,
      comment: 'Il motore principale si surriscalda durante il ciclo.',
      managerId: manager._id,
      assignedMaintainers: [maintainer._id],
      plannedDate: ymd(new Date()),
      plannedTime: '14:00',
      estimatedDuration: 90,
      claimedBy: maintainer._id,
      claimedAt: daysAgo(1),
    },
    {
      faultId: 'GUASTO-0003',
      nameOperator: operator.fullName,
      userId: operator._id,
      dataCreated: daysAgo(6),
      timeCreated: '08:05',
      plantId: plant2._id,
      partId: parts2[0]._id,
      typeFault: TYPE_FAULT.PRODUCTION,
      statusFault: STATUS_FAULT.COMPLETED,
      priority: TYPE_PRIORITY.LOW,
      comment: 'Sostituzione della cinghia del motore etichettatrice.',
      managerId: manager._id,
      assignedMaintainers: [maintainer2._id],
      commentMaintenanceWorker: 'Cinghia sostituita e linea testata con esito positivo.',
      actualDuration: 45,
      completedAt: daysAgo(4),
    },
    {
      faultId: 'GUASTO-0004',
      nameOperator: operator.fullName,
      userId: operator._id,
      dataCreated: daysAgo(3),
      timeCreated: '16:20',
      plantId: plant1._id,
      partId: parts1[2]._id,
      typeFault: TYPE_FAULT.SAFETY,
      statusFault: STATUS_FAULT.SUSPENDED,
      priority: TYPE_PRIORITY.HIGH,
      comment: 'Protezione del nastro trasportatore danneggiata.',
      managerId: manager._id,
      assignedMaintainers: [maintainer3._id],
      suspensionReason: 'In attesa del pezzo di ricambio dal fornitore.',
    },
    {
      faultId: 'GUASTO-0005',
      nameOperator: operator.fullName,
      userId: operator._id,
      dataCreated: daysAgo(9),
      timeCreated: '10:00',
      plantId: plant2._id,
      partId: parts2[1]._id,
      typeFault: TYPE_FAULT.PRODUCTION,
      statusFault: STATUS_FAULT.OVERDUE,
      priority: TYPE_PRIORITY.HIGH,
      comment: 'Il sensore di posizione non risponde.',
      managerId: manager._id,
      assignedMaintainers: [maintainer._id],
      plannedDate: ymd(daysAgo(2)),
      plannedTime: '09:00',
      deadline: ymd(daysAgo(2)),
    },
  ]);

  await Announcement.create([
    {
      title: 'Manutenzione programmata',
      body: 'Sabato la Linea Imbottigliamento sarà ferma per manutenzione ordinaria.',
      authorId: admin._id,
      authorName: admin.fullName,
      category: 'announcement',
      severity: 'important',
    },
    {
      title: 'Nuova procedura di sicurezza',
      body: 'Da lunedì è obbligatorio l’uso dei guanti antitaglio in reparto.',
      authorId: manager._id,
      authorName: manager.fullName,
      category: 'announcement',
      severity: 'communication',
    },
    {
      title: 'Consegna turno',
      body: 'Motore principale sotto osservazione: controllare la temperatura a inizio turno.',
      authorId: operator._id,
      authorName: operator.fullName,
      category: 'handover',
      severity: 'note',
      plantId: plant1._id,
      plantName: plant1.namePlant,
    },
  ]);

  await Message.create([
    {
      type: 'broadcast_all',
      authorId: manager._id,
      authorName: manager.fullName,
      authorRole: 'manager',
      subject: 'Riunione settimanale',
      body: 'Riunione di reparto venerdì alle 15:00 in sala controllo.',
    },
    {
      type: 'direct',
      authorId: manager._id,
      authorName: manager.fullName,
      authorRole: 'manager',
      recipientId: operator._id,
      subject: 'Segnalazione GUASTO-0001',
      body: 'Grazie per la segnalazione, la assegneremo a un manutentore a breve.',
    },
  ]);

  // ── Warehouse / inventory demo world ──────────────────────────────
  // No settings toggle needed: in DEMO_MODE the warehouse module is
  // always on (see toPublicView / requireWarehouseEnabled), so the seed
  // just inserts data — same as plants and users.
  // Piece-like units stay integer; continuous ones allow decimals.
  const [uPz, uM, , uL] = await Unit.create([
    { code: 'pz', name: 'Pezzi', allowsDecimals: false },
    { code: 'm', name: 'Metri', allowsDecimals: true },
    { code: 'kg', name: 'Chilogrammi', allowsDecimals: true },
    { code: 'l', name: 'Litri', allowsDecimals: true },
    { code: 'cm', name: 'Centimetri', allowsDecimals: true },
  ]);

  const [whCentral, whLineA] = await Warehouse.create([
    { code: 'MAG-01', name: 'Magazzino Centrale', location: 'Capannone A' },
    { code: 'MAG-02', name: 'Magazzino Linea A', location: 'Capannone A - Linea 1' },
  ]);

  const [cLub, cTras, cCus, cEle, cDpi, cIdr, cMin] = await Category.create([
    { name: 'Lubrificanti' },
    { name: 'Trasmissione' },
    { name: 'Cuscinetti' },
    { name: 'Elettronica' },
    { name: 'DPI' },
    { name: 'Idraulica' },
    { name: 'Minuteria' },
  ]);

  // One item carries a 13-digit EAN-like code to demo barcode scanning.
  const items = await InventoryItem.create([
    { code: 'OIL-HYD-46', name: 'Olio idraulico ISO 46', categoryId: cLub._id, unitId: uL._id },
    { code: 'BELT-A42', name: 'Cinghia trapezoidale A42', categoryId: cTras._id, unitId: uPz._id },
    { code: 'BEARING-6204', name: 'Cuscinetto 6204 2RS', categoryId: cCus._id, unitId: uPz._id },
    { code: 'SENS-IND-M12', name: 'Sensore induttivo M12', categoryId: cEle._id, unitId: uPz._id },
    { code: '8001234567890', name: 'Guanti antitaglio (paio)', categoryId: cDpi._id, unitId: uPz._id },
    { code: 'HOSE-PN10-19', name: 'Tubo idraulico PN10 19mm', categoryId: cIdr._id, unitId: uM._id },
    // Delivered in boxes of 100 but consumed by the piece — demoes the
    // package-intake flow (Carico in "Scatole", Scarico in "Pezzi").
    { code: 'VITE-4X40', name: 'Viti autofilettanti 4x40', categoryId: cMin._id, unitId: uPz._id, packageLabel: 'Scatola', unitsPerPackage: 100 },
  ]);

  // On-hand per (item x warehouse); a few sit at/below minLevel to demo
  // the low-stock badge.
  await StockLevel.create([
    { itemId: items[0]._id, warehouseId: whCentral._id, quantity: 120, minLevel: 40 },
    { itemId: items[1]._id, warehouseId: whCentral._id, quantity: 8, minLevel: 10 },
    { itemId: items[2]._id, warehouseId: whCentral._id, quantity: 24, minLevel: 8 },
    { itemId: items[3]._id, warehouseId: whCentral._id, quantity: 3, minLevel: 5 },
    { itemId: items[4]._id, warehouseId: whCentral._id, quantity: 50, minLevel: 20 },
    { itemId: items[5]._id, warehouseId: whCentral._id, quantity: 60, minLevel: 15 },
    { itemId: items[1]._id, warehouseId: whLineA._id, quantity: 4, minLevel: 6 },
    { itemId: items[2]._id, warehouseId: whLineA._id, quantity: 12, minLevel: 4 },
    { itemId: items[3]._id, warehouseId: whLineA._id, quantity: 6, minLevel: 3 },
    { itemId: items[6]._id, warehouseId: whCentral._id, quantity: 250, minLevel: 100 },
  ]);

  await StockMovement.create([
    {
      itemId: items[0]._id,
      warehouseId: whCentral._id,
      type: 'in',
      quantity: 120,
      userId: admin._id,
      userName: admin.fullName,
      note: 'Carico iniziale magazzino',
      createdAt: daysAgo(20),
    },
    {
      itemId: items[2]._id,
      warehouseId: whCentral._id,
      type: 'out',
      quantity: 2,
      userId: maintainer2._id,
      userName: maintainer2.fullName,
      reference: { type: 'fault', faultId: faults[2]._id },
      note: 'Materiale usato per GUASTO-0003',
      createdAt: daysAgo(4),
    },
    {
      itemId: items[1]._id,
      warehouseId: whCentral._id,
      type: 'out',
      quantity: 1,
      userId: maintainer._id,
      userName: maintainer.fullName,
      reference: { type: 'task', label: 'Manutenzione preventiva' },
      createdAt: daysAgo(2),
    },
    {
      itemId: items[3]._id,
      warehouseId: whLineA._id,
      type: 'adjust',
      quantity: 6,
      userId: admin._id,
      userName: admin.fullName,
      note: 'Rettifica inventario',
      createdAt: daysAgo(1),
    },
  ]);

  return {
    users: 7,
    plants: 2,
    parts: parts1.length + parts2.length,
    faults: 5,
    announcements: 3,
    messages: 2,
    warehouses: 2,
    units: 5,
    items: items.length,
    safetyUser: safety.email,
  };
};

// Startup helper: seed the demo world only when the database is empty,
// so a fresh deploy has content immediately (before the first reset
// cron fires) without wiping data on every restart. The periodic
// resetAndSeedDemo cron handles ongoing cleanup.
export const seedDemoIfEmpty = async () => {
  const count = await User.countDocuments();
  if (count > 0) {
    console.log('[demo] existing data found — skipping initial seed');
    return null;
  }
  console.log('[demo] empty database — seeding initial demo world');
  return resetAndSeedDemo();
};
