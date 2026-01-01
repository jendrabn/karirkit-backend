import fs from "fs/promises";
import path from "path";
import type {
  Document as PrismaDocument,
  Prisma,
} from "../generated/prisma/client";
import type { Document as DocumentSchema, Pagination } from "../types/api-schemas";
import { prisma } from "../config/prisma.config";
import { validate } from "../utils/validate.util";
import {
  DocumentValidation,
  type DocumentListQuery,
  type DocumentUploadPayload,
  type MassDeleteInput,
} from "../validations/document.validation";
import { ResponseError } from "../utils/response-error.util";
import { UploadService } from "./upload.service";

const DOCUMENT_DIRECTORY = "uploads/documents";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const COMPRESSION_QUALITY_MAP = {
  auto: 70,
  light: 85,
  medium: 60,
  strong: 40,
} as const;

export type DocumentCompressionLevel = keyof typeof COMPRESSION_QUALITY_MAP;

type DocumentListResult = {
  items: DocumentSchema[];
  pagination: Pagination;
};

type DocumentDownloadResult = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

export class DocumentService {
  static async list(userId: string, query: unknown): Promise<DocumentListResult> {
    const filters: DocumentListQuery = validate(
      DocumentValidation.LIST_QUERY,
      query
    );

    const where: Prisma.DocumentWhereInput = {
      userId,
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.q) {
      where.OR = [
        { originalName: { contains: filters.q } },
        { mimeType: { contains: filters.q } },
      ];
    }

    const page = filters.page;
    const perPage = filters.per_page;

    const sortFieldMap: Record<
      DocumentListQuery["sort_by"],
      keyof Prisma.DocumentOrderByWithRelationInput
    > = {
      uploaded_at: "createdAt",
      original_name: "originalName",
      size: "size",
      type: "type",
    };

    const sortField = sortFieldMap[filters.sort_by] ?? "createdAt";
    const orderBy: Prisma.DocumentOrderByWithRelationInput = {
      [sortField]: filters.sort_order,
    };

    const [totalItems, records] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / Math.max(perPage, 1));

    return {
      items: records.map(DocumentService.toResponse),
      pagination: {
        page,
        per_page: perPage,
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

    const payload: DocumentUploadPayload = validate(
      DocumentValidation.UPLOAD,
      request
    );

    const uploadOptions = DocumentService.buildUploadOptions(
      file.mimetype,
      compression
    );

    const uploadResult = await UploadService.uploadFile(
      file,
      DOCUMENT_DIRECTORY,
      uploadOptions
    );

    const now = new Date();
    const document = await prisma.document.create({
      data: {
        userId,
        type: payload.type,
        originalName: uploadResult.original_name,
        path: uploadResult.path,
        mimeType: uploadResult.mime_type,
        size: uploadResult.size,
        createdAt: now,
        updatedAt: now,
      },
    });

    return DocumentService.toResponse(document);
  }

  static async delete(userId: string, id: string): Promise<void> {
    const document = await this.findOwnedDocument(userId, id);
    await this.removeFile(document.path);
    await prisma.document.delete({
      where: { id },
    });
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
      where: {
        id: { in: payload.ids },
        userId,
      },
      select: {
        id: true,
        path: true,
      },
    });

    if (documents.length !== payload.ids.length) {
      throw new ResponseError(
        404,
        "Beberapa dokumen tidak ditemukan atau bukan milik Anda"
      );
    }

    await Promise.all(documents.map((doc) => this.removeFile(doc.path)));

    const result = await prisma.document.deleteMany({
      where: {
        id: { in: payload.ids },
        userId,
      },
    });

    return {
      message: `${result.count} dokumen berhasil dihapus`,
      deleted_count: result.count,
    };
  }

  static async download(userId: string, id: string): Promise<DocumentDownloadResult> {
    const document = await this.findOwnedDocument(userId, id);
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

  private static async findOwnedDocument(
    userId: string,
    id: string
  ): Promise<PrismaDocument> {
    const document = await prisma.document.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!document) {
      throw new ResponseError(404, "Dokumen tidak ditemukan");
    }

    return document;
  }

  private static buildUploadOptions(
    mimetype: string,
    compression?: DocumentCompressionLevel
  ) {
    const options: {
      quality?: number;
      webp?: boolean;
      maxSize?: number;
      compressImage?: boolean;
    } = {
      webp: false,
      maxSize: MAX_UPLOAD_BYTES,
      compressImage: compression !== undefined,
    };

    if (DocumentService.isImageMimeType(mimetype)) {
      if (compression) {
        options.quality = COMPRESSION_QUALITY_MAP[compression];
      }
    } else if (compression) {
      throw new ResponseError(
        400,
        "Kompresi saat ini hanya tersedia untuk gambar"
      );
    }

    return options;
  }

  private static isImageMimeType(mimetype: string): boolean {
    return mimetype.toLowerCase().startsWith("image/");
  }

  private static getAbsolutePath(publicPath: string): string {
    const relativePath = publicPath.replace(/^\/+/, "");
    return path.join(process.cwd(), "public", relativePath);
  }

  private static async removeFile(publicPath: string): Promise<void> {
    if (!publicPath) {
      return;
    }

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
