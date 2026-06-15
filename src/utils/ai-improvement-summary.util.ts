import type { Language } from "../generated/prisma/client";

export type AiImprovementChangeType = "added" | "removed" | "updated";

export type AiImprovementChangedField = {
  path: string;
  label: string;
  change_type: AiImprovementChangeType;
};

export type AiImprovementSummary = {
  changed_fields_count: number;
  summary: string[];
  changed_fields: AiImprovementChangedField[];
};

type PathToken = string | number;
type LocalizedText = Record<Language, string>;

const MAX_SUMMARY_ITEMS = 5;

const fieldLabels: Record<string, LocalizedText> = {
  about: { id: "Ringkasan Profil", en: "Profile Summary" },
  address: { id: "Alamat", en: "Address" },
  applicant_city: { id: "Kota Pelamar", en: "Applicant City" },
  application_date: { id: "Tanggal Lamaran", en: "Application Date" },
  attachments: { id: "Lampiran", en: "Attachments" },
  birth_place_date: { id: "Tempat/Tanggal Lahir", en: "Birth Place/Date" },
  body_paragraph: { id: "Paragraf Isi", en: "Body Paragraph" },
  closing_paragraph: { id: "Paragraf Penutup", en: "Closing Paragraph" },
  company_address: { id: "Alamat Perusahaan", en: "Company Address" },
  company_city: { id: "Kota Perusahaan", en: "Company City" },
  company_location: { id: "Lokasi Perusahaan", en: "Company Location" },
  company_name: { id: "Nama Perusahaan", en: "Company Name" },
  description: { id: "Deskripsi", en: "Description" },
  education: { id: "Pendidikan", en: "Education" },
  email: { id: "Email", en: "Email" },
  headline: { id: "Headline", en: "Headline" },
  job_title: { id: "Jabatan", en: "Job Title" },
  major: { id: "Jurusan", en: "Major" },
  name: { id: "Nama", en: "Name" },
  opening_paragraph: { id: "Paragraf Pembuka", en: "Opening Paragraph" },
  organization_name: { id: "Nama Organisasi", en: "Organization Name" },
  phone: { id: "Nomor Telepon", en: "Phone" },
  receiver_title: { id: "Penerima", en: "Recipient" },
  role_title: { id: "Peran", en: "Role" },
  school_location: { id: "Lokasi Sekolah", en: "School Location" },
  school_name: { id: "Nama Sekolah", en: "School Name" },
  subject: { id: "Subjek", en: "Subject" },
  title: { id: "Judul", en: "Title" },
};

const collectionLabels: Record<string, LocalizedText> = {
  awards: { id: "Penghargaan", en: "Award" },
  certificates: { id: "Sertifikat", en: "Certificate" },
  educations: { id: "Pendidikan", en: "Education" },
  experiences: { id: "Pengalaman", en: "Experience" },
  organizations: { id: "Organisasi", en: "Organization" },
  projects: { id: "Proyek", en: "Project" },
  skills: { id: "Keahlian", en: "Skill" },
  social_links: { id: "Tautan Sosial", en: "Social Link" },
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value);

const primitiveEqual = (before: unknown, after: unknown): boolean =>
  Object.is(before, after);

