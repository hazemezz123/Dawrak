/**
 * Returns today's date in Africa/Cairo timezone at UTC midnight.
 * Suitable for Prisma @db.Date field.
 */
export function getCairoDate(): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(new Date()); // Format: YYYY-MM-DD
  return new Date(`${dateStr}T00:00:00.000Z`);
}
