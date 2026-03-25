import path from "path";

export const VERIFIED_UPLOAD_MIME_TYPES = {
  image: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ],
  video: [
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
  ],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "application/rtf",
  ],
} as const;

const OLE_SIGNATURE = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPEG_SIGNATURE_PREFIX = Buffer.from([0xff, 0xd8, 0xff]);
const GIF87A_SIGNATURE = Buffer.from("GIF87a", "ascii");
const GIF89A_SIGNATURE = Buffer.from("GIF89a", "ascii");
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const EBML_SIGNATURE = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

export const ALL_VERIFIED_UPLOAD_MIME_TYPES = [
  ...VERIFIED_UPLOAD_MIME_TYPES.image,
  ...VERIFIED_UPLOAD_MIME_TYPES.video,
  ...VERIFIED_UPLOAD_MIME_TYPES.document,
];

const startsWith = (buffer: Buffer, signature: Buffer): boolean => {
  if (buffer.length < signature.length) {
    return false;
  }
  return buffer.subarray(0, signature.length).equals(signature);
};

const detectMp4FamilyMime = (buffer: Buffer): string | null => {
  if (buffer.length < 12) {
    return null;
  }

  const boxType = buffer.subarray(4, 8).toString("ascii");
  if (boxType !== "ftyp") {
    return null;
  }

  const brand = buffer.subarray(8, 12).toString("ascii").toLowerCase();
  if (brand.startsWith("qt")) {
    return "video/quicktime";
  }

  return "video/mp4";
};

const detectZipOfficeMime = (buffer: Buffer): string | null => {
  if (!startsWith(buffer, ZIP_SIGNATURE)) {
    return null;
  }

  const preview = buffer.toString("latin1");
  if (preview.includes("word/")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (preview.includes("xl/")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (preview.includes("ppt/")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }

  return null;
};

const detectOleOfficeMime = (buffer: Buffer, originalName: string): string | null => {
  if (!startsWith(buffer, OLE_SIGNATURE)) {
    return null;
  }

  const extension = path.extname(originalName).toLowerCase();
  if (extension === ".doc") {
    return "application/msword";
  }
  if (extension === ".xls") {
    return "application/vnd.ms-excel";
  }
  if (extension === ".ppt") {
    return "application/vnd.ms-powerpoint";
  }

  return null;
};

const looksLikePlainText = (buffer: Buffer): boolean => {
  if (buffer.length === 0) {
    return false;
  }

  let printable = 0;
  for (const byte of buffer.subarray(0, Math.min(buffer.length, 512))) {
    if (byte === 0) {
      return false;
    }

    if (
      byte === 0x09 ||
      byte === 0x0a ||
      byte === 0x0d ||
      (byte >= 0x20 && byte <= 0x7e)
    ) {
      printable += 1;
    }
  }

  return printable > 0;
};

export const detectFileMimeType = (
  file: Pick<Express.Multer.File, "buffer" | "originalname">
): string | null => {
  const buffer = file.buffer;
  if (!buffer || buffer.length === 0) {
    return null;
  }

  if (startsWith(buffer, JPEG_SIGNATURE_PREFIX)) {
    return "image/jpeg";
  }
  if (startsWith(buffer, PNG_SIGNATURE)) {
    return "image/png";
  }
  if (
    startsWith(buffer, GIF87A_SIGNATURE) ||
    startsWith(buffer, GIF89A_SIGNATURE)
  ) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }

  const mp4FamilyMime = detectMp4FamilyMime(buffer);
  if (mp4FamilyMime) {
    return mp4FamilyMime;
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "AVI "
  ) {
    return "video/x-msvideo";
  }

  if (startsWith(buffer, EBML_SIGNATURE)) {
    return "video/x-matroska";
  }

  const zipOfficeMime = detectZipOfficeMime(buffer);
  if (zipOfficeMime) {
    return zipOfficeMime;
  }

  const oleOfficeMime = detectOleOfficeMime(buffer, file.originalname);
  if (oleOfficeMime) {
    return oleOfficeMime;
  }

  const textPreview = buffer
    .subarray(0, Math.min(buffer.length, 256))
    .toString("utf8")
    .trimStart()
    .toLowerCase();
  if (textPreview.startsWith("{\\rtf")) {
    return "application/rtf";
  }
  if (textPreview.startsWith("<svg")) {
    return "image/svg+xml";
  }
  if (looksLikePlainText(buffer)) {
    return "text/plain";
  }

  return null;
};

export const applyVerifiedMimeType = (
  file: Express.Multer.File
): string | null => {
  const detectedMimeType = detectFileMimeType(file);
  if (detectedMimeType) {
    file.mimetype = detectedMimeType;
  }
  return detectedMimeType;
};
