export function calculateReadTime(content: string): number {
  // Remove HTML tags
  const plainText = content.replace(/<[^>]*>?/gm, "");
  // Remove new lines and extra spaces
  const cleanText = plainText.replace(/\s+/g, " ").trim();
  const wordCount = cleanText.split(" ").length;
  const wordsPerMinute = 200;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return minutes > 0 ? minutes : 1;
}
