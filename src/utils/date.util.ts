const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_REGEX.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(value?: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}
