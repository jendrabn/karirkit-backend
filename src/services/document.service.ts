import crypto from "crypto";
import { execFile } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import sharp from "sharp";
import type {
  Document as PrismaDocument,
  Prisma,
} from "../generated/prisma/client";
import type {
  Document as DocumentSchema,
  Pagination,
} from "../types/api-schemas";
import env from "../config/env.config";
import { prisma } from "../config/prisma.config";
import { validate } from "../utils/validate.util";
import {
  DocumentValidation,
  type DocumentListQuery,
  type DocumentUploadPayload,
  type MassDeleteInput,
} from "../validations/document.validation";
import { ResponseError } from "../utils/response-error.util";
import {
  VERIFIED_UPLOAD_MIME_TYPES,
  applyVerifiedMimeType,
} from "../utils/file-signature.util";
import {
  getPlan,
  resolvePlanId,
} from "../config/subscription-plans.config";
import { StorageService } from "./storage.service";

const DOCUMENT_DIRECTORY = "uploads/documents";

const COMPRESSION_QUALITY_MAP = {
  light: 85,
  medium: 70,
  strong: 55,
} as const;

const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
  "audio/aac": ".aac",
  "audio/flac": ".flac",
  "audio/m4a": ".m4a",
  "audio/mp4": ".m4a",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/opus": ".opus",
  "audio/wav": ".wav",
  "audio/webm": ".webm",
  "audio/x-m4a": ".m4a",
  "audio/x-wav": ".wav",
  "audio/amr": ".amr",
  "image/avif": ".avif",
  "image/bmp": ".bmp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "image/svg+xml": ".svg",
  "image/tiff": ".tiff",
  "image/x-icon": ".ico",
  "image/vnd.microsoft.icon": ".ico",
  "image/webp": ".webp",
  "video/3gpp": ".3gp",
  "video/mp4": ".mp4",
  "video/mpeg": ".mpeg",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "video/x-msvideo": ".avi",
  "video/x-matroska": ".mkv",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.ms-word.document.macroenabled.12": ".docm",
  "application/vnd.ms-word.template.macroenabled.12": ".dotm",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template":
    ".dotx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.ms-excel.sheet.binary.macroenabled.12": ".xlsb",
  "application/vnd.ms-excel.sheet.macroenabled.12": ".xlsm",
  "application/vnd.ms-excel.template.macroenabled.12": ".xltm",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template":
    ".xltx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.ms-powerpoint.addin.macroenabled.12": ".ppam",
  "application/vnd.ms-powerpoint.presentation.macroenabled.12": ".pptm",
  "application/vnd.ms-powerpoint.slideshow.macroenabled.12": ".ppsm",
  "application/vnd.ms-powerpoint.template.macroenabled.12": ".potm",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow":
    ".ppsx",
  "application/vnd.openxmlformats-officedocument.presentationml.template":
    ".potx",
  "application/vnd.ms-access": ".accdb",
  "application/vnd.ms-publisher": ".pub",
  "application/vnd.ms-visio.drawing": ".vsd",
  "application/vnd.openxmlformats-officedocument.drawingml.diagramData+xml":
    ".vsdx",
  "application/onenote": ".one",
  "text/csv": ".csv",
  "text/plain": ".txt",
  "application/rtf": ".rtf",
};

const IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
]);

const VIDEO_MIME_TYPES = new Set(VERIFIED_UPLOAD_MIME_TYPES.video);
const AUDIO_MIME_TYPES = new Set(VERIFIED_UPLOAD_MIME_TYPES.audio);

const DOCUMENT_TYPES = new Set([
  "ktp",
  "kk",
  "sim",
  "paspor",
  "npwp",
  "bpjs_kesehatan",
  "bpjs_ketenagakerjaan",
  "ijazah",
  "transkrip",
  "kartu_pelajar",
  "kartu_mahasiswa",
  "pas_foto",
  "cv",
  "surat_lamaran",
  "portfolio",
  "cover_letter",
  "skck",
  "surat_keterangan_sehat",
  "surat_keterangan_kerja",
  "surat_pengalaman_kerja",
  "surat_rekomendasi",
  "paklaring",
  "surat_pengunduran_diri",
  "kontrak_kerja",
  "slip_gaji",
  "kartu_nama",
  "sertifikat",
  "sertifikat_pelatihan",
  "sertifikat_bahasa",
  "sertifikat_profesi",
  "sertifikat_vaksin",
  "surat_bebas_narkoba",
  "surat_domisili",
  "surat_keterangan_catatan_akademik",
  "surat_keterangan_lulus",
  "kartu_keluarga_sejahtera",
  "hasil_medical_checkup",
  "hasil_tes_psikologi",
  "hasil_tes_narkoba",
  "demo_reel",
  "karya_tulis",
  "publikasi",
  "piagam",
  "lainnya",
]);

