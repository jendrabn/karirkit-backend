export const slugify = (
  text: string,
  randomSuffixLength: number = 0
): string => {
  let slug = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text

  if (randomSuffixLength > 0) {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let randomString = "";
    for (let i = 0; i < randomSuffixLength; i++) {
      randomString += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    slug = `${slug}-${randomString}`;
  }

  return slug;
};
