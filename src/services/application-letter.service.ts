import type {
  ApplicationLetter as PrismaApplicationLetter,
  Prisma,
} from "../generated/prisma/client";
import type {
  ApplicationLetterOrderByWithRelationInput,
  ApplicationLetterWhereInput,
} from "../generated/prisma/models/ApplicationLetter";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import createReport from "docx-templates";
import type {
  ApplicationLetter as ApplicationLetterResponse,
  Pagination,
} from "../types/api-schemas";
import { prisma } from "../config/prisma.config";
import { validate } from "../utils/validate.util";
import {
  ApplicationLetterValidation,
  type ApplicationLetterListQuery,
  type ApplicationLetterPayloadInput,
  type MassDeleteInput,
} from "../validations/application-letter.validation";
import { ResponseError } from "../utils/response-error.util";
import { isHttpUrl } from "../utils/url.util";
import { convertDocxToPdf } from "../utils/docx-to-pdf.util";
import env from "../config/env.config";
import { UploadService } from "./upload.service";
import { StorageService } from "./storage.service";

type ApplicationLetterListResult = {
  items: ApplicationLetterResponse[];
  pagination: Pagination;
};

type ApplicationLetterMutableFields = any;

type GeneratedDocument = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

type SignatureImageResult = {
  width: number;
  height: number;
  data: Buffer;
  extension: ".png" | ".jpg";
};

type PreparedSignatureValue = {
  path: string;
  createdPath?: string;
};

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  application_date: "applicationDate",
  company_name: "companyName",
  name: "name",
} as const satisfies Record<
  string,
  keyof ApplicationLetterOrderByWithRelationInput
>;

const MAX_SIGNATURE_HEIGHT_CM = 2;
const SIGNATURE_UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "signatures"
);
const TEMP_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "temp");
const SIGNATURE_PUBLIC_PREFIX = "uploads/signatures";
const TEMP_PUBLIC_PREFIX = "uploads/temp";

export class ApplicationLetterService {
  static async list(
    userId: string,
    query: unknown
  ): Promise<ApplicationLetterListResult> {
    const filters: ApplicationLetterListQuery = validate(
      ApplicationLetterValidation.LIST_QUERY,
      query
    );

    const where: ApplicationLetterWhereInput = {
      userId,
    };

    if (filters.q) {
      const search = filters.q;
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { subject: { contains: search } },
        { companyName: { contains: search } },
        { companyCity: { contains: search } },
        { applicantCity: { contains: search } },
        { education: { contains: search } },
      ];
    }

    if (filters.company_name) {
      where.companyName = filters.company_name;
    }

    if (filters.gender?.length) {
      where.gender = { in: filters.gender };
    }

    if (filters.marital_status?.length) {
      where.maritalStatus = { in: filters.marital_status };
    }

    if (filters.language?.length) {
      where.language = { in: filters.language };
    }

    if (filters.company_city?.length) {
      where.companyCity = { in: filters.company_city };
    }

    if (filters.applicant_city?.length) {
      where.applicantCity = { in: filters.applicant_city };
    }

    if (filters.template_id) {
      where.templateId = filters.template_id;
    }

    if (filters.application_date_from || filters.application_date_to) {
      where.applicationDate = {};
      if (filters.application_date_from) {
        where.applicationDate.gte = filters.application_date_from;
      }
      if (filters.application_date_to) {
        where.applicationDate.lte = filters.application_date_to;
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

    const orderByField = sortFieldMap[filters.sort_by] ?? "createdAt";
    const orderBy: ApplicationLetterOrderByWithRelationInput = {
      [orderByField]: filters.sort_order,
    };

    const page = filters.page;
    const perPage = filters.per_page;

    const [totalItems, records] = await Promise.all([
      prisma.applicationLetter.count({ where }),
      prisma.applicationLetter.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              path: true,
              type: true,
            },
          },
        },
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / Math.max(perPage, 1));