const DEFAULT_PDF_PRESET = {
  settings: env.ghostscriptPdfSettings,
  resolution: env.ghostscriptColorResolution,
  jpegQuality: env.ghostscriptJpegQuality,
};

const PDF_COMPRESSION_PRESETS: Record<
  DocumentCompressionLevel,
  { settings: string; resolution: number; jpegQuality: number }
> = {
  light: { settings: "/printer", resolution: 150, jpegQuality: 80 },
  medium: { settings: "/ebook", resolution: 120, jpegQuality: 60 },
  strong: { settings: "/screen", resolution: 72, jpegQuality: 40 },
};

export type DocumentCompressionLevel = keyof typeof COMPRESSION_QUALITY_MAP;

const VIDEO_COMPRESSION_PRESETS: Record<
  DocumentCompressionLevel,
  { crf: number; maxHeight: number; audioBitrate: string }
> = {
  light: { crf: 26, maxHeight: 1080, audioBitrate: "160k" },
  medium: { crf: 30, maxHeight: 720, audioBitrate: "128k" },
  strong: { crf: 34, maxHeight: 480, audioBitrate: "96k" },
};

const AUDIO_COMPRESSION_PRESETS: Record<
  DocumentCompressionLevel,
  { audioBitrate: string }
> = {
  light: { audioBitrate: "160k" },
  medium: { audioBitrate: "128k" },
  strong: { audioBitrate: "96k" },
};

type UploadOptions = {
  quality?: number;
  maxSize?: number;
  compressImage?: boolean;
  compressPdf?: boolean;
  compression?: DocumentCompressionLevel;
  ghostscriptSettings?: string;
  ghostscriptColorResolution?: number;
  ghostscriptJpegQuality?: number;
};

type UploadResult = {
  path: string;
  original_name: string;
  size: number;
  mime_type: string;
};

type DocumentListResult = {
  items: DocumentSchema[];
  pagination: Pagination;
};

type DocumentDownloadResult = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

export type DocumentStorageStats = {
  limit: number;
  used: number;
  remaining: number;
};

type DocumentFindManyWhere = NonNullable<
  Parameters<typeof prisma.document.findMany>[0]
>["where"];

type DocumentFindManyOrderBy = NonNullable<
  Parameters<typeof prisma.document.findMany>[0]
>["orderBy"];

const execFileAsync = promisify(execFile);

