import path from "path";

export type FileCategory = "image" | "video" | "audio" | "document";

export interface FileTypeSpec {
  mimeType: string;
  category: FileCategory;
  /** extensions[0] is canonical - used as the stored file's extension */
  extensions: string[];
}

/**
 * Single source of truth for every file type KarirKit accepts.
 *
 * The allowed mime type list, the mime -> extension map, and the
 * mime -> category lookup are all *derived* from this array below,
 * so a format only ever needs to be added/removed in one place.
 *
 * Kept deliberately short: only the formats people actually produce
 * day-to-day from a phone or laptop when applying for a job.
 */
export const FILE_TYPES: FileTypeSpec[] = [
  // Images
  { mimeType: "image/jpeg", category: "image", extensions: [".jpg", ".jpeg"] },
  { mimeType: "image/png", category: "image", extensions: [".png"] },
  { mimeType: "image/webp", category: "image", extensions: [".webp"] },

  // Videos
  { mimeType: "video/mp4", category: "video", extensions: [".mp4"] },
  { mimeType: "video/quicktime", category: "video", extensions: [".mov"] },
  { mimeType: "video/webm", category: "video", extensions: [".webm"] },

  // Audio
  { mimeType: "audio/mpeg", category: "audio", extensions: [".mp3"] },
  { mimeType: "audio/mp4", category: "audio", extensions: [".m4a"] },
  { mimeType: "audio/wav", category: "audio", extensions: [".wav"] },
  { mimeType: "audio/ogg", category: "audio", extensions: [".ogg"] },

  // Documents - the ones people actually attach to a job application
  { mimeType: "application/pdf", category: "document", extensions: [".pdf"] },
  {
    mimeType: "application/msword",
    category: "document",
    extensions: [".doc"],
  },
  {
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    category: "document",
    extensions: [".docx"],
  },
  {
    mimeType: "application/vnd.ms-excel",
    category: "document",
    extensions: [".xls"],
  },
  {
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    category: "document",
    extensions: [".xlsx"],
  },
  {
    mimeType: "application/vnd.ms-powerpoint",
    category: "document",
    extensions: [".ppt"],
  },
  {
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    category: "document",
    extensions: [".pptx"],
  },
];

const byExtension = new Map<string, FileTypeSpec>(
  FILE_TYPES.flatMap((spec) =>
    spec.extensions.map((ext) => [ext, spec] as const),
  ),
);

export const ALLOWED_MIME_TYPES = new Set(
  FILE_TYPES.map((spec) => spec.mimeType),
);

export const ALL_VERIFIED_UPLOAD_MIME_TYPES = FILE_TYPES.map(
  (spec) => spec.mimeType,
);

export const MIME_TYPE_TO_EXTENSION: Record<string, string> =
  Object.fromEntries(
    FILE_TYPES.map((spec) => [spec.mimeType, spec.extensions[0]]),
  );

/** Grouped by category, for call sites that whitelist mime types per group (e.g. multer filters). */
export const VERIFIED_UPLOAD_MIME_TYPES = {
  image: FILE_TYPES.filter((s) => s.category === "image").map(
    (s) => s.mimeType,
  ),
  video: FILE_TYPES.filter((s) => s.category === "video").map(
    (s) => s.mimeType,
  ),
  audio: FILE_TYPES.filter((s) => s.category === "audio").map(
    (s) => s.mimeType,
  ),
  document: FILE_TYPES.filter((s) => s.category === "document").map(
    (s) => s.mimeType,
  ),
} as const;

export const isMimeTypeAllowed = (mimeType: string): boolean =>
  ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());

export const getFileCategory = (mimeType: string): FileCategory | null => {
  const spec = FILE_TYPES.find((s) => s.mimeType === mimeType.toLowerCase());
  return spec?.category ?? null;
};

/* ---------- Magic-byte (content sniffing) detection ---------- */

const startsWith = (buffer: Buffer, signature: Buffer | string): boolean => {
  const bytes = Buffer.isBuffer(signature)
    ? signature
    : Buffer.from(signature, "ascii");
  return (
    buffer.length >= bytes.length &&
    buffer.subarray(0, bytes.length).equals(bytes)
  );
};

const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE_SIGNATURE = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const EBML_SIGNATURE = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

const isRiffOfType = (buffer: Buffer, riffType: string): boolean =>
  buffer.length >= 12 &&
  buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
  buffer.subarray(8, 12).toString("ascii") === riffType;

const detectMp4FamilyMime = (
  buffer: Buffer,
  extension: string,
): string | null => {
  if (
    buffer.length < 12 ||
    buffer.subarray(4, 8).toString("ascii") !== "ftyp"
  ) {
    return null;
  }
  const brand = buffer.subarray(8, 12).toString("ascii").toLowerCase();
  if (brand.startsWith("qt")) return "video/quicktime";
  if (extension === ".m4a") return "audio/mp4";
  return "video/mp4";
};

/**
 * .docx/.xlsx/.pptx are zip containers and .doc/.xls/.ppt are OLE containers -
 * the container signature is shared across the whole Office family, so it can
 * only confirm "this is a zip/OLE file". The extension (already checked
 * against FILE_TYPES) is what resolves it to the exact mime type.
 */
const detectOfficeMime = (buffer: Buffer, extension: string): string | null => {
  const spec = byExtension.get(extension);
  if (!spec || spec.category !== "document") return null;

  if (startsWith(buffer, ZIP_SIGNATURE)) {
    return [".docx", ".xlsx", ".pptx"].includes(extension)
      ? spec.mimeType
      : null;
  }
  if (startsWith(buffer, OLE_SIGNATURE)) {
    return [".doc", ".xls", ".ppt"].includes(extension) ? spec.mimeType : null;
  }
  return null;
};

/**
 * Sniffs the *real* mime type of an uploaded file from its bytes instead of
 * trusting the Content-Type header the client sent. Returns null when the
 * content doesn't match any format KarirKit accepts.
 */
export const detectFileMimeType = (
  file: Pick<Express.Multer.File, "buffer" | "originalname">,
): string | null => {
  const { buffer, originalname } = file;
  if (!buffer || buffer.length === 0) return null;

  const extension = path.extname(originalname).toLowerCase();

  if (startsWith(buffer, JPEG_SIGNATURE)) return "image/jpeg";
  if (startsWith(buffer, PNG_SIGNATURE)) return "image/png";
  if (isRiffOfType(buffer, "WEBP")) return "image/webp";
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-")
    return "application/pdf";

  const mp4Mime = detectMp4FamilyMime(buffer, extension);
  if (mp4Mime) return mp4Mime;

  if (isRiffOfType(buffer, "WAVE")) return "audio/wav";
  if (startsWith(buffer, "OggS")) return "audio/ogg";
  if (
    startsWith(buffer, "ID3") ||
    (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  ) {
    return "audio/mpeg";
  }
  if (startsWith(buffer, EBML_SIGNATURE)) return "video/webm";

  return detectOfficeMime(buffer, extension);
};

/** Detects and overwrites `file.mimetype` with the sniffed value, if any. */
export const applyVerifiedMimeType = (
  file: Express.Multer.File,
): string | null => {
  const detected = detectFileMimeType(file);
  if (detected) {
    file.mimetype = detected;
  }
  return detected;
};
