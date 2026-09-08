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
  MIME_TYPE_TO_EXTENSION,
  applyVerifiedMimeType,
  getFileCategory,
  isMimeTypeAllowed,
} from "../utils/file-signature.util";
import { getPlan, resolvePlanId } from "../config/subscription-plans.config";
import { StorageService } from "./storage.service";

const DOCUMENT_DIRECTORY = "uploads/documents";

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

/**
 * Single source of truth for compression behaviour per level.
 * Compression is opt-in via `?compression=` and only ever applies to
 * images, videos, audio, and PDFs - any other document type (docx,
 * xlsx, pptx, doc, xls, ppt) simply ignores the query param.
 */
const COMPRESSION_PRESETS = {
  light: {
    image: { quality: 82, maxDimension: 2560 },
    video: { crf: 23, maxHeight: 1080, audioBitrate: "160k" },
    audio: { bitrate: "160k" },
    pdf: { settings: "/printer", resolution: 150, jpegQuality: 80 },
  },
  medium: {
    image: { quality: 68, maxDimension: 1920 },
    video: { crf: 28, maxHeight: 720, audioBitrate: "128k" },
    audio: { bitrate: "128k" },
    pdf: { settings: "/ebook", resolution: 120, jpegQuality: 60 },
  },
  strong: {
    image: { quality: 50, maxDimension: 1280 },
    video: { crf: 32, maxHeight: 480, audioBitrate: "96k" },
    audio: { bitrate: "96k" },
    pdf: { settings: "/screen", resolution: 72, jpegQuality: 40 },
  },
} as const;

export type DocumentCompressionLevel = keyof typeof COMPRESSION_PRESETS;

