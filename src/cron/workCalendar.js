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

export const isWorkingDay = (dateTime, { workDays, holidays }) => {
  const cronWeekday = luxonWeekdayToCronWeekday(dateTime.weekday);
  if (!workDays.includes(cronWeekday)) return false;

  const dateStr = dateTime.toFormat(DATE_FORMAT);
  const isHoliday = holidays.some((h) => {
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

export const generateSlots = (dayDateTime, { workHours, slotDurationMinutes }) => {
  const [startH, startM] = workHours.start.split(':').map(Number);
  const [endH, endM] = workHours.end.split(':').map(Number);

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
