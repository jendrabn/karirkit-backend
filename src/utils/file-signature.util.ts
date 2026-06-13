import path from "path";

export const VERIFIED_UPLOAD_MIME_TYPES = {
  image: [
    "image/avif",
    "image/bmp",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/heic",
    "image/heif",
    "image/svg+xml",
    "image/tiff",
    "image/x-icon",
    "image/vnd.microsoft.icon",
    "image/webp",
  ],
  video: [
    "video/3gpp",
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/webm",
    "video/x-msvideo",
    "video/x-matroska",
  ],
  audio: [
    "audio/aac",
    "audio/flac",
    "audio/m4a",
    "audio/mp4",
    "audio/mpeg",
    "audio/ogg",
    "audio/opus",
    "audio/wav",
    "audio/webm",
    "audio/x-m4a",
    "audio/x-wav",
    "audio/amr",
  ],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.ms-word.document.macroenabled.12",
    "application/vnd.ms-word.template.macroenabled.12",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.ms-excel.sheet.binary.macroenabled.12",
    "application/vnd.ms-excel.sheet.macroenabled.12",
    "application/vnd.ms-excel.template.macroenabled.12",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.ms-powerpoint.addin.macroenabled.12",
    "application/vnd.ms-powerpoint.presentation.macroenabled.12",
    "application/vnd.ms-powerpoint.slideshow.macroenabled.12",
    "application/vnd.ms-powerpoint.template.macroenabled.12",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
    "application/vnd.openxmlformats-officedocument.presentationml.template",
    "application/vnd.ms-access",
    "application/vnd.ms-publisher",
    "application/vnd.ms-visio.drawing",
    "application/vnd.openxmlformats-officedocument.drawingml.diagramData+xml",
    "application/onenote",
    "text/csv",
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
const FLAC_SIGNATURE = Buffer.from("fLaC", "ascii");
const ID3_SIGNATURE = Buffer.from("ID3", "ascii");

const OFFICE_MIME_BY_EXTENSION: Record<string, string> = {
  ".accdb": "application/vnd.ms-access",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docm": "application/vnd.ms-word.document.macroenabled.12",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".dot": "application/msword",
  ".dotm": "application/vnd.ms-word.template.macroenabled.12",
  ".dotx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  ".mdb": "application/vnd.ms-access",
  ".one": "application/onenote",
  ".pot": "application/vnd.ms-powerpoint",
  ".potm": "application/vnd.ms-powerpoint.template.macroenabled.12",
  ".potx":
    "application/vnd.openxmlformats-officedocument.presentationml.template",
  ".pps": "application/vnd.ms-powerpoint",
  ".ppsm": "application/vnd.ms-powerpoint.slideshow.macroenabled.12",
  ".ppsx":
    "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptm": "application/vnd.ms-powerpoint.presentation.macroenabled.12",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pub": "application/vnd.ms-publisher",
  ".rtf": "application/rtf",
  ".vsd": "application/vnd.ms-visio.drawing",
  ".vsdx": "application/vnd.ms-visio.drawing",
  ".xls": "application/vnd.ms-excel",
  ".xlsb": "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  ".xlsm": "application/vnd.ms-excel.sheet.macroenabled.12",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xlt": "application/vnd.ms-excel",
  ".xltm": "application/vnd.ms-excel.template.macroenabled.12",
  ".xltx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
};

const DECLARED_MIME_BY_EXTENSION: Record<string, string> = {
  ".3gp": "video/3gpp",
  ".aac": "audio/aac",
  ".amr": "audio/amr",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".flac": "audio/flac",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".ico": "image/x-icon",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".mpg": "video/mpeg",
  ".mpeg": "video/mpeg",
  ".oga": "audio/ogg",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus",
  ".svg": "image/svg+xml",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ...OFFICE_MIME_BY_EXTENSION,
};

export const ALL_VERIFIED_UPLOAD_MIME_TYPES = [
  ...VERIFIED_UPLOAD_MIME_TYPES.image,
  ...VERIFIED_UPLOAD_MIME_TYPES.video,
  ...VERIFIED_UPLOAD_MIME_TYPES.audio,
  ...VERIFIED_UPLOAD_MIME_TYPES.document,
];

const startsWith = (buffer: Buffer, signature: Buffer): boolean => {
  if (buffer.length < signature.length) {
    return false;
  }
  return buffer.subarray(0, signature.length).equals(signature);
};

const detectMp4FamilyMime = (
  buffer: Buffer,
  originalName: string
): string | null => {
  if (buffer.length < 12) {
    return null;
  }

  const boxType = buffer.subarray(4, 8).toString("ascii");
  if (boxType !== "ftyp") {
    return null;
  }

  const brand = buffer.subarray(8, 12).toString("ascii").toLowerCase();
  const extension = path.extname(originalName).toLowerCase();
  if (brand.startsWith("qt")) {
    return "video/quicktime";
  }
  if (["avif", "avis"].includes(brand)) {
    return "image/avif";
  }
  if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
    return extension === ".heif" ? "image/heif" : "image/heic";
  }
  if (extension === ".m4a") {
    return "audio/mp4";
  }
  if (extension === ".3gp") {
    return "video/3gpp";
  }

  return "video/mp4";
};

