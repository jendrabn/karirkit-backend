import type {
  ApplicationLetter as PrismaApplicationLetter,
  Prisma,
} from "../generated/prisma/client";
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
} from "../validations/application-letter.validation";
import { ResponseError } from "../utils/response-error.util";

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

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  application_date: "applicationDate",
  company_name: "companyName",
  subject: "subject",
} as const satisfies Record<
  string,
  keyof Prisma.ApplicationLetterOrderByWithRelationInput
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

    const where: Prisma.ApplicationLetterWhereInput = {
      userId,
    };

    if (filters.q) {
      const search = filters.q;
      where.OR = [
        { name: { contains: search } },
        { subject: { contains: search } },
        { companyName: { contains: search } },
        { receiverTitle: { contains: search } },
        { applicantCity: { contains: search } },
      ];
    }

    if (filters.company_name) {
      where.companyName = {
        contains: filters.company_name,
      };
    }

    if (filters.application_date) {
      where.applicationDate = filters.application_date;
    }

    const orderByField = sortFieldMap[filters.sort_by] ?? "createdAt";
    const orderBy: Prisma.ApplicationLetterOrderByWithRelationInput = {
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
    const signaturePath = await ApplicationLetterService.prepareSignatureValue(
      userId,
      payload.signature
    );
    const data = ApplicationLetterService.mapPayloadToData(
      payload,
      signaturePath
    );
    const now = new Date();

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
    const signaturePath = await ApplicationLetterService.prepareSignatureValue(
      userId,
      payload.signature,
      existing.signature
    );
    const data = ApplicationLetterService.mapPayloadToData(
      payload,
      signaturePath
    );

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

    return ApplicationLetterService.toResponse(letter);
  }

  static async delete(userId: string, id: string): Promise<void> {
    await ApplicationLetterService.findOwnedLetter(userId, id);
    await prisma.applicationLetter.delete({
      where: { id },
    });
  }

  static async duplicate(
    userId: string,
    id: string
  ): Promise<ApplicationLetterResponse> {
    const source = await ApplicationLetterService.findOwnedLetter(userId, id);
    const now = new Date();

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
        signature: source.signature,
        templateId: (source as any).templateId,
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
  }

  static async generateDocx(
    userId: string,
    id: string
  ): Promise<GeneratedDocument> {
    const letter = await ApplicationLetterService.findOwnedLetter(userId, id);
    const buffer = await ApplicationLetterService.renderDocx(letter);
    return {
      buffer,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName: `${ApplicationLetterService.buildFileName(letter)}.docx`,
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
      throw new ResponseError(404, "Application letter not found");
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
    };
  }

  private static async prepareSignatureValue(
    userId: string,
    signatureInput: string | null | undefined,
    currentSignature?: string | null
  ): Promise<string> {
    if (signatureInput === undefined) {
      return currentSignature ?? "";
    }

    if (signatureInput === null) {
      await ApplicationLetterService.deleteSignatureFile(currentSignature);
      return "";
    }

    const trimmed = signatureInput.trim();
    if (!trimmed) {
      await ApplicationLetterService.deleteSignatureFile(currentSignature);
      return "";
    }

    const normalizedExisting =
      ApplicationLetterService.normalizeSignaturePublicPath(currentSignature);
    const normalizedInput =
      ApplicationLetterService.normalizeSignaturePublicPath(trimmed);

    if (normalizedInput) {
      if (normalizedExisting === normalizedInput) {
        return normalizedInput;
      }

      await ApplicationLetterService.deleteSignatureFile(currentSignature);
      return normalizedInput;
    }

    const promoted = await ApplicationLetterService.promoteTempSignature(
      userId,
      trimmed
    );
    await ApplicationLetterService.deleteSignatureFile(currentSignature);
    return promoted;
  }

  private static async promoteTempSignature(
    userId: string,
    tempPublicPath: string
  ): Promise<string> {
    const resolved = ApplicationLetterService.resolveUploadFile(
      tempPublicPath,
      TEMP_PUBLIC_PREFIX,
      TEMP_UPLOAD_DIR
    );

    if (!resolved) {
      throw new ResponseError(
        400,
        "Signature must reference an uploaded temp file"
      );
    }

    const extension = ApplicationLetterService.getSignatureFileExtension(
      resolved.absolute
    );
    if (!extension) {
      throw new ResponseError(
        400,
        "Signature must be an image with PNG or JPG format"
      );
    }

    await fs.mkdir(SIGNATURE_UPLOAD_DIR, { recursive: true });

    const fileName = ApplicationLetterService.buildSignatureFileName(
      userId,
      extension
    );
    const destination = path.join(SIGNATURE_UPLOAD_DIR, fileName);

    try {
      await fs.rename(resolved.absolute, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new ResponseError(400, "Temporary signature file not found");
      }
      throw error;
    }

    return path.posix.join("/uploads/signatures", fileName);
  }

  private static async deleteSignatureFile(
    signaturePath?: string | null
  ): Promise<void> {
    const resolved = ApplicationLetterService.resolveUploadFile(
      signaturePath,
      SIGNATURE_PUBLIC_PREFIX,
      SIGNATURE_UPLOAD_DIR
    );

    if (!resolved) {
      return;
    }

    try {
      await fs.unlink(resolved.absolute);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  private static normalizeSignaturePublicPath(
    value?: string | null
  ): string | null {
    const resolved = ApplicationLetterService.resolveUploadFile(
      value,
      SIGNATURE_PUBLIC_PREFIX,
      SIGNATURE_UPLOAD_DIR
    );

    return resolved?.publicPath ?? null;
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
      throw new ResponseError(400, "Template is required");
    }

    const template = await (prisma as any).template.findUnique({
      where: { id: (letter as any).templateId },
    });

    if (!template) {
      throw new ResponseError(404, "Template not found");
    }

    const templatePath = path.join(process.cwd(), template.path);
    const templateBinary = await fs.readFile(templatePath);
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
      const buffer = await fs.readFile(resolvedPath);
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
    const resolved = ApplicationLetterService.resolveUploadFile(
      signaturePath,
      SIGNATURE_PUBLIC_PREFIX,
      SIGNATURE_UPLOAD_DIR
    );

    return resolved?.absolute ?? null;
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
}