const parsePath = (path: string): PathToken[] => {
  const tokens: PathToken[] = [];
  const matcher = /([^[.\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(path)) !== null) {
    if (match[1] !== undefined) {
      tokens.push(match[1]);
      continue;
    }

    tokens.push(Number(match[2]));
  }

  return tokens;
};

const humanizeField = (field: string): string =>
  field
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const localize = (
  labels: Record<string, LocalizedText>,
  key: string,
  language: Language
): string => labels[key]?.[language] ?? humanizeField(key);

const buildFieldLabel = (path: string, language: Language): string => {
  const tokens = parsePath(path);
  const lastStringToken = [...tokens]
    .reverse()
    .find((token): token is string => typeof token === "string");
  const collectionIndex = tokens.findIndex(
    (token, index) =>
      typeof token === "string" &&
      typeof tokens[index + 1] === "number" &&
      collectionLabels[token]
  );

  if (collectionIndex >= 0) {
    const collectionKey = tokens[collectionIndex] as string;
    const itemIndex = tokens[collectionIndex + 1] as number;
    const collectionLabel = localize(collectionLabels, collectionKey, language);
    const itemLabel = `${collectionLabel} #${itemIndex + 1}`;
    const nestedTokens = tokens.slice(collectionIndex + 2).reverse();
    const fieldToken = nestedTokens.find(
      (token): token is string => typeof token === "string"
    );

    if (!fieldToken || fieldToken === collectionKey) {
      return itemLabel;
    }

    return `${itemLabel} - ${localize(fieldLabels, fieldToken, language)}`;
  }

  return lastStringToken
    ? localize(fieldLabels, lastStringToken, language)
    : path;
};

const appendPath = (basePath: string, key: string | number): string => {
  if (typeof key === "number") {
    return `${basePath}[${key}]`;
  }

  return basePath ? `${basePath}.${key}` : key;
};

const collectChangedFields = (
  before: unknown,
  after: unknown,
  language: Language,
  path = ""
): AiImprovementChangedField[] => {
  if (primitiveEqual(before, after)) {
    return [];
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const maxLength = Math.max(before.length, after.length);
    const changes: AiImprovementChangedField[] = [];

    for (let index = 0; index < maxLength; index += 1) {
      changes.push(
        ...collectChangedFields(
          before[index],
          after[index],
          language,
          appendPath(path, index)
        )
      );
    }

    return changes;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const changes: AiImprovementChangedField[] = [];

    for (const key of keys) {
      changes.push(
        ...collectChangedFields(
          before[key],
          after[key],
          language,
          appendPath(path, key)
        )
      );
    }

    return changes;
  }

  const changeType: AiImprovementChangeType =
    before === undefined ? "added" : after === undefined ? "removed" : "updated";
  const safePath = path || "data";

  return [
    {
      path: safePath,
      label: buildFieldLabel(safePath, language),
      change_type: changeType,
    },
  ];
};

const buildSummaryItem = (
  field: AiImprovementChangedField,
  language: Language
): string => {
  if (language === "en") {
    if (field.change_type === "added") {
      return `${field.label} was added.`;
    }

    if (field.change_type === "removed") {
      return `${field.label} was removed.`;
    }

    return `${field.label} was improved.`;
  }

  if (field.change_type === "added") {
    return `${field.label} ditambahkan.`;
  }

  if (field.change_type === "removed") {
    return `${field.label} dihapus.`;
  }

  return `${field.label} diperbaiki.`;
};

const buildSummaryItems = (
  changedFields: AiImprovementChangedField[],
  language: Language
): string[] => {
  if (changedFields.length === 0) {
    return [
      language === "en"
        ? "No changes were detected."
        : "Tidak ada perubahan yang terdeteksi.",
    ];
  }

  const visibleItems = changedFields
    .slice(0, MAX_SUMMARY_ITEMS)
    .map((field) => buildSummaryItem(field, language));
  const remainingCount = changedFields.length - MAX_SUMMARY_ITEMS;

  if (remainingCount <= 0) {
    return visibleItems;
  }

  return [
    ...visibleItems,
    language === "en"
      ? `${remainingCount} additional field(s) were improved.`
      : `${remainingCount} field tambahan diperbaiki.`,
  ];
};

export const buildAiImprovementSummary = (
  before: unknown,
  after: unknown,
  language: Language
): AiImprovementSummary => {
  const changedFields = collectChangedFields(before, after, language);

  return {
    changed_fields_count: changedFields.length,
    summary: buildSummaryItems(changedFields, language),
    changed_fields: changedFields,
  };
};
