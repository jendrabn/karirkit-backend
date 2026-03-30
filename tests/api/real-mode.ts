import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export const runRealApiTests = process.env.RUN_REAL_API_TESTS === "true";

type RealUserOverrides = Partial<{
  name: string;
  username: string;
  email: string;
  plainPassword: string;
  role: "user" | "admin";
  status: "active" | "suspended" | "banned";
  statusReason: string | null;
  suspendedUntil: Date | null;
  planId: "free" | "pro" | "max";
  subscriptionExpiresAt: Date | null;
}>;

export const buildUniqueAuthPayload = (label: string) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: `Test ${label} ${suffix}`,
    username: `${label}-${suffix}`.slice(0, 40),
    email: `${label}-${suffix}@example.com`,
    password: "secret123",
  };
};

export const loadPrisma = async () => {
  const prismaModule = await import("../../src/config/prisma.config");
  return prismaModule.prisma;
};

export const disconnectPrisma = async () => {
  const prisma = await loadPrisma();
  await prisma.$disconnect();
};

export const createSessionToken = async (user: {
  id: string;
  username: string;
  email: string;
}) => {
  const [{ default: jwt }, { default: env }] = await Promise.all([
    import("jsonwebtoken"),
    import("../../src/config/env.config"),
  ]);

  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      session_iat_ms: Date.now(),
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
};

export const createRealUser = async (
  label: string,
  overrides: RealUserOverrides = {},
) => {
  const prisma = await loadPrisma();
  const [{ default: bcrypt }, { buildUserSubscriptionState }] = await Promise.all([
    import("bcrypt"),
    import("../../src/config/subscription-plans.config"),
  ]);
  const seed = buildUniqueAuthPayload(label);
  const plainPassword = overrides.plainPassword ?? seed.password;
  const planId = overrides.planId ?? "free";
  const subscriptionExpiresAt =
    overrides.subscriptionExpiresAt ??
    (planId === "free" ? null : new Date("2030-01-01T00:00:00.000Z"));
  const subscriptionState = buildUserSubscriptionState(
    planId,
    subscriptionExpiresAt,
  );

  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? seed.name,
      username: overrides.username ?? seed.username,
      email: overrides.email ?? seed.email,
      password: await bcrypt.hash(plainPassword, 10),
      role: overrides.role ?? "user",
      status: overrides.status ?? "active",
      statusReason: overrides.statusReason ?? null,
      suspendedUntil: overrides.suspendedUntil ?? null,
      subscriptionPlan: subscriptionState.subscriptionPlan,
      subscriptionExpiresAt: subscriptionState.subscriptionExpiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return {
    user,
    plainPassword,
  };
};

export const deleteUsersByEmail = async (...emails: string[]) => {
  if (emails.length === 0) {
    return;
  }

  const prisma = await loadPrisma();
  await prisma.user.deleteMany({
    where: {
      email: {
        in: emails,
      },
    },
  });
};

