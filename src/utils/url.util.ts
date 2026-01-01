export const isHttpUrl = (value?: string): boolean => {
  if (!value) {
    return false;
  }

  return /^https?:\/\//i.test(value.trim());
};
