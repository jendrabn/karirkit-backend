import crypto from "crypto";
import { execFile } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import type {
  Document as PrismaDocument,
  Prisma,
} from "../generated/prisma/client";
import { DocumentType } from "../generated/prisma/client";
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

type PdfDoc = InstanceType<typeof PDFDocument>;

const DOCUMENT_DIRECTORY = "uploads/documents";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const COMPRESSION_QUALITY_MAP = {
  auto: 70,
  light: 85,
  medium: 60,
  strong: 40,
} as const;

const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "text/plain": ".txt",
  "application/rtf": ".rtf",
};

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
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
  auto: {
    settings: env.ghostscriptPdfSettings,
    resolution: env.ghostscriptColorResolution,
    jpegQuality: env.ghostscriptJpegQuality,
  },
  light: { settings: "/printer", resolution: 150, jpegQuality: 80 },
  medium: { settings: "/ebook", resolution: 120, jpegQuality: 60 },
  strong: { settings: "/screen", resolution: 72, jpegQuality: 40 },
};

export type DocumentCompressionLevel = keyof typeof COMPRESSION_QUALITY_MAP;

type UploadOptions = {
  quality?: number;
  maxSize?: number;
  compressImage?: boolean;
  compressPdf?: boolean;
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

const execFileAsync = promisify(execFile);

export class DocumentService {
  static async getStorageStats(userId: string): Promise<DocumentStorageStats> {
    const [user, usage] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { documentStorageLimit: true },
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
    const limit = user.documentStorageLimit;
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

    const where: Prisma.DocumentWhereInput = {
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
      const searchConditions: Prisma.DocumentWhereInput[] = [
        { originalName: { contains: search } },
        { mimeType: { contains: search } },
      ];
      if (Object.values(DocumentType).includes(search as DocumentType)) {
        searchConditions.push({ type: search as DocumentType });
      }
      where.OR = searchConditions;
    }

    const sortFieldMap: Record<
      DocumentListQuery["sort_by"],
      keyof Prisma.DocumentOrderByWithRelationInput
    > = {
      created_at: "createdAt",
      updated_at: "updatedAt",
      original_name: "originalName",
      size: "size",
      type: "type",
    };
    const orderBy: Prisma.DocumentOrderByWithRelationInput = {
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

    return DocumentService.persistDocument(
      userId,
      payload,
      uploadResult,
      payload.name
    );
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

    for (const file of files) {
      const uploadResult = await DocumentService.handleSingleFile(
        userId,
        file,
        compression
      );
      documents.push(
        await DocumentService.persistDocument(
          userId,
          payload,
          uploadResult,
          payload.name
        )
      );
    }

    return documents;
  }

  static async createMerged(
    userId: string,
    request: unknown,
    files: Express.Multer.File[],
    compression?: DocumentCompressionLevel
  ): Promise<DocumentSchema> {
    if (!files || files.length === 0) {
      throw new ResponseError(400, "Minimal satu file diperlukan");
    }

    const payload = DocumentService.validateUploadPayload(request);
    const uploadOptions = DocumentService.buildUploadOptions(
      "application/pdf",
      compression
    );
    if (compression) {
      uploadOptions.quality = COMPRESSION_QUALITY_MAP[compression];
    }

    const mergedBuffer = await DocumentService.mergeFilesIntoPdf(
      files,
      uploadOptions
    );
    const mergedName = DocumentService.resolveMergedName(payload.name);

    await DocumentService.assertStorageLimit(userId, mergedBuffer.length);

    const stored = await DocumentService.writeBufferToDisk(
      mergedBuffer,
      ".pdf"
    );

    return DocumentService.persistDocument(
      userId,
      payload,
      {
        path: stored.path,
        size: stored.size,
        mime_type: "application/pdf",
        original_name: mergedName,
      },
      mergedName
    );
  }

  static async delete(userId: string, id: string): Promise<void> {
    const document = await DocumentService.findOwnedDocument(userId, id);
    await DocumentService.removeFile(document.path);
    await prisma.document.delete({ where: { id } });
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

    await Promise.all(
      documents.map((doc) => DocumentService.removeFile(doc.path))
    );
    const result = await prisma.document.deleteMany({
      where: { id: { in: payload.ids }, userId },
    });

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

    const absolutePath = DocumentService.getAbsolutePath(document.path);
    let buffer: Buffer;
    try {
      buffer = await fs.readFile(absolutePath);
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
        select: { documentStorageLimit: true },
      }),
      prisma.document.aggregate({
        where: { userId },
        _sum: { size: true },
      }),
    ]);

    if (!user) {
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }

    const currentUsage = usage._sum.size ?? 0;
    if (currentUsage + additionalBytes > user.documentStorageLimit) {
      const limitMb = Math.max(
        1,
        Math.floor(user.documentStorageLimit / (1024 * 1024))
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
      maxSize: MAX_UPLOAD_BYTES,
      compressImage: compression !== undefined,
      compressPdf: env.pdfCompressionEnabled,
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
    return PDF_COMPRESSION_PRESETS[compression] ?? DEFAULT_PDF_PRESET;
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
    const maxSize = options.maxSize ?? MAX_UPLOAD_BYTES;
    if (file.size > maxSize) {
      throw new ResponseError(400, "Ukuran file tidak boleh lebih dari 25MB");
    }

    const normalizedMime = file.mimetype.toLowerCase();
    let processedBuffer = file.buffer;
    let finalMimeType = file.mimetype;
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

    await DocumentService.assertStorageLimit(userId, processedBuffer.length);

    const uploadDir = path.join(process.cwd(), "public", DOCUMENT_DIRECTORY);
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = DocumentService.buildFilename(extension);
    const filePath = path.join(uploadDir, filename);

    await fs.writeFile(filePath, processedBuffer);
    const publicPath = path.posix.join("/", DOCUMENT_DIRECTORY, filename);

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

  private static async mergeFilesIntoPdf(
    files: Express.Multer.File[],
    options: UploadOptions
  ): Promise<Buffer> {
    const maxSize = options.maxSize ?? MAX_UPLOAD_BYTES;
    const tempFiles: string[] = [];

    try {
      const pdfPaths: string[] = [];

      for (const file of files) {
        if (file.size > maxSize) {
          throw new ResponseError(
            400,
            "Ukuran file tidak boleh lebih dari 25MB"
          );
        }

        const mime = file.mimetype.toLowerCase();
        if (IMAGE_MIME_TYPES.has(mime)) {
          const pdfBuffer = await DocumentService.convertImageToPdf(
            file.buffer,
            options.quality
          );
          const pdfPath = await DocumentService.writeTempFile(
            "img-to-pdf",
            ".pdf",
            pdfBuffer
          );
          pdfPaths.push(pdfPath);
          tempFiles.push(pdfPath);
        } else if (mime === "application/pdf") {
          let pdfBuffer = file.buffer;
          if (options.compressPdf) {
            pdfBuffer = await DocumentService.maybeCompressPdf(
              pdfBuffer,
              options
            );
          }
          const pdfPath = await DocumentService.writeTempFile(
            "pdf-source",
            ".pdf",
            pdfBuffer
          );
          pdfPaths.push(pdfPath);
          tempFiles.push(pdfPath);
        } else {
          throw new ResponseError(
            400,
            "Merge hanya mendukung file gambar atau PDF"
          );
        }
      }

      const outputPath = path.join(
        os.tmpdir(),
        `merged-${crypto.randomUUID()}.pdf`
      );
      tempFiles.push(outputPath);

      const args = [
        "-dNOPAUSE",
        "-dBATCH",
        "-sDEVICE=pdfwrite",
        `-sOutputFile=${outputPath}`,
        ...(options.ghostscriptSettings
          ? [`-dPDFSETTINGS=${options.ghostscriptSettings}`]
          : []),
        ...(options.ghostscriptJpegQuality
          ? [`-dJPEGQ=${options.ghostscriptJpegQuality}`]
          : []),
        `-dColorImageResolution=${
          options.ghostscriptColorResolution ?? env.ghostscriptColorResolution
        }`,
        `-dGrayImageResolution=${
          options.ghostscriptColorResolution ?? env.ghostscriptColorResolution
        }`,
        `-dMonoImageResolution=${
          options.ghostscriptColorResolution ?? env.ghostscriptColorResolution
        }`,
        ...pdfPaths,
      ];

      await execFileAsync(env.ghostscriptCommand, args, { timeout: 120_000 });
      return await fs.readFile(outputPath);
    } finally {
      await DocumentService.cleanupTempFiles(tempFiles);
    }
  }

  private static async convertImageToPdf(
    buffer: Buffer,
    quality?: number
  ): Promise<Buffer> {
    try {
      const clampedQuality =
        quality !== undefined ? Math.min(100, Math.max(1, quality)) : 80;
      const image = sharp(buffer);
      const { width, height } = await image.metadata();
      const processedImage = await image
        .jpeg({ quality: clampedQuality })
        .toBuffer();

      const doc = new PDFDocument({ autoFirstPage: false });
      const pageWidth = width ?? 612; // default 8.5in
      const pageHeight = height ?? 792; // default 11in
      doc.addPage({ size: [pageWidth, pageHeight], margin: 0 });
      doc.image(processedImage, 0, 0, { width: pageWidth, height: pageHeight });
      doc.end();

      return await DocumentService.bufferFromPdf(doc);
    } catch (error) {
      console.error("Error converting image to PDF:", error);
      throw new ResponseError(400, "Gagal mengubah gambar menjadi PDF");
    }
  }

  private static bufferFromPdf(doc: PdfDoc): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
  }

  private static async writeTempFile(
    prefix: string,
    extension: string,
    buffer: Buffer
  ): Promise<string> {
    const filePath = path.join(
      os.tmpdir(),
      `${prefix}-${crypto.randomUUID()}${extension}`
    );
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  private static async writeBufferToDisk(
    buffer: Buffer,
    extension: string
  ): Promise<{ path: string; size: number }> {
    const uploadDir = path.join(process.cwd(), "public", DOCUMENT_DIRECTORY);
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = DocumentService.buildFilename(extension);
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    return {
      path: path.posix.join("/", DOCUMENT_DIRECTORY, filename),
      size: buffer.length,
    };
  }

  private static buildFilename(extension: string): string {
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    return `${timestamp}-${uuid}${extension}`;
  }

  private static resolveMergedName(name?: string | null): string {
    if (!name) {
      return "merged.pdf";
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return "merged.pdf";
    }
    return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
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

  private static getAbsolutePath(publicPath: string): string {
    const relativePath = publicPath.replace(/^\/+/, "");
    return path.join(process.cwd(), "public", relativePath);
  }

  private static async removeFile(publicPath: string): Promise<void> {
    if (!publicPath) return;
    const absolutePath = DocumentService.getAbsolutePath(publicPath);
    try {
      await fs.unlink(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn("Failed to delete document file:", error);
      }
    }
  }
}
