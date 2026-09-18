import { ShopResponse } from 'src/dtos/shop/shop.response.dto';
import { WeekDay } from 'src/enums';
import { OperatingHour } from 'src/models/shop/operating-hour.model';
import { OperatingTimeInfo } from 'src/models/shop/operating-time-info.model';
import { Shop } from 'src/schemas/shop.schema';

// Date#getDay() is 0 (Sunday) - 6 (Saturday); WeekDay starts at Monday.
const WEEK_DAYS_BY_JS_INDEX: WeekDay[] = [
  WeekDay.Sunday,
  WeekDay.Monday,
  WeekDay.Tuesday,
  WeekDay.Wednesday,
  WeekDay.Thursday,
  WeekDay.Friday,
  WeekDay.Saturday,
];

//"08:00" -> 480 (minutes since midnight)
function toMinutes(time: string): number | null {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

//"18:00" -> "6:00 PM"
function toDisplayTime(time: string): string {
  const minutesOfDay = toMinutes(time);
  if (minutesOfDay === null) return time;
  const hours24 = Math.floor(minutesOfDay / 60);
  const minutes = minutesOfDay % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Finds today's entry in a shop's operating hours and describes whether it's
 * open right now, e.g. { isOpen: true, message: 'Open until 6:00 PM' }.
 */
export function getShopOperatingTimeInfo(
  operatingHours: OperatingHour[] = [],
): OperatingTimeInfo {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayIndex = now.getDay();

  const today = operatingHours.find(
    (hour) => hour.day === WEEK_DAYS_BY_JS_INDEX[todayIndex],
  );

  if (today?.isAvailable) {
    const opensAt = toMinutes(today.openingTime);
    const closesAt = toMinutes(today.closingTime);

    if (opensAt !== null && nowMinutes < opensAt) {
      return {
        isOpen: false,
        message: `Opens at ${toDisplayTime(today.openingTime)}`,
      };
    }
    if (closesAt !== null && nowMinutes < closesAt) {
      return {
        isOpen: true,
        message: `Open until ${toDisplayTime(today.closingTime)}`,
      };
    }
  }

  // Closed for the rest of today; look ahead for the next open day.
  for (let offset = 1; offset <= 7; offset++) {
    const dayIndex = (todayIndex + offset) % 7;
    const next = operatingHours.find(
      (hour) =>
        hour.day === WEEK_DAYS_BY_JS_INDEX[dayIndex] &&
        hour.isAvailable &&
        hour.openingTime,
    );
    if (next) {
      const when = offset === 1 ? 'tomorrow' : next.day;
      return {
        isOpen: false,
        message: `Closed · Opens ${when} at ${toDisplayTime(next.openingTime)}`,
      };
    }
  }

  return { isOpen: false, message: 'Closed' };
}

//shapes a shop for an API response by attaching its live operatingTimeInfo -
//nextReceiptNo is attached separately (it needs the CounterRepository), see
//ShopService.attachReceiptInfo
export function withOperatingTimeInfo(
  shop: Shop,
): Omit<ShopResponse, 'nextReceiptNo'> {
  return {
    ...shop,
    operatingTimeInfo: getShopOperatingTimeInfo(shop.operatingHours),
  };
}