const detectZipOfficeMime = (
  buffer: Buffer,
  originalName: string
): string | null => {
  if (!startsWith(buffer, ZIP_SIGNATURE)) {
    return null;
  }

  const extension = path.extname(originalName).toLowerCase();
  const preview = buffer.toString("latin1");
  if (preview.includes("word/")) {
    return (
      OFFICE_MIME_BY_EXTENSION[extension] ??
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  }
  if (preview.includes("xl/")) {
    return (
      OFFICE_MIME_BY_EXTENSION[extension] ??
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  }
  if (preview.includes("ppt/")) {
    return (
      OFFICE_MIME_BY_EXTENSION[extension] ??
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
  }
  if (extension === ".vsdx") {
    return OFFICE_MIME_BY_EXTENSION[extension];
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
  if (OFFICE_MIME_BY_EXTENSION[extension]) {
    return OFFICE_MIME_BY_EXTENSION[extension];
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

const detectDeclaredAllowedMime = (
  file: Pick<Express.Multer.File, "mimetype" | "originalname">
): string | null => {
  const extension = path.extname(file.originalname).toLowerCase();
  const extensionMime = DECLARED_MIME_BY_EXTENSION[extension];
  const declaredMime = file.mimetype?.toLowerCase();
  if (!extensionMime || !declaredMime) {
    return null;
  }

  if (declaredMime === extensionMime) {
    return extensionMime;
  }
  if (
    extension === ".webm" &&
    (declaredMime === "video/webm" || declaredMime === "audio/webm")
  ) {
    return declaredMime;
  }
  if (extensionMime.startsWith("image/") && declaredMime.startsWith("image/")) {
    return extensionMime;
  }
  if (extensionMime.startsWith("audio/") && declaredMime.startsWith("audio/")) {
    return extensionMime;
  }
  if (extensionMime.startsWith("video/") && declaredMime.startsWith("video/")) {
    return extensionMime;
  }

  return null;
};

export const detectFileMimeType = (
  file: Pick<Express.Multer.File, "buffer" | "originalname" | "mimetype">
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
  if (startsWith(buffer, Buffer.from("BM", "ascii"))) {
    return "image/bmp";
  }
  if (
    startsWith(buffer, Buffer.from([0x49, 0x49, 0x2a, 0x00])) ||
    startsWith(buffer, Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))
  ) {
    return "image/tiff";
  }
  if (startsWith(buffer, Buffer.from([0x00, 0x00, 0x01, 0x00]))) {
    return "image/x-icon";
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

  const mp4FamilyMime = detectMp4FamilyMime(buffer, file.originalname);
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
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WAVE"
  ) {
    return "audio/wav";
  }

  if (startsWith(buffer, EBML_SIGNATURE)) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (extension === ".webm") {
      return file.mimetype?.toLowerCase() === "audio/webm"
        ? "audio/webm"
        : "video/webm";
    }
    return "video/x-matroska";
  }

  if (
    startsWith(buffer, ID3_SIGNATURE) ||
    (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  ) {
    return "audio/mpeg";
  }
  if (startsWith(buffer, FLAC_SIGNATURE)) {
    return "audio/flac";
  }
  if (startsWith(buffer, Buffer.from("OggS", "ascii"))) {
    const extension = path.extname(file.originalname).toLowerCase();
    return extension === ".opus" ? "audio/opus" : "audio/ogg";
  }
  if (buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0) {
    return "audio/aac";
  }
  if (startsWith(buffer, Buffer.from("#!AMR", "ascii"))) {
    return "audio/amr";
  }

  const zipOfficeMime = detectZipOfficeMime(buffer, file.originalname);
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
  if (path.extname(file.originalname).toLowerCase() === ".csv") {
    return "text/csv";
  }
  if (textPreview.startsWith("<svg")) {
    return "image/svg+xml";
  }
  if (looksLikePlainText(buffer)) {
    return "text/plain";
  }

  return detectDeclaredAllowedMime(file);
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
