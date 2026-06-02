export function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

export function diffDays(start, end) {
  return Math.round(
    (new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) /
      86_400_000
  );
}