export class DocumentService {
  static async getStorageStats(userId: string): Promise<DocumentStorageStats> {
    const [user, usage] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true },
      }),
      prisma.document.aggregate({
        where: { userId },
        _sum: { size: true },
      }),
    ]);

    if (!user) {
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }

    const used = usage._sum.size ?? 0;
    const limit = getPlan(
      resolvePlanId(user.subscriptionPlan)
    ).maxDocumentStorageBytes;
    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
    };
  }
  static async list(
    userId: string,
    query: unknown
  ): Promise<DocumentListResult> {
    const filters: DocumentListQuery = validate(
      DocumentValidation.LIST_QUERY,
      query
    );

    const where: DocumentFindManyWhere = {
      userId,
    };

    if (filters.type?.length) {
      where.type = { in: filters.type };
    }

    if (filters.mime_type?.length) {
      where.mimeType = { in: filters.mime_type };
    }

    if (filters.size_from !== undefined || filters.size_to !== undefined) {
      where.size = {};
      if (filters.size_from !== undefined) {
        where.size.gte = filters.size_from;
      }
      if (filters.size_to !== undefined) {
        where.size.lte = filters.size_to;
      }
    }

    if (filters.created_at_from || filters.created_at_to) {
      where.createdAt = {};
      if (filters.created_at_from) {
        where.createdAt.gte = new Date(
          `${filters.created_at_from}T00:00:00.000Z`
        );
      }
      if (filters.created_at_to) {
        where.createdAt.lte = new Date(
          `${filters.created_at_to}T23:59:59.999Z`
        );
      }
    }

    if (filters.q) {
      const search = filters.q;
      const searchConditions: DocumentFindManyWhere[] = [
        { originalName: { contains: search } },
        { mimeType: { contains: search } },
      ];
      if (DOCUMENT_TYPES.has(search)) {
        searchConditions.push({ type: search as PrismaDocument["type"] });
      }
      (where as { OR?: DocumentFindManyWhere[] }).OR = searchConditions;
    }

    const sortFieldMap: Record<
      DocumentListQuery["sort_by"],
      "createdAt" | "updatedAt" | "originalName" | "size" | "type"
    > = {
      created_at: "createdAt",
      updated_at: "updatedAt",
      original_name: "originalName",
      size: "size",
      type: "type",
    };
    const orderBy: DocumentFindManyOrderBy = {
      [sortFieldMap[filters.sort_by] ?? "createdAt"]: filters.sort_order,
    };

    const [totalItems, records] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        orderBy,
        skip: (filters.page - 1) * filters.per_page,
        take: filters.per_page,
      }),
    ]);

    const totalPages =
      totalItems === 0
        ? 0
        : Math.ceil(totalItems / Math.max(filters.per_page, 1));

    return {
      items: records.map(DocumentService.toResponse),
      pagination: {
        page: filters.page,
        per_page: filters.per_page,
        total_items: totalItems,
        total_pages: totalPages,
      },
    };
  }

  static async create(
    userId: string,
    request: unknown,
    file: Express.Multer.File,
    compression?: DocumentCompressionLevel
  ): Promise<DocumentSchema> {
    if (!file) {
      throw new ResponseError(400, "File diperlukan");
    }

    const payload = DocumentService.validateUploadPayload(request);
    const uploadResult = await DocumentService.handleSingleFile(
      userId,
      file,
      compression
    );

    try {
      return await DocumentService.persistDocument(
        userId,
        payload,
        uploadResult,
        payload.name
      );
    } catch (error) {
      await DocumentService.removeFile(uploadResult.path);
      throw error;
    }
  }

  static async createMany(
    userId: string,
    request: unknown,
    files: Express.Multer.File[],
    compression?: DocumentCompressionLevel
  ): Promise<DocumentSchema[]> {
    if (!files || files.length === 0) {
      throw new ResponseError(400, "Minimal satu file diperlukan");
    }

    const payload = DocumentService.validateUploadPayload(request);
    const documents: DocumentSchema[] = [];
    try {
      for (const file of files) {
        const uploadResult = await DocumentService.handleSingleFile(
          userId,
          file,
          compression
        );

        try {
          documents.push(
            await DocumentService.persistDocument(
              userId,
              payload,
              uploadResult,
              payload.name
            )
          );
        } catch (error) {
          await DocumentService.removeFile(uploadResult.path);
          throw error;
        }
      }

      return documents;
    } catch (error) {
      if (documents.length) {
        const documentIds = documents
          .map((document) => document.id)
          .filter((id): id is string => Boolean(id));
        const documentPaths = documents
          .map((document) => document.path)
          .filter((filePath): filePath is string => Boolean(filePath));

        await prisma.document.deleteMany({
          where: {
            id: { in: documentIds },
            userId,
          },
        });
        await Promise.all(
          documentPaths.map((filePath) => DocumentService.removeFile(filePath))
        );
      }
      throw error;
    }
  }

  static async delete(userId: string, id: string): Promise<void> {
    const document = await DocumentService.findOwnedDocument(userId, id);
    await prisma.document.delete({ where: { id } });
    await DocumentService.removeFile(document.path);
  }

  static async massDelete(
    userId: string,
    request: unknown
  ): Promise<{ message: string; deleted_count: number }> {
    const payload: MassDeleteInput = validate(
      DocumentValidation.MASS_DELETE,
      request
    );

    const documents = await prisma.document.findMany({
      where: { id: { in: payload.ids }, userId },
      select: { id: true, path: true },
    });

    if (documents.length !== payload.ids.length) {
      throw new ResponseError(
        404,
        "Beberapa dokumen tidak ditemukan atau bukan milik Anda"
      );
    }

    const result = await prisma.document.deleteMany({
      where: { id: { in: payload.ids }, userId },
    });

    await Promise.all(
      documents.map((doc: { path: string }) => DocumentService.removeFile(doc.path))
    );

    return {
      message: `${result.count} dokumen berhasil dihapus`,
      deleted_count: result.count,
    };
  }

  static async download(
    userId: string,
    id: string
  ): Promise<DocumentDownloadResult> {
    const document = await DocumentService.findOwnedDocument(userId, id);
    if (!document.path) {
      throw new ResponseError(404, "Dokumen tidak tersedia");
    }

    let buffer: Buffer;
    try {
      const stored = await StorageService.read(document.path);
      buffer = stored.buffer;
    } catch (error) {
      throw new ResponseError(404, "File dokumen tidak ditemukan di server");
    }

    return {
      buffer,
      mimeType: document.mimeType,
      fileName: document.originalName,
    };
  }

  /* ---------- Private helpers ---------- */
  private static validateUploadPayload(
    request: unknown
  ): DocumentUploadPayload {
    return validate(DocumentValidation.UPLOAD, request);
  }

  private static async assertStorageLimit(
    userId: string,
    additionalBytes: number
  ): Promise<void> {
    if (additionalBytes <= 0) {
      return;
    }

    const [user, usage] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true },
      }),
      prisma.document.aggregate({
        where: { userId },
        _sum: { size: true },
      }),
    ]);

    if (!user) {
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }

    const limit = getPlan(
      resolvePlanId(user.subscriptionPlan)
    ).maxDocumentStorageBytes;

    const currentUsage = usage._sum.size ?? 0;
    if (currentUsage + additionalBytes > limit) {
      const limitMb = Math.max(
        1,
        Math.floor(limit / (1024 * 1024))
      );
      throw new ResponseError(
        400,
        `Batas penyimpanan dokumen tercapai. Kuota Anda ${limitMb} MB.`
      );
    }
  }

  private static buildUploadOptions(
    mimetype: string,
    compression?: DocumentCompressionLevel
  ): UploadOptions {
    const pdfPreset = DocumentService.resolvePdfPreset(compression);

    const options: UploadOptions = {
      maxSize: env.documentUploadMaxSizeBytes,
      compression,
      compressImage: compression !== undefined,
      compressPdf: compression !== undefined,
      ghostscriptSettings: pdfPreset.settings,
      ghostscriptColorResolution: pdfPreset.resolution,
      ghostscriptJpegQuality: pdfPreset.jpegQuality,
    };

    if (DocumentService.isImageMimeType(mimetype) && compression) {
      options.quality = COMPRESSION_QUALITY_MAP[compression];
    }

    return options;
  }

  private static resolvePdfPreset(compression?: DocumentCompressionLevel): {
    settings: string;
    resolution: number;
    jpegQuality: number;
  } {
    if (!compression) {
      return DEFAULT_PDF_PRESET;
    }
    return PDF_COMPRESSION_PRESETS[compression];
  }

  private static async handleSingleFile(
    userId: string,
    file: Express.Multer.File,
    compression?: DocumentCompressionLevel
  ): Promise<UploadResult> {
    const uploadOptions = DocumentService.buildUploadOptions(
      file.mimetype,
      compression
    );
    return DocumentService.processAndStoreFile(userId, file, uploadOptions);
  }

  private static async processAndStoreFile(
    userId: string,
    file: Express.Multer.File,
    options: UploadOptions
  ): Promise<UploadResult> {
    const maxSize = options.maxSize ?? env.documentUploadMaxSizeBytes;
    if (file.size > maxSize) {
      throw new ResponseError(
        400,
        `Ukuran file tidak boleh lebih dari ${Math.floor(
          maxSize / (1024 * 1024)
        )}MB`
      );
    }

    const detectedMimeType = applyVerifiedMimeType(file);
    if (
      !detectedMimeType ||
      ![
        ...VERIFIED_UPLOAD_MIME_TYPES.image,
        ...VERIFIED_UPLOAD_MIME_TYPES.document,
        ...VERIFIED_UPLOAD_MIME_TYPES.video,
        ...VERIFIED_UPLOAD_MIME_TYPES.audio,
      ].includes(detectedMimeType as any)
    ) {
      throw new ResponseError(400, "Jenis file dokumen tidak valid");
    }

    const normalizedMime = detectedMimeType.toLowerCase();
    let processedBuffer = file.buffer;
    let finalMimeType = detectedMimeType;
    let extension =
      MIME_TYPE_TO_EXTENSION[normalizedMime] || path.extname(file.originalname);

    const shouldCompressImage =
      options.compressImage !== false && IMAGE_MIME_TYPES.has(normalizedMime);

    if (shouldCompressImage) {
      processedBuffer = await DocumentService.maybeCompressImage(
        processedBuffer,
        normalizedMime,
        options.quality
      );
    }

    const isPdf = normalizedMime === "application/pdf";
    if (isPdf && options.compressPdf) {
      processedBuffer = await DocumentService.maybeCompressPdf(
        processedBuffer,
        options
      );
      finalMimeType = "application/pdf";
      extension = ".pdf";
    }

    if (options.compression && VIDEO_MIME_TYPES.has(normalizedMime as any)) {
      const compressedVideo = await DocumentService.maybeCompressVideo(
        processedBuffer,
        options.compression
      );
      if (compressedVideo.compressed) {
        processedBuffer = compressedVideo.buffer;
        finalMimeType = "video/mp4";
        extension = ".mp4";
      }
    }

    if (options.compression && AUDIO_MIME_TYPES.has(normalizedMime as any)) {
      const compressedAudio = await DocumentService.maybeCompressAudio(
        processedBuffer,
        options.compression
      );
      if (compressedAudio.compressed) {
        processedBuffer = compressedAudio.buffer;
        finalMimeType = "audio/mp4";
        extension = ".m4a";
      }
    }

    await DocumentService.assertStorageLimit(userId, processedBuffer.length);

    const filename = DocumentService.buildFilename(extension);
    const publicPath = path.posix.join("/", DOCUMENT_DIRECTORY, filename);
    await StorageService.write(publicPath, processedBuffer, finalMimeType);

    return {
      path: publicPath,
      original_name: file.originalname,
      size: processedBuffer.length,
      mime_type: finalMimeType,
    };
  }

  private static async maybeCompressImage(
    buffer: Buffer,
    mimetype: string,
    quality?: number
  ): Promise<Buffer> {
    try {
      const clamped = quality ?? 80;
      if (mimetype === "image/jpeg" || mimetype === "image/jpg") {
        return sharp(buffer).jpeg({ quality: clamped }).toBuffer();
      }
      if (mimetype === "image/png") {
        const pngQuality = Math.min(100, Math.max(1, clamped));
        return sharp(buffer).png({ quality: pngQuality }).toBuffer();
      }
      if (mimetype === "image/webp") {
        return sharp(buffer).webp({ quality: clamped }).toBuffer();
      }
      if (mimetype === "image/avif") {
        return sharp(buffer).avif({ quality: clamped }).toBuffer();
      }
      if (mimetype === "image/tiff") {
        return sharp(buffer).tiff({ quality: clamped }).toBuffer();
      }
    } catch (error) {
      console.error("Error processing image:", error);
    }
    return buffer;
  }

  private static async maybeCompressPdf(
    buffer: Buffer,
    options: UploadOptions
  ): Promise<Buffer> {
    try {
      return await DocumentService.compressPdfBufferWithGhostscript(
        buffer,
        options.ghostscriptSettings ?? env.ghostscriptPdfSettings,
        options.ghostscriptColorResolution ?? env.ghostscriptColorResolution,
        options.ghostscriptJpegQuality ?? env.ghostscriptJpegQuality
      );
    } catch (error) {
      console.error("Error compressing PDF:", error);
      return buffer;
    }
  }

  private static async maybeCompressVideo(
    buffer: Buffer,
    compression: DocumentCompressionLevel
  ): Promise<{ buffer: Buffer; compressed: boolean }> {
    const uuid = crypto.randomUUID();
    const inputPath = path.join(os.tmpdir(), `video-input-${uuid}`);
    const outputPath = path.join(os.tmpdir(), `video-output-${uuid}.mp4`);
    const preset = VIDEO_COMPRESSION_PRESETS[compression];

    await fs.writeFile(inputPath, buffer);
    try {
      const args = [
        "-y",
        "-i",
        inputPath,
        "-vf",
        `scale='min(iw,${Math.round((preset.maxHeight * 16) / 9)})':` +
          `'min(ih,${preset.maxHeight})':force_original_aspect_ratio=decrease`,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        String(preset.crf),
        "-c:a",
        "aac",
        "-b:a",
        preset.audioBitrate,
        "-movflags",
        "+faststart",
        outputPath,
      ];
      await execFileAsync(env.ffmpegCommand, args, { timeout: 180_000 });
      return {
        buffer: await fs.readFile(outputPath),
        compressed: true,
      };
    } catch (error) {
      console.error("Error compressing video:", error);
      return { buffer, compressed: false };
    } finally {
      await DocumentService.cleanupTempFiles([inputPath, outputPath]);
    }
  }

  private static async maybeCompressAudio(
    buffer: Buffer,
    compression: DocumentCompressionLevel
  ): Promise<{ buffer: Buffer; compressed: boolean }> {
    const uuid = crypto.randomUUID();
    const inputPath = path.join(os.tmpdir(), `audio-input-${uuid}`);
    const outputPath = path.join(os.tmpdir(), `audio-output-${uuid}.m4a`);
    const preset = AUDIO_COMPRESSION_PRESETS[compression];

    await fs.writeFile(inputPath, buffer);
    try {
      const args = [
        "-y",
        "-i",
        inputPath,
        "-vn",
        "-c:a",
        "aac",
        "-b:a",
        preset.audioBitrate,
        outputPath,
      ];
      await execFileAsync(env.ffmpegCommand, args, { timeout: 120_000 });
      return {
        buffer: await fs.readFile(outputPath),
        compressed: true,
      };
    } catch (error) {
      console.error("Error compressing audio:", error);
      return { buffer, compressed: false };
    } finally {
      await DocumentService.cleanupTempFiles([inputPath, outputPath]);
    }
  }

  private static buildFilename(extension: string): string {
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    return `${timestamp}-${uuid}${extension}`;
  }

  private static async compressPdfBufferWithGhostscript(
    buffer: Buffer,
    settings: string,
    colorResolution: number,
    jpegQuality?: number
  ): Promise<Buffer> {
    const uuid = crypto.randomUUID();
    const inputPath = path.join(os.tmpdir(), `pdf-input-${uuid}.pdf`);
    const outputPath = path.join(os.tmpdir(), `pdf-output-${uuid}.pdf`);

    await fs.writeFile(inputPath, buffer);

    const args = [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-dPDFSETTINGS=${settings}`,
      "-dNOPAUSE",
      "-dBATCH",
      `-dColorImageResolution=${colorResolution}`,
      `-dGrayImageResolution=${colorResolution}`,
      `-dMonoImageResolution=${colorResolution}`,
      "-dDownsampleColorImages=true",
      "-dDownsampleGrayImages=true",
      "-dDownsampleMonoImages=true",
      "-dAutoFilterColorImages=false",
      "-dAutoFilterGrayImages=false",
      "-dColorImageFilter=/DCTEncode",
      "-dGrayImageFilter=/DCTEncode",
      ...(jpegQuality ? [`-dJPEGQ=${jpegQuality}`] : []),
      `-sOutputFile=${outputPath}`,
      inputPath,
    ];

    try {
      await execFileAsync(env.ghostscriptCommand, args, { timeout: 120_000 });
      return await fs.readFile(outputPath);
    } finally {
      await DocumentService.cleanupTempFiles([inputPath, outputPath]);
    }
  }

  private static async cleanupTempFiles(paths: string[]): Promise<void> {
    await Promise.all(
      paths.map((tmpPath) =>
        fs.rm(tmpPath, { force: true }).catch(() => {
          // ignore cleanup errors
        })
      )
    );
  }

  private static toResponse(document: PrismaDocument): DocumentSchema {
    return {
      id: document.id,
      user_id: document.userId,
      type: document.type,
      original_name: document.originalName,
      path: document.path,
      mime_type: document.mimeType,
      size: document.size,
      created_at: document.createdAt?.toISOString(),
      updated_at: document.updatedAt?.toISOString(),
    };
  }

  private static async persistDocument(
    userId: string,
    payload: DocumentUploadPayload,
    upload: UploadResult,
    customName?: string | null
  ): Promise<DocumentSchema> {
    const now = new Date();
    const originalName =
      customName && customName.trim().length > 0
        ? customName.trim()
        : upload.original_name;

    const document = await prisma.document.create({
      data: {
        userId,
        type: payload.type,
        originalName,
        path: upload.path,
        mimeType: upload.mime_type,
        size: upload.size,
        createdAt: now,
        updatedAt: now,
      },
    });

    return DocumentService.toResponse(document);
  }

  private static async findOwnedDocument(
    userId: string,
    id: string
  ): Promise<PrismaDocument> {
    const document = await prisma.document.findFirst({
      where: { id, userId },
    });
    if (!document) {
      throw new ResponseError(404, "Dokumen tidak ditemukan");
    }
    return document;
  }

  private static isImageMimeType(mimetype: string): boolean {
    return mimetype.toLowerCase().startsWith("image/");
  }

  private static async removeFile(publicPath: string): Promise<void> {
    if (!publicPath) return;
    try {
      await StorageService.delete(publicPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn("Failed to delete document file:", error);
      }
    }
  }
}