export const createPublishedJobFixture = async (label: string) => {
  const prisma = await loadPrisma();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();

  const province = await prisma.province.create({
    data: {
      name: `Provinsi ${label} ${suffix}`,
    },
  });

  const city = await prisma.city.create({
    data: {
      provinceId: province.id,
      name: `Kota ${label} ${suffix}`,
    },
  });

  const company = await prisma.company.create({
    data: {
      name: `Company ${label} ${suffix}`,
      slug: `company-${label}-${suffix}`,
      createdAt: now,
      updatedAt: now,
    },
  });

  const jobRole = await prisma.jobRole.create({
    data: {
      name: `Job Role ${label} ${suffix}`,
      slug: `job-role-${label}-${suffix}`,
      createdAt: now,
      updatedAt: now,
    },
  });

  const job = await prisma.job.create({
    data: {
      companyId: company.id,
      jobRoleId: jobRole.id,
      cityId: city.id,
      title: `Software Engineer ${label} ${suffix}`,
      slug: `software-engineer-${label}-${suffix}`,
      jobType: "full_time",
      workSystem: "remote",
      educationLevel: "bachelor",
      minYearsOfExperience: 2,
      description: "Role description",
      requirements: "Role requirements",
      status: "published",
      expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    province,
    city,
    company,
    jobRole,
    job,
  };
};

export const cleanupPublishedJobFixture = async (fixture: {
  province: { id: string };
  city: { id: string };
  company: { id: string };
  jobRole: { id: string };
  job: { id: string };
}) => {
  const prisma = await loadPrisma();

  await prisma.savedJob.deleteMany({
    where: {
      jobId: fixture.job.id,
    },
  });
  await prisma.jobMedia.deleteMany({
    where: {
      jobId: fixture.job.id,
    },
  });
  await prisma.job.deleteMany({
    where: {
      id: fixture.job.id,
    },
  });
  await prisma.company.deleteMany({
    where: {
      id: fixture.company.id,
    },
  });
  await prisma.jobRole.deleteMany({
    where: {
      id: fixture.jobRole.id,
    },
  });
  await prisma.city.deleteMany({
    where: {
      id: fixture.city.id,
    },
  });
  await prisma.province.deleteMany({
    where: {
      id: fixture.province.id,
    },
  });
};

type StoredDocumentOverrides = Partial<{
  type: string;
  originalName: string;
  mimeType: string;
  content: Buffer;
}>;

export const createStoredDocumentFixture = async (
  userId: string,
  overrides: StoredDocumentOverrides = {},
) => {
  const prisma = await loadPrisma();
  const extension =
    overrides.originalName && path.extname(overrides.originalName)
      ? path.extname(overrides.originalName)
      : ".txt";
  const fileName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const relativePath = path.posix.join("/uploads/documents", fileName);
  const absolutePath = path.join(process.cwd(), "public", "uploads", "documents", fileName);
  const content = overrides.content ?? Buffer.from("document content");

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content);

  const document = await prisma.document.create({
    data: {
      userId,
      type: (overrides.type ?? "cv") as any,
      originalName: overrides.originalName ?? `fixture${extension}`,
      path: relativePath,
      mimeType: overrides.mimeType ?? "text/plain",
      size: content.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return {
    document,
    absolutePath,
    content,
  };
};

export const cleanupStoredDocumentFixture = async (documentId: string) => {
  const prisma = await loadPrisma();
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (document) {
    const absolutePath = path.join(
      process.cwd(),
      "public",
      document.path.replace(/^\/+/, "").replace(/\//g, path.sep),
    );
    await fs.rm(absolutePath, { force: true }).catch(() => {
      // ignore cleanup errors
    });
    await prisma.document.deleteMany({
      where: { id: documentId },
    });
  }
};

export const cleanupStoredDocumentsForUser = async (userId: string) => {
  const prisma = await loadPrisma();
  const documents: { id: string; path: string }[] = await prisma.document.findMany({
    where: { userId },
    select: { id: true, path: true },
  });

  await Promise.all(
    documents.map((document: { id: string; path: string }) =>
      fs
        .rm(
          path.join(
            process.cwd(),
            "public",
            document.path.replace(/^\/+/, "").replace(/\//g, path.sep),
          ),
          { force: true },
        )
        .catch(() => {
          // ignore cleanup errors
        }),
    ),
  );

  await prisma.document.deleteMany({
    where: { userId },
  });
};

export const createRealTemplateFixture = async (
  type: "cv" | "application_letter",
  label: string
) => {
  const prisma = await loadPrisma();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();

  return prisma.template.create({
    data: {
      name: `Template ${label} ${suffix}`,
      type,
      language: "id",
      path:
        type === "cv"
          ? "/uploads/templates/cv-001.docx"
          : "/uploads/templates/apl-001.docx",
      preview:
        type === "application_letter" ? "/uploads/templates/apl-001.webp" : null,
      isPremium: false,
      createdAt: now,
      updatedAt: now,
    },
  });
};

export const buildApplicationLetterPayload = (
  templateId: string,
  overrides: Record<string, unknown> = {}
) => ({
  name: "Budi Santoso",
  birth_place_date: "Jakarta, 1 Januari 2000",
  gender: "male",
  marital_status: "single",
  education: "S1 Informatika",
  phone: "081234567890",
  email: "budi@example.com",
  address: "Jl. Mawar No. 1",
  subject: "Lamaran Backend Engineer",
  applicant_city: "Jakarta",
  application_date: "2026-03-25",
  receiver_title: "HR Manager",
  company_name: "PT Karirkit",
  company_city: "Jakarta",
  company_address: "Jl. Sudirman No. 10",
  opening_paragraph: "Dengan hormat, saya mengajukan lamaran kerja.",
  body_paragraph: "Saya memiliki pengalaman yang relevan untuk posisi ini.",
  attachments: "CV, Portofolio",
  closing_paragraph: "Terima kasih atas perhatian Bapak/Ibu.",
  signature: "https://example.com/signature.png",
  template_id: templateId,
  language: "id",
  ...overrides,
});

export const createRealApplicationLetterFixture = async (
  userId: string,
  templateId: string,
  overrides: Record<string, unknown> = {}
) => {
  const prisma = await loadPrisma();
  const payload = buildApplicationLetterPayload(templateId, overrides);

  return prisma.applicationLetter.create({
    data: {
      userId,
      name: payload.name as string,
      birthPlaceDate: payload.birth_place_date as string,
      gender: payload.gender as any,
      maritalStatus: payload.marital_status as any,
      education: payload.education as string,
      phone: payload.phone as string,
      email: payload.email as string,
      address: payload.address as string,
      subject: payload.subject as string,
      applicantCity: payload.applicant_city as string,
      applicationDate: payload.application_date as string,
      receiverTitle: payload.receiver_title as string,
      companyName: payload.company_name as string,
      companyCity: (payload.company_city as string) ?? null,
      companyAddress: (payload.company_address as string) ?? null,
      openingParagraph: payload.opening_paragraph as string,
      bodyParagraph: payload.body_paragraph as string,
      attachments: payload.attachments as string,
      closingParagraph: payload.closing_paragraph as string,
      signature: payload.signature as string,
      templateId,
      language: payload.language as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
};

export const buildCvPayload = (
  templateId: string,
  overrides: Record<string, unknown> = {}
) => ({
  name: "Budi Santoso",
  headline: "Backend Engineer",
  email: "budi@example.com",
  phone: "081234567890",
  address: "Jl. Mawar No. 1",
  about: "Backend engineer dengan pengalaman membangun API.",
  photo: null,
  visibility: "private",
  template_id: templateId,
  language: "id",
  educations: [
    {
      degree: "bachelor",
      school_name: "Universitas Indonesia",
      school_location: "Depok",
      major: "Teknik Informatika",
      start_month: 8,
      start_year: 2018,
      end_month: 7,
      end_year: 2022,
      is_current: false,
      gpa: 3.8,
      description: "Lulus dengan predikat cumlaude.",
    },
  ],
  certificates: [],
  experiences: [],
  skills: [
    {
      name: "TypeScript",
      level: "advanced",
      skill_category: "programming_language",
    },
  ],
  awards: [],
  social_links: [
    {
      platform: "linkedin",
      url: "https://linkedin.com/in/budi",
    },
  ],
  organizations: [],
  projects: [],
  ...overrides,
});

export const createRealCvFixture = async (
  userId: string,
  templateId: string,
  overrides: Record<string, unknown> = {}
) => {
  const prisma = await loadPrisma();
  const payload = buildCvPayload(templateId, overrides);
  const now = new Date();
  const slug = `cv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return prisma.cv.create({
    data: {
      userId,
      templateId,
      name: payload.name as string,
      headline: payload.headline as string,
      email: payload.email as string,
      phone: payload.phone as string,
      address: payload.address as string,
      about: payload.about as string,
      photo: (payload.photo as string | null | undefined) ?? null,
      language: payload.language as any,
      slug: ((payload as Record<string, unknown>).slug as string | undefined) ?? slug,
      visibility: (payload.visibility as any) ?? "private",
      createdAt: now,
      updatedAt: now,
      educations: payload.educations
        ? {
            create: (payload.educations as any[]).map((record) => ({
              degree: record.degree,
              schoolName: record.school_name,
              schoolLocation: record.school_location,
              major: record.major,
              startMonth: record.start_month,
              startYear: record.start_year,
              endMonth: record.end_month ?? null,
              endYear: record.end_year ?? null,
              isCurrent: record.is_current,
              gpa: record.gpa ?? null,
              description: record.description ?? null,
              createdAt: now,
              updatedAt: now,
            })),
          }
        : undefined,
      certificates: payload.certificates
        ? {
            create: (payload.certificates as any[]).map((record) => ({
              title: record.title,
              issuer: record.issuer,
              issueMonth: record.issue_month,
              issueYear: record.issue_year,
              expiryMonth: record.expiry_month ?? null,
              expiryYear: record.expiry_year ?? null,
              noExpiry: record.no_expiry ?? false,
              credentialId: record.credential_id ?? null,
              credentialUrl: record.credential_url ?? null,
              description: record.description ?? null,
              createdAt: now,
              updatedAt: now,
            })),
          }
        : undefined,
      experiences: payload.experiences
        ? {
            create: (payload.experiences as any[]).map((record) => ({
              jobTitle: record.job_title,
              companyName: record.company_name,
              companyLocation: record.company_location,
              jobType: record.job_type,
              startMonth: record.start_month,
              startYear: record.start_year,
              endMonth: record.end_month ?? null,
              endYear: record.end_year ?? null,
              isCurrent: record.is_current,
              description: record.description ?? null,
              createdAt: now,
              updatedAt: now,
            })),
          }
        : undefined,
      skills: payload.skills
        ? {
            create: (payload.skills as any[]).map((record) => ({
              name: record.name,
              level: record.level,
              skillCategory: record.skill_category,
              createdAt: now,
              updatedAt: now,
            })),
          }
        : undefined,
      awards: payload.awards
        ? {
            create: (payload.awards as any[]).map((record) => ({
              title: record.title,
              issuer: record.issuer,
              description: record.description ?? null,
              year: record.year,
              createdAt: now,
              updatedAt: now,
            })),
          }
        : undefined,
      socialLinks: payload.social_links
        ? {
            create: (payload.social_links as any[]).map((record) => ({
              platform: record.platform,
              url: record.url,
              createdAt: now,
              updatedAt: now,
            })),
          }
        : undefined,
      organizations: payload.organizations
        ? {
            create: (payload.organizations as any[]).map((record) => ({
              organizationName: record.organization_name,
              roleTitle: record.role_title,
              organizationType: record.organization_type,
              location: record.location,
              startMonth: record.start_month,
              startYear: record.start_year,
              endMonth: record.end_month ?? null,
              endYear: record.end_year ?? null,
              isCurrent: record.is_current,
              description: record.description ?? null,
              createdAt: now,
              updatedAt: now,
            })),
          }
        : undefined,
      projects: payload.projects
        ? {
            create: (payload.projects as any[]).map((record) => ({
              name: record.name,
              description: record.description ?? null,
              year: record.year,
              repoUrl: record.repo_url ?? null,
              liveUrl: record.live_url ?? null,
              createdAt: now,
              updatedAt: now,
            })),
          }
        : undefined,
    },
  });
};
