export const normalizePhone = (phone: string): string => {
  const trimmed = phone.trim();
  if (!trimmed) {
    return "+62";
  }

  const digitsOnly = trimmed.replace(/[^0-9]/g, "");
  if (!digitsOnly) {
    return "+62";
  }

  if (digitsOnly.startsWith("62")) {
    return `+${digitsOnly}`;
  }

  if (digitsOnly.startsWith("0")) {
    return `+62${digitsOnly.slice(1)}`;
  }

  return `+62${digitsOnly}`;
};
