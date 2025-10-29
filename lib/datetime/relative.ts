type RelativeOptions = {
  now?: Date;
};

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function formatRelativeTime(
  input: string | Date | null | undefined,
  options: RelativeOptions = {},
) {
  if (!input) {
    return "";
  }
  const now = options.now ?? new Date();
  const target = typeof input === "string" ? new Date(input) : input;

  if (Number.isNaN(target.getTime())) {
    return "";
  }

  const diff = now.getTime() - target.getTime();
  const diffAbs = Math.abs(diff);

  if (diffAbs < 2 * MS_PER_MINUTE) {
    return "beberapa detik lalu";
  }

  if (diffAbs < MS_PER_HOUR) {
    const minutes = Math.max(1, Math.round(diffAbs / MS_PER_MINUTE));
    return `${minutes} menit lalu`;
  }

  if (diffAbs < 12 * MS_PER_HOUR) {
    const hours = Math.max(1, Math.round(diffAbs / MS_PER_HOUR));
    return `${hours} jam lalu`;
  }

  if (diffAbs < 24 * MS_PER_HOUR) {
    return "beberapa jam lalu";
  }

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);

  if (target >= startOfYesterday && target < startOfToday) {
    return "kemarin";
  }

  const diffDays = Math.floor(diffAbs / MS_PER_DAY);
  if (diffDays < 4) {
    return `${diffDays} hari lalu`;
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(target);
}
