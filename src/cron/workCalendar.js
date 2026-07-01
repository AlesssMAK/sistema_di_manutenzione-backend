import { DateTime } from 'luxon';

const DATE_FORMAT = 'yyyy-LL-dd';
const TIME_FORMAT = 'HH:mm';

const luxonWeekdayToCronWeekday = (luxonWeekday) =>
  luxonWeekday === 7 ? 0 : luxonWeekday;

export const todayInZone = (timezone) =>
  DateTime.now().setZone(timezone).toFormat(DATE_FORMAT);

export const yesterdayInZone = (timezone) =>
  DateTime.now().setZone(timezone).minus({ days: 1 }).toFormat(DATE_FORMAT);

export const parseDateInZone = (yyyyMmDd, timezone) =>
  DateTime.fromFormat(yyyyMmDd, DATE_FORMAT, { zone: timezone });

export const endOfDayInZone = (yyyyMmDd, timezone) =>
  parseDateInZone(yyyyMmDd, timezone).endOf('day');

const CRON_TO_DAY_KEY = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

// Resolve the working config for a given day from the per-day
// weekSchedule, falling back to the legacy workDays/workHours for
// settings created before weekSchedule existed.
const dayConfig = (dateTime, settings) => {
  const cron = luxonWeekdayToCronWeekday(dateTime.weekday);
  const fromWeek = settings.weekSchedule?.[CRON_TO_DAY_KEY[cron]];
  if (fromWeek) return fromWeek;
  return {
    enabled: (settings.workDays ?? []).includes(cron),
    start: settings.workHours?.start ?? '08:00',
    end: settings.workHours?.end ?? '17:00',
  };
};

export const isWorkingDay = (dateTime, settings) => {
  const cfg = dayConfig(dateTime, settings);
  if (!cfg?.enabled) return false;

  const dateStr = dateTime.toFormat(DATE_FORMAT);
  const isHoliday = (settings.holidays ?? []).some((h) => {
    const holidayDt =
      h instanceof Date
        ? DateTime.fromJSDate(h, { zone: dateTime.zoneName })
        : DateTime.fromISO(String(h), { zone: dateTime.zoneName });
    return holidayDt.toFormat(DATE_FORMAT) === dateStr;
  });
  return !isHoliday;
};

export const nextWorkingDay = (fromDate, settings, maxIterations = 60) => {
  let candidate = fromDate.plus({ days: 1 }).startOf('day');
  for (let i = 0; i < maxIterations; i += 1) {
    if (isWorkingDay(candidate, settings)) return candidate;
    candidate = candidate.plus({ days: 1 });
  }
  return null;
};

export const generateSlots = (dayDateTime, settings) => {
  const cfg = dayConfig(dayDateTime, settings);
  if (!cfg?.enabled) return [];

  const { slotDurationMinutes } = settings;
  const [startH, startM] = cfg.start.split(':').map(Number);
  const [endH, endM] = cfg.end.split(':').map(Number);

  const dayStart = dayDateTime.set({
    hour: startH,
    minute: startM,
    second: 0,
    millisecond: 0,
  });
  const dayEnd = dayDateTime.set({
    hour: endH,
    minute: endM,
    second: 0,
    millisecond: 0,
  });

  const slots = [];
  let cursor = dayStart;
  while (cursor.plus({ minutes: slotDurationMinutes }) <= dayEnd) {
    slots.push({
      date: cursor.toFormat(DATE_FORMAT),
      time: cursor.toFormat(TIME_FORMAT),
      dateTime: cursor,
    });
    cursor = cursor.plus({ minutes: slotDurationMinutes });
  }
  return slots;
};

export const isDateBeforeToday = (yyyyMmDd, timezone) => {
  if (!yyyyMmDd) return false;
  return yyyyMmDd < todayInZone(timezone);
};
