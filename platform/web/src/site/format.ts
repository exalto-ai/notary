export function bytes(value: number): string {
  if (value < 1000) return `${value} B`;
  const units = ['kB', 'MB', 'GB', 'TB'];
  let scaled = value / 1000;
  let unit = 0;
  while (scaled >= 1000 && unit < units.length - 1) {
    scaled /= 1000;
    unit += 1;
  }
  return `${scaled.toFixed(scaled >= 100 ? 0 : 1)} ${units[unit]}`;
}

export function percent(used: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((used / total) * 100)}%`;
}

export function sessionDate(unixSeconds: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(unixSeconds * 1000));
}
export function listingDate(unixSeconds: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(unixSeconds * 1000),
  );
}