/** Runtime list derived from the presets above - controller uses this instead of hardcoding its own copy. */
export const DOCUMENT_COMPRESSION_LEVELS = Object.keys(
  COMPRESSION_PRESETS,
) as DocumentCompressionLevel[];

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
      resolvePlanId(user.subscriptionPlan),
    ).maxDocumentStorageBytes;
    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
    };
  }

  static async list(
    userId: string,
    query: unknown,
  ): Promise<DocumentListResult> {
    const filters: DocumentListQuery = validate(
      DocumentValidation.LIST_QUERY,
      query,
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
          `${filters.created_at_from}T00:00:00.000Z`,
        );
      }
      if (filters.created_at_to) {
        where.createdAt.lte = new Date(
          `${filters.created_at_to}T23:59:59.999Z`,
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
    compression?: DocumentCompressionLevel,
  ): Promise<DocumentSchema> {
    if (!file) {
      throw new ResponseError(400, "File diperlukan");
    }

    const payload = DocumentService.validateUploadPayload(request);
    const uploadResult = await DocumentService.processAndStoreFile(
      file,
      compression,
    );

    try {
      return await DocumentService.persistDocument(
        userId,
        payload,
        uploadResult,
        payload.name,
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
    compression?: DocumentCompressionLevel,
  ): Promise<DocumentSchema[]> {
    if (!files || files.length === 0) {
      throw new ResponseError(400, "Minimal satu file diperlukan");
    }

    const payload = DocumentService.validateUploadPayload(request);
    const documents: DocumentSchema[] = [];
    try {
      for (const file of files) {
        const uploadResult = await DocumentService.processAndStoreFile(
          file,
          compression,
        );

        try {
          documents.push(
            await DocumentService.persistDocument(
              userId,
              payload,
              uploadResult,
              payload.name,
            ),
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
          documentPaths.map((filePath) => DocumentService.removeFile(filePath)),
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
    request: unknown,
  ): Promise<{ message: string; deleted_count: number }> {
    const payload: MassDeleteInput = validate(
      DocumentValidation.MASS_DELETE,
      request,
    );

    const documents = await prisma.document.findMany({
      where: { id: { in: payload.ids }, userId },
      select: { id: true, path: true },
    });

    if (documents.length !== payload.ids.length) {
      throw new ResponseError(
        404,
        "Beberapa dokumen tidak ditemukan atau bukan milik Anda",
      );
    }

    const result = await prisma.document.deleteMany({
      where: { id: { in: payload.ids }, userId },
    });

    await Promise.all(
      documents.map((doc: { path: string }) =>
        DocumentService.removeFile(doc.path),
      ),
    );

    return {
      message: `${result.count} dokumen berhasil dihapus`,
      deleted_count: result.count,
    };
  }

  static async download(
    userId: string,
    id: string,
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

  /* ---------- Upload pipeline ---------- */

  private static validateUploadPayload(
    request: unknown,
  ): DocumentUploadPayload {
    return validate(DocumentValidation.UPLOAD, request);
  }

  /**
   * Validates, (optionally) compresses, and stores a single uploaded file.
   * Compression only ever runs for images, video, audio, and PDFs (see
   * COMPRESSION_PRESETS) - any other document type quietly ignores the
   * `compression` query param, as intended.
   */
  private static async processAndStoreFile(
    file: Express.Multer.File,
    compression?: DocumentCompressionLevel,
  ): Promise<UploadResult> {
    if (file.size > env.documentUploadMaxSizeBytes) {
      throw new ResponseError(
        400,
        `Ukuran file tidak boleh lebih dari ${Math.floor(
          env.documentUploadMaxSizeBytes / (1024 * 1024),
        )}MB`,
      );
    }

    const detectedMimeType = applyVerifiedMimeType(file);
    if (!detectedMimeType || !isMimeTypeAllowed(detectedMimeType)) {
      throw new ResponseError(400, "Jenis file dokumen tidak valid");
    }

    let buffer = file.buffer;
    let mimeType = detectedMimeType;

    if (compression) {
      const preset = COMPRESSION_PRESETS[compression];
      const category = getFileCategory(mimeType);

      if (category === "image") {
        buffer = await DocumentService.compressImage(
          buffer,
          mimeType,
          preset.image,
        );
      } else if (mimeType === "application/pdf") {
        buffer = await DocumentService.compressPdf(buffer, preset.pdf);
      } else if (category === "video") {
        const result = await DocumentService.compressVideo(
          buffer,
          preset.video,
        );
        if (result.compressed) {
          buffer = result.buffer;
          mimeType = "video/mp4";
        }
      } else if (category === "audio") {
        const result = await DocumentService.compressAudio(
          buffer,
          preset.audio,
        );
        if (result.compressed) {
          buffer = result.buffer;
          mimeType = "audio/mp4";
        }
      }
    }

    const extension =
      MIME_TYPE_TO_EXTENSION[mimeType] ?? path.extname(file.originalname);
    const filename = DocumentService.buildFilename(extension);
    const publicPath = path.posix.join("/", DOCUMENT_DIRECTORY, filename);
    await StorageService.write(publicPath, buffer, mimeType);

    return {
      path: publicPath,
      original_name: file.originalname,
      // Always the size actually written to disk, i.e. after compression.
      size: buffer.length,
      mime_type: mimeType,
    };
  }

  private static async compressImage(
    buffer: Buffer,
    mimeType: string,
    preset: { quality: number; maxDimension: number },
  ): Promise<Buffer> {
    try {
      const image = sharp(buffer)
        .rotate() // auto-orient from EXIF, then strip metadata on output
        .resize({
          width: preset.maxDimension,
          height: preset.maxDimension,
          fit: "inside",
          withoutEnlargement: true,
        });

      if (mimeType === "image/png") {
        return await image
          .png({ quality: preset.quality, compressionLevel: 9, palette: true })
          .toBuffer();
      }
      if (mimeType === "image/webp") {
        return await image.webp({ quality: preset.quality }).toBuffer();
      }
      return await image
        .jpeg({ quality: preset.quality, mozjpeg: true })
        .toBuffer();
    } catch (error) {
      console.error("Gagal mengompres gambar:", error);
      return buffer;
    }
  }

  private static async compressPdf(
    buffer: Buffer,
    preset: { settings: string; resolution: number; jpegQuality: number },
  ): Promise<Buffer> {
    const uuid = crypto.randomUUID();
    const inputPath = path.join(os.tmpdir(), `pdf-${uuid}-in.pdf`);
    const outputPath = path.join(os.tmpdir(), `pdf-${uuid}-out.pdf`);
    await fs.writeFile(inputPath, buffer);

    try {
      await execFileAsync(
        env.ghostscriptCommand,
        [
          "-sDEVICE=pdfwrite",
          "-dCompatibilityLevel=1.4",
          `-dPDFSETTINGS=${preset.settings}`,
          "-dNOPAUSE",
          "-dBATCH",
          "-dQUIET",
          `-dColorImageResolution=${preset.resolution}`,
          `-dGrayImageResolution=${preset.resolution}`,
          `-dMonoImageResolution=${preset.resolution}`,
          "-dDownsampleColorImages=true",
          "-dDownsampleGrayImages=true",
          "-dDownsampleMonoImages=true",
          "-dAutoFilterColorImages=false",
          "-dAutoFilterGrayImages=false",
          "-dColorImageFilter=/DCTEncode",
          "-dGrayImageFilter=/DCTEncode",
          `-dJPEGQ=${preset.jpegQuality}`,
          `-sOutputFile=${outputPath}`,
          inputPath,
        ],
        { timeout: 120_000 },
      );

      const compressed = await fs.readFile(outputPath);
      // Ghostscript occasionally bloats an already-optimized PDF; never regress.
      return compressed.length < buffer.length ? compressed : buffer;
    } catch (error) {
      console.error("Gagal mengompres PDF:", error);
      return buffer;
    } finally {
      await DocumentService.cleanupTempFiles([inputPath, outputPath]);
    }
  }

  private static async compressVideo(
    buffer: Buffer,
    preset: { crf: number; maxHeight: number; audioBitrate: string },
  ): Promise<{ buffer: Buffer; compressed: boolean }> {
    const uuid = crypto.randomUUID();
    const inputPath = path.join(os.tmpdir(), `video-${uuid}-in`);
    const outputPath = path.join(os.tmpdir(), `video-${uuid}-out.mp4`);

    await fs.writeFile(inputPath, buffer);
    try {
      await execFileAsync(
        env.ffmpegCommand,
        [
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
          "-map_metadata",
          "-1",
          "-threads",
          "0",
          "-movflags",
          "+faststart",
          outputPath,
        ],
        { timeout: 180_000 },
      );
      return { buffer: await fs.readFile(outputPath), compressed: true };
    } catch (error) {
      console.error("Gagal mengompres video:", error);
      return { buffer, compressed: false };
    } finally {
      await DocumentService.cleanupTempFiles([inputPath, outputPath]);
    }
  }

  private static async compressAudio(
    buffer: Buffer,
    preset: { bitrate: string },
  ): Promise<{ buffer: Buffer; compressed: boolean }> {
    const uuid = crypto.randomUUID();
    const inputPath = path.join(os.tmpdir(), `audio-${uuid}-in`);
    const outputPath = path.join(os.tmpdir(), `audio-${uuid}-out.m4a`);

    await fs.writeFile(inputPath, buffer);
    try {
      await execFileAsync(
        env.ffmpegCommand,
        [
          "-y",
          "-i",
          inputPath,
          "-vn",
          "-c:a",
          "aac",
          "-b:a",
          preset.bitrate,
          "-map_metadata",
          "-1",
          "-threads",
          "0",
          outputPath,
        ],
        { timeout: 120_000 },
      );
      return { buffer: await fs.readFile(outputPath), compressed: true };
    } catch (error) {
      console.error("Gagal mengompres audio:", error);
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

  private static async cleanupTempFiles(paths: string[]): Promise<void> {
    await Promise.all(
      paths.map((tmpPath) =>
        fs.rm(tmpPath, { force: true }).catch(() => {
          // ignore cleanup errors
        }),
      ),
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
    customName?: string | null,
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
    id: string,
  ): Promise<PrismaDocument> {
    const document = await prisma.document.findFirst({
      where: { id, userId },
    });
    if (!document) {
      throw new ResponseError(404, "Dokumen tidak ditemukan");
    }
    return document;
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
