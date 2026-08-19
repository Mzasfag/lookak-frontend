/**
 * Utility functions for time formatting.
 */

/**
 * Converts a 24-hour time string (e.g., "13:00", "09:30") to 12-hour format
 * with Arabic AM/PM indicators (ص for AM, م for PM).
 *
 * @param time24 - Time string in 24-hour format (HH:mm or H:mm)
 * @returns Formatted time string in 12-hour format with Arabic AM/PM (e.g., "1:00 م", "9:30 ص")
 *          Returns original string if parsing fails or input is invalid.
 *
 * @example
 * formatTimeTo12Hour("13:00") // "1:00 م"
 * formatTimeTo12Hour("09:30") // "9:30 ص"
 * formatTimeTo12Hour("00:00") // "12:00 ص"
 * formatTimeTo12Hour("12:00") // "12:00 م"
 */
export function formatTimeTo12Hour(time24?: string | null): string {
  if (!time24 || typeof time24 !== 'string') {
    return '—';
  }

  const trimmed = time24.trim();
  if (!trimmed) {
    return '—';
  }

  // Parse time string (supports both HH:mm and H:mm formats)
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    // If not a valid time format, return as-is
    return trimmed;
  }

  let hours = parseInt(match[1], 10);
  const minutes = match[2];

  // Validate hours and minutes
  if (hours < 0 || hours > 23) {
    return trimmed;
  }

  // Determine period (AM = ص, PM = م)
  const period = hours >= 12 ? 'م' : 'ص';

  // Convert to 12-hour format
  if (hours === 0) {
    hours = 12; // Midnight -> 12 AM
  } else if (hours > 12) {
    hours = hours - 12;
  }
  // hours === 12 stays as 12 (noon)

  return `${hours}:${minutes} ${period}`;
}

/**
 * Parses the hour from a time string (supports both 12-hour and 24-hour formats).
 * Used for grouping time slots by period (morning/afternoon/evening).
 *
 * @param timeStr - Time string in various formats
 * @returns Hour in 24-hour format (0-23), or 0 if parsing fails
 *
 * @example
 * parseHourFrom24(("13:00") // 13
 * parseHourFrom24("09:30") // 9
 * parseHourFrom24("1:00 م") // 13
 */
export function parseHourFrom24(timeStr: string): number {
  if (!timeStr) return 0;

  // First try to extract hour from 24-hour format
  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hour = parseInt(match24[1], 10);
    return hour >= 0 && hour <= 23 ? hour : 0;
  }

  // Try to parse 12-hour format with Arabic AM/PM
  const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*([صم])$/);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const period = match12[3];

    if (period === 'م') {
      // PM
      if (hour !== 12) hour += 12;
    } else {
      // AM (ص)
      if (hour === 12) hour = 0; // Midnight
    }

    return hour >= 0 && hour <= 23 ? hour : 0;
  }

  // Fallback: just extract first number
  const simpleMatch = timeStr.match(/^(\d{1,2})/);
  return simpleMatch ? parseInt(simpleMatch[1], 10) : 0;
}