    return {
      items: records.map((record) =>
        ApplicationLetterService.toResponse(record)
      ),
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
    request: unknown
  ): Promise<ApplicationLetterResponse> {
    const payload: ApplicationLetterPayloadInput = validate(
      ApplicationLetterValidation.PAYLOAD,
      request
    );
    const preparedSignature =
      await ApplicationLetterService.prepareSignatureValue(
        userId,
        payload.signature
      );
    const data = ApplicationLetterService.mapPayloadToData(
      payload,
      preparedSignature.path
    );
    const now = new Date();

    try {
      const letter = await prisma.applicationLetter.create({
        data: {
          ...data,
          userId,
          createdAt: now,
          updatedAt: now,
        },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              path: true,
              type: true,
            },
          },
        },
      });

      return ApplicationLetterService.toResponse(letter);
    } catch (error) {
      if (preparedSignature.createdPath) {
        await ApplicationLetterService.deleteSignatureFile(
          preparedSignature.createdPath
        );
      }
      throw error;
    }
  }

  static async get(
    userId: string,
    id: string
  ): Promise<ApplicationLetterResponse> {
    const letter = await ApplicationLetterService.findOwnedLetter(userId, id);
    return ApplicationLetterService.toResponse(letter);
  }

  static async update(
    userId: string,
    id: string,
    request: unknown
  ): Promise<ApplicationLetterResponse> {
    const existing = await ApplicationLetterService.findOwnedLetter(userId, id);
    const payload: ApplicationLetterPayloadInput = validate(
      ApplicationLetterValidation.PAYLOAD,
      request
    );
    const preparedSignature =
      await ApplicationLetterService.prepareSignatureValue(
        userId,
        payload.signature,
        existing.signature
      );
    const data = ApplicationLetterService.mapPayloadToData(
      payload,
      preparedSignature.path
    );

    try {
      const letter = await prisma.applicationLetter.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              path: true,
              type: true,
            },
          },
        },
      });

      if (preparedSignature.path !== (existing.signature ?? "")) {
        await ApplicationLetterService.deleteSignatureFile(existing.signature);
      }

      return ApplicationLetterService.toResponse(letter);
    } catch (error) {
      if (
        preparedSignature.createdPath &&
        preparedSignature.createdPath !== existing.signature
      ) {
        await ApplicationLetterService.deleteSignatureFile(
          preparedSignature.createdPath
        );
      }
      throw error;
    }
  }

  static async delete(userId: string, id: string): Promise<void> {
    const letter = await ApplicationLetterService.findOwnedLetter(userId, id);
    await prisma.applicationLetter.delete({
      where: { id },
    });
    await ApplicationLetterService.deleteSignatureFile(letter.signature);
  }

  static async duplicate(
    userId: string,
    id: string
  ): Promise<ApplicationLetterResponse> {
    const source = await ApplicationLetterService.findOwnedLetter(userId, id);
    const duplicatedSignature =
      await ApplicationLetterService.duplicateSignatureIfManaged(
        source.signature
      );
    const now = new Date();

    try {
      const duplicate = await prisma.applicationLetter.create({
        data: {
          userId,
          name: source.name,
          birthPlaceDate: source.birthPlaceDate,
          gender: source.gender,
          maritalStatus: source.maritalStatus,
          education: source.education,
          phone: source.phone,
          email: source.email,
          address: source.address,
          subject: source.subject,
          applicantCity: source.applicantCity,
          applicationDate: source.applicationDate,
          receiverTitle: source.receiverTitle,
          companyName: source.companyName,
          companyCity: source.companyCity,
          companyAddress: source.companyAddress,
          openingParagraph: source.openingParagraph,
          bodyParagraph: source.bodyParagraph,
          attachments: source.attachments,
          closingParagraph: source.closingParagraph,
          signature: duplicatedSignature,
          templateId: (source as any).templateId,
          language: source.language,
          createdAt: now,
          updatedAt: now,
        },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              path: true,
              type: true,
            },
          },
        },
      });

      return ApplicationLetterService.toResponse(duplicate);
    } catch (error) {
      if (duplicatedSignature !== (source.signature ?? "")) {
        await ApplicationLetterService.deleteSignatureFile(duplicatedSignature);
      }
      throw error;
    }
  }

  static async download(
    userId: string,
    id: string,
    format?: string
  ): Promise<GeneratedDocument> {
    const normalized = (format ?? "docx").toLowerCase();
    const letter = await ApplicationLetterService.findOwnedLetter(userId, id);
    const docxBuffer = await ApplicationLetterService.renderDocx(letter);
    const baseName = ApplicationLetterService.buildFileName(letter);

    if (normalized === "pdf") {
      if (!env.pdfDownloadEnabled) {
        throw new ResponseError(
          503,
          "Fitur unduh PDF untuk surat lamaran sedang dinonaktifkan."
        );
      }
      const pdfBuffer = await convertDocxToPdf(docxBuffer, baseName);
      return {
        buffer: pdfBuffer,
        mimeType: "application/pdf",
        fileName: `${baseName}.pdf`,
      };
    }

    if (normalized !== "docx") {
      throw new ResponseError(400, "Format unduhan tidak didukung");
    }

    return {
      buffer: docxBuffer,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName: `${baseName}.docx`,
    };
  }

  private static async findOwnedLetter(
    userId: string,
    id: string
  ): Promise<
    PrismaApplicationLetter & {
      template?: {
        id: string;
        name: string;
        path: string;
        type: string;
      } | null;
    }
  > {
    const letter = await prisma.applicationLetter.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            path: true,
            type: true,
          },
        },
      },
    });

    if (!letter) {
      throw new ResponseError(404, "Surat lamaran tidak ditemukan");
    }

    return letter;
  }

  private static mapPayloadToData(
    payload: ApplicationLetterPayloadInput,
    signaturePath: string
  ): ApplicationLetterMutableFields {
    return {
      name: payload.name,
      birthPlaceDate: payload.birth_place_date,
      gender: payload.gender,
      maritalStatus: payload.marital_status,
      education: payload.education,
      phone: payload.phone,
      email: payload.email,
      address: payload.address,
      subject: payload.subject,
      applicantCity: payload.applicant_city,
      applicationDate: payload.application_date,
      receiverTitle: payload.receiver_title,
      companyName: payload.company_name,
      companyCity: payload.company_city ?? null,
      companyAddress: payload.company_address ?? null,
      openingParagraph: payload.opening_paragraph,
      bodyParagraph: payload.body_paragraph,
      attachments: payload.attachments,
      closingParagraph: payload.closing_paragraph,
      signature: signaturePath,
      templateId: payload.template_id,
      language: payload.language,
    };
  }

  private static async prepareSignatureValue(
    userId: string,
    signatureInput: string | null | undefined,
    currentSignature?: string | null
  ): Promise<PreparedSignatureValue> {
    if (signatureInput === undefined) {
      return { path: currentSignature ?? "" };
    }

    if (signatureInput === null) {
      return { path: "" };
    }

    const trimmed = signatureInput.trim();
    if (!trimmed) {
      return { path: "" };
    }

    if (isHttpUrl(trimmed)) {
      return { path: trimmed };
    }

    const normalizedInput =
      ApplicationLetterService.normalizeSignaturePublicPath(trimmed);

    if (normalizedInput) {
      return { path: normalizedInput };
    }

    const promoted = await ApplicationLetterService.promoteTempSignature(
      userId,
      trimmed
    );
    return {
      path: promoted,
      createdPath: promoted,
    };
  }

  private static async duplicateSignatureIfManaged(
    signaturePath?: string | null
  ): Promise<string> {
    const normalized = ApplicationLetterService.normalizeSignaturePublicPath(
      signaturePath
    );

    if (!normalized) {
      return signaturePath ?? "";
    }

    return UploadService.copyUpload(normalized, "signatures", [
      SIGNATURE_PUBLIC_PREFIX,
    ]);
  }

  private static async promoteTempSignature(
    userId: string,
    tempPublicPath: string
  ): Promise<string> {
    const normalizedTempPath = UploadService.normalizeManagedUploadPath(
      tempPublicPath,
      [TEMP_PUBLIC_PREFIX]
    );

    if (!normalizedTempPath) {
      throw new ResponseError(
        400,
        "Tanda tangan harus merujuk ke file sementara yang diunggah"
      );
    }

    const extension = ApplicationLetterService.getSignatureFileExtension(
      normalizedTempPath
    );
    if (!extension) {
      throw new ResponseError(
        400,
        "Tanda tangan harus berupa gambar dengan format PNG atau JPG"
      );
    }

    const fileName = ApplicationLetterService.buildSignatureFileName(
      userId,
      extension
    );
    return UploadService.moveFromTemp(
      "signatures",
      normalizedTempPath,
      fileName
    );
  }

  private static async deleteSignatureFile(
    signaturePath?: string | null
  ): Promise<void> {
    const normalized = UploadService.normalizeManagedUploadPath(signaturePath, [
      SIGNATURE_PUBLIC_PREFIX,
    ]);

    if (!normalized) {
      return;
    }

    try {
      await StorageService.delete(normalized);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  private static normalizeSignaturePublicPath(
    value?: string | null
  ): string | null {
    return UploadService.normalizeManagedUploadPath(value, [
      SIGNATURE_PUBLIC_PREFIX,
    ]);
  }

  private static resolveUploadFile(
    input: string | null | undefined,
    prefix: string,
    directory: string
  ): { absolute: string; relative: string; publicPath: string } | null {
    if (!input) {
      return null;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    const normalizedPrefix = prefix
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
    const normalizedInput = trimmed.replace(/\\/g, "/").replace(/^\/+/, "");
    const lowerInput = normalizedInput.toLowerCase();
    const lowerPrefix = `${normalizedPrefix.toLowerCase()}/`;

    if (!lowerInput.startsWith(lowerPrefix)) {
      return null;
    }

    const relativeRaw = normalizedInput.slice(lowerPrefix.length);
    if (!relativeRaw) {
      return null;
    }

    const safeRelative = path.normalize(relativeRaw);
    if (safeRelative.startsWith("..") || path.isAbsolute(safeRelative)) {
      return null;
    }

    const posixRelative = safeRelative.replace(/\\/g, "/");

    return {
      absolute: path.join(directory, safeRelative),
      relative: posixRelative,
      publicPath: path.posix.join("/", normalizedPrefix, posixRelative),
    };
  }

  private static buildSignatureFileName(
    userId: string,
    extension: string
  ): string {
    const safeUser = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-12) || "user";
    const sanitizedExtension = extension.startsWith(".")
      ? extension
      : `.${extension}`;
    return `${Date.now()}-${safeUser}-${crypto.randomUUID()}${sanitizedExtension}`;
  }

  private static async renderDocx(
    letter: PrismaApplicationLetter
  ): Promise<Buffer> {
    // Template is now required, no fallback to default template
    if (!(letter as any).templateId) {
      throw new ResponseError(400, "Template diperlukan");
    }

    const template = await (prisma as any).template.findUnique({
      where: { id: (letter as any).templateId },
    });

    if (!template) {
      throw new ResponseError(404, "Template tidak ditemukan");
    }

    const templateBinary = (await StorageService.read(template.path)).buffer;
    const additionalJsContext =
      ApplicationLetterService.buildAdditionalJsContext();

    const rendered = await createReport({
      template: templateBinary,
      data: ApplicationLetterService.buildTemplateContext(letter),
      cmdDelimiter: ["{{", "}}"],
      additionalJsContext,
    });

    return Buffer.isBuffer(rendered)
      ? rendered
      : Buffer.from(rendered as Uint8Array);
  }

  private static buildTemplateContext(
    letter: PrismaApplicationLetter
  ): Record<string, unknown> {
    const signaturePath = letter.signature ?? "";
    return {
      applicant_city: letter.applicantCity ?? "",
      application_date: letter.applicationDate ?? "",
      subject: letter.subject ?? "",
      receiver_title: letter.receiverTitle ?? "",
      company_name: letter.companyName ?? "",
      company_address: letter.companyAddress ?? "",
      company_city: letter.companyCity ?? "",
      opening_paragraph: letter.openingParagraph ?? "",
      body_paragraph: letter.bodyParagraph ?? "",
      attachments: letter.attachments ?? "",
      attachments_items: ApplicationLetterService.parseAttachmentItems(
        letter.attachments
      ),
      closing_paragraph: letter.closingParagraph ?? "",
      name: letter.name ?? "",
      birth_place_date: letter.birthPlaceDate ?? "",
      gender: ApplicationLetterService.toTitleCase(letter.gender ?? ""),
      marital_status: ApplicationLetterService.toTitleCase(
        letter.maritalStatus ?? ""
      ),
      education: letter.education ?? "",
      phone: letter.phone ?? "",
      email: letter.email ?? "",
      address: letter.address ?? "",
      signature: signaturePath || letter.name || "",
      signature_path: signaturePath,
      signature_fallback: "\n\n",
    };
  }

  private static buildFileName(letter: PrismaApplicationLetter): string {
    const raw = `${letter.name ?? "Pelamar"} - ${
      letter.subject ?? "Posisi"
    } - ${letter.companyName ?? "Perusahaan"}`;

    const sanitized = raw
      .replace(/[<>:"/\\|?*]+/g, "")
      .replace(/[\s-]+/g, "_")
      .trim()
      .slice(0, 120);

    return sanitized || "Lamaran";
  }

  private static toTitleCase(value: string): string {
    return value
      .split("_")
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  }

  private static parseAttachmentItems(value?: string | null): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private static buildAdditionalJsContext() {
    return {
      signatureImage: async (signaturePath?: string | null) =>
        ApplicationLetterService.createSignatureImage(signaturePath),
    };
  }

  private static async createSignatureImage(
    signaturePath?: string | null
  ): Promise<SignatureImageResult | null> {
    const resolvedPath =
      ApplicationLetterService.resolveSignatureFilePath(signaturePath);
    if (!resolvedPath) {
      return null;
    }

    const extension =
      ApplicationLetterService.getSignatureFileExtension(resolvedPath);
    if (!extension) {
      return null;
    }

    try {
      const buffer = (await StorageService.read(resolvedPath)).buffer;
      const dimensions = ApplicationLetterService.extractImageDimensions(
        buffer,
        extension
      );
      const aspectRatio =
        dimensions && dimensions.height > 0
          ? dimensions.width / dimensions.height
          : 1;
      const width = Number(
        (Math.max(aspectRatio, 0.1) * MAX_SIGNATURE_HEIGHT_CM).toFixed(2)
      );

      return {
        width,
        height: MAX_SIGNATURE_HEIGHT_CM,
        data: buffer,
        extension,
      };
    } catch {
      return null;
    }
  }

  private static resolveSignatureFilePath(
    signaturePath?: string | null
  ): string | null {
    return UploadService.normalizeManagedUploadPath(signaturePath, [
      SIGNATURE_PUBLIC_PREFIX,
    ]);
  }

  private static getSignatureFileExtension(
    filePath: string
  ): SignatureImageResult["extension"] | null {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".png") {
      return ".png";
    }

    if (ext === ".jpg" || ext === ".jpeg") {
      return ".jpg";
    }

    return null;
  }

  private static extractImageDimensions(
    buffer: Buffer,
    extension: SignatureImageResult["extension"]
  ): { width: number; height: number } | null {
    if (extension === ".png") {
      return ApplicationLetterService.extractPngDimensions(buffer);
    }

    return ApplicationLetterService.extractJpegDimensions(buffer);
  }

  private static extractPngDimensions(
    buffer: Buffer
  ): { width: number; height: number } | null {
    if (buffer.length < 24) {
      return null;
    }

    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    if (!buffer.subarray(0, 8).equals(pngSignature)) {
      return null;
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  private static extractJpegDimensions(
    buffer: Buffer
  ): { width: number; height: number } | null {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      return null;
    }

    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      offset += 2;

      if (marker === 0xd9 || marker === 0xda) {
        break;
      }

      if (offset + 1 >= buffer.length) {
        break;
      }

      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) {
        break;
      }

      if (ApplicationLetterService.isJpegSofMarker(marker)) {
        if (offset + 5 >= buffer.length) {
          break;
        }
        const height = buffer.readUInt16BE(offset + 3);
        const width = buffer.readUInt16BE(offset + 5);
        return { width, height };
      }

      offset += segmentLength;
    }

    return null;
  }

  private static isJpegSofMarker(marker: number): boolean {
    return (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    );
  }

  private static toResponse(
    letter: PrismaApplicationLetter & { template?: any }
  ): ApplicationLetterResponse {
    return {
      id: letter.id,
      user_id: letter.userId,
      name: letter.name,
      birth_place_date: letter.birthPlaceDate,
      gender: letter.gender,
      marital_status: letter.maritalStatus,
      education: letter.education,
      phone: letter.phone,
      email: letter.email,
      address: letter.address,
      subject: letter.subject,
      applicant_city: letter.applicantCity,
      application_date: letter.applicationDate,
      receiver_title: letter.receiverTitle,
      company_name: letter.companyName,
      company_city: letter.companyCity ?? null,
      company_address: letter.companyAddress ?? null,
      opening_paragraph: letter.openingParagraph,
      body_paragraph: letter.bodyParagraph,
      attachments: letter.attachments,
      closing_paragraph: letter.closingParagraph,
      signature: letter.signature,
      template_id: (letter as any).templateId ?? null,
      language: letter.language,
      template: letter.template
        ? {
            id: letter.template.id,
            name: letter.template.name,
            path: letter.template.path,
            type: letter.template.type,
          }
        : null,
      created_at: letter.createdAt?.toISOString(),
      updated_at: letter.updatedAt?.toISOString(),
    };
  }

  static async massDelete(
    userId: string,
    request: unknown
  ): Promise<{ message: string; deleted_count: number }> {
    const { ids } = validate(ApplicationLetterValidation.MASS_DELETE, request);

    // Verify all application letters belong to the user
    const letters = await prisma.applicationLetter.findMany({
      where: {
        id: { in: ids },
        userId,
      },
      select: { id: true, signature: true },
    });

    if (letters.length !== ids.length) {
      throw new ResponseError(
        404,
        "Beberapa surat lamaran tidak ditemukan atau bukan milik Anda"
      );
    }

    // Delete all application letters
    const result = await prisma.applicationLetter.deleteMany({
      where: {
        id: { in: ids },
        userId,
      },
    });

    await Promise.all(
      letters.map((letter) =>
        ApplicationLetterService.deleteSignatureFile(letter.signature)
      )
    );

    return {
      message: `${result.count} surat lamaran berhasil dihapus`,
      deleted_count: result.count,
    };
  }
}
