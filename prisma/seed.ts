import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcrypt";

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionLimit: 5,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Start seeding...");

  // Clean up existing data
  await prisma.blogTagRelation.deleteMany();
  await prisma.blog.deleteMany();
  await prisma.blogTag.deleteMany();
  await prisma.blogCategory.deleteMany();
  await prisma.otp.deleteMany();
  await prisma.template.deleteMany();
  await prisma.portfolioTool.deleteMany();
  await prisma.portfolioMedia.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.cvOrganization.deleteMany();
  await prisma.cvSocialLink.deleteMany();
  await prisma.cvAward.deleteMany();
  await prisma.cvSkill.deleteMany();
  await prisma.cvExperience.deleteMany();
  await prisma.cvCertificate.deleteMany();
  await prisma.cvEducation.deleteMany();
  await prisma.applicationLetter.deleteMany();
  await prisma.application.deleteMany();
  await prisma.cv.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  const hashedPassword = await bcrypt.hash("password123", 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: "John Doe",
        username: "johndoe",
        email: "john@example.com",
        password: hashedPassword,
        role: "user",
        phone: "+1234567890",
        avatar: "https://example.com/avatar1.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        name: "Jane Smith",
        username: "janesmith",
        email: "jane@example.com",
        password: hashedPassword,
        role: "user",
        phone: "+1234567891",
        avatar: "https://example.com/avatar2.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        name: "Admin User",
        username: "admin",
        email: "admin@example.com",
        password: hashedPassword,
        role: "admin",
        phone: "+1234567892",
        avatar: "https://example.com/avatar3.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create Templates
  const templates = await Promise.all([
    prisma.template.create({
      data: {
        name: "Modern CV Template",
        slug: "modern-cv-template",
        type: "cv",
        language: "en",
        path: "/templates/cv/modern.docx",
        isPremium: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.template.create({
      data: {
        name: "Classic Application Letter",
        slug: "classic-application-letter",
        type: "application_letter",
        language: "en",
        path: "/templates/letter/classic.docx",
        isPremium: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.template.create({
      data: {
        name: "Creative CV Template",
        slug: "creative-cv-template",
        type: "cv",
        language: "id",
        path: "/templates/cv/creative.docx",
        isPremium: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create Blog Categories
  const blogCategories = await Promise.all([
    prisma.blogCategory.create({
      data: {
        name: "Technology",
        slug: "technology",
        description: "Articles about technology and programming",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.blogCategory.create({
      data: {
        name: "Career Development",
        slug: "career-development",
        description: "Tips and tricks for career growth",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.blogCategory.create({
      data: {
        name: "Design",
        slug: "design",
        description: "Design principles and best practices",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create Blog Tags
  const blogTags = await Promise.all([
    prisma.blogTag.create({
      data: {
        name: "JavaScript",
        slug: "javascript",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.blogTag.create({
      data: {
        name: "React",
        slug: "react",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.blogTag.create({
      data: {
        name: "Node.js",
        slug: "nodejs",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create CVs
  const cvs = await Promise.all([
    prisma.cv.create({
      data: {
        userId: users[0].id,
        templateId: templates[0].id,
        name: "John Doe CV",
        headline: "Full Stack Developer",
        email: "john@example.com",
        phone: "+1234567890",
        address: "123 Main St, New York, NY",
        about:
          "Experienced full stack developer with 5+ years of experience in web development.",
        photo: "https://example.com/photo1.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cv.create({
      data: {
        userId: users[1].id,
        templateId: templates[2].id,
        name: "Jane Smith CV",
        headline: "UI/UX Designer",
        email: "jane@example.com",
        phone: "+1234567891",
        address: "456 Oak Ave, San Francisco, CA",
        about:
          "Creative UI/UX designer with a passion for user-centered design.",
        photo: "https://example.com/photo2.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cv.create({
      data: {
        userId: users[2].id,
        templateId: templates[0].id,
        name: "Admin User CV",
        headline: "Project Manager",
        email: "admin@example.com",
        phone: "+1234567892",
        address: "789 Pine Rd, Chicago, IL",
        about:
          "Experienced project manager with a track record of successful project delivery.",
        photo: "https://example.com/photo3.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create CV Educations
  await Promise.all([
    prisma.cvEducation.create({
      data: {
        cvId: cvs[0].id,
        degree: "bachelor",
        schoolName: "University of Technology",
        schoolLocation: "Boston, MA",
        major: "Computer Science",
        startMonth: 9,
        startYear: 2015,
        endMonth: 6,
        endYear: 2019,
        isCurrent: false,
        gpa: 3.8,
        description: "Focused on software engineering and web development",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvEducation.create({
      data: {
        cvId: cvs[1].id,
        degree: "bachelor",
        schoolName: "Design Institute",
        schoolLocation: "Los Angeles, CA",
        major: "Graphic Design",
        startMonth: 9,
        startYear: 2016,
        endMonth: 6,
        endYear: 2020,
        isCurrent: false,
        gpa: 3.9,
        description: "Specialized in user interface and experience design",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvEducation.create({
      data: {
        cvId: cvs[2].id,
        degree: "master",
        schoolName: "Business School",
        schoolLocation: "New York, NY",
        major: "Business Administration",
        startMonth: 9,
        startYear: 2014,
        endMonth: 6,
        endYear: 2016,
        isCurrent: false,
        gpa: 3.7,
        description: "Focused on project management and leadership",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create CV Certificates
  await Promise.all([
    prisma.cvCertificate.create({
      data: {
        cvId: cvs[0].id,
        title: "AWS Certified Developer",
        issuer: "Amazon Web Services",
        issueMonth: 3,
        issueYear: 2021,
        expiryMonth: 3,
        expiryYear: 2024,
        noExpiry: false,
        credentialId: "AWS-DEV-123456",
        credentialUrl: "https://aws.amazon.com/verification",
        description:
          "Certification in developing and deploying applications on AWS",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvCertificate.create({
      data: {
        cvId: cvs[1].id,
        title: "Google UX Design Certificate",
        issuer: "Google",
        issueMonth: 6,
        issueYear: 2020,
        expiryMonth: 6,
        expiryYear: 2023,
        noExpiry: false,
        credentialId: "GOOGLE-UX-789012",
        credentialUrl: "https://grow.google/certificates",
        description:
          "Professional certificate in UX design principles and practices",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvCertificate.create({
      data: {
        cvId: cvs[2].id,
        title: "PMP Certification",
        issuer: "Project Management Institute",
        issueMonth: 9,
        issueYear: 2019,
        noExpiry: true,
        credentialId: "PMP-345678",
        credentialUrl: "https://www.pmi.org/certifications",
        description: "Project Management Professional certification",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create CV Experiences
  await Promise.all([
    prisma.cvExperience.create({
      data: {
        cvId: cvs[0].id,
        jobTitle: "Senior Full Stack Developer",
        companyName: "Tech Solutions Inc.",
        companyLocation: "San Francisco, CA",
        jobType: "full_time",
        startMonth: 7,
        startYear: 2019,
        isCurrent: true,
        description:
          "Leading development of web applications using React and Node.js",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvExperience.create({
      data: {
        cvId: cvs[1].id,
        jobTitle: "Senior UI/UX Designer",
        companyName: "Creative Agency",
        companyLocation: "New York, NY",
        jobType: "full_time",
        startMonth: 8,
        startYear: 2020,
        isCurrent: true,
        description:
          "Designing user interfaces and experiences for various client projects",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvExperience.create({
      data: {
        cvId: cvs[2].id,
        jobTitle: "Project Manager",
        companyName: "Global Corp",
        companyLocation: "Chicago, IL",
        jobType: "full_time",
        startMonth: 1,
        startYear: 2017,
        endMonth: 12,
        endYear: 2020,
        isCurrent: false,
        description: "Managed multiple projects with budgets over $1M",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create CV Skills
  await Promise.all([
    prisma.cvSkill.create({
      data: {
        cvId: cvs[0].id,
        name: "JavaScript",
        level: "expert",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSkill.create({
      data: {
        cvId: cvs[0].id,
        name: "React",
        level: "advanced",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSkill.create({
      data: {
        cvId: cvs[0].id,
        name: "Node.js",
        level: "advanced",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSkill.create({
      data: {
        cvId: cvs[1].id,
        name: "Figma",
        level: "expert",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSkill.create({
      data: {
        cvId: cvs[1].id,
        name: "Adobe XD",
        level: "advanced",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSkill.create({
      data: {
        cvId: cvs[1].id,
        name: "Sketch",
        level: "intermediate",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSkill.create({
      data: {
        cvId: cvs[2].id,
        name: "Project Management",
        level: "expert",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSkill.create({
      data: {
        cvId: cvs[2].id,
        name: "Agile",
        level: "advanced",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSkill.create({
      data: {
        cvId: cvs[2].id,
        name: "Scrum",
        level: "advanced",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create CV Awards
  await Promise.all([
    prisma.cvAward.create({
      data: {
        cvId: cvs[0].id,
        title: "Best Developer Award",
        issuer: "Tech Solutions Inc.",
        description:
          "Recognized for outstanding contribution to product development",
        year: 2022,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvAward.create({
      data: {
        cvId: cvs[1].id,
        title: "Design Excellence Award",
        issuer: "Creative Agency",
        description: "Awarded for innovative design solutions",
        year: 2021,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvAward.create({
      data: {
        cvId: cvs[2].id,
        title: "Project Manager of the Year",
        issuer: "Global Corp",
        description: "Recognized for successful project delivery",
        year: 2019,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create CV Social Links
  await Promise.all([
    prisma.cvSocialLink.create({
      data: {
        cvId: cvs[0].id,
        platform: "LinkedIn",
        url: "https://linkedin.com/in/johndoe",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSocialLink.create({
      data: {
        cvId: cvs[0].id,
        platform: "GitHub",
        url: "https://github.com/johndoe",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSocialLink.create({
      data: {
        cvId: cvs[1].id,
        platform: "LinkedIn",
        url: "https://linkedin.com/in/janesmith",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSocialLink.create({
      data: {
        cvId: cvs[1].id,
        platform: "Dribbble",
        url: "https://dribbble.com/janesmith",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSocialLink.create({
      data: {
        cvId: cvs[2].id,
        platform: "LinkedIn",
        url: "https://linkedin.com/in/adminuser",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSocialLink.create({
      data: {
        cvId: cvs[2].id,
        platform: "Twitter",
        url: "https://twitter.com/adminuser",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create CV Organizations
  await Promise.all([
    prisma.cvOrganization.create({
      data: {
        cvId: cvs[0].id,
        organizationName: "Developer Community",
        roleTitle: "Member",
        organizationType: "community",
        location: "San Francisco, CA",
        startMonth: 1,
        startYear: 2020,
        isCurrent: true,
        description: "Active member of local developer community",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvOrganization.create({
      data: {
        cvId: cvs[1].id,
        organizationName: "Design Association",
        roleTitle: "Board Member",
        organizationType: "professional",
        location: "New York, NY",
        startMonth: 6,
        startYear: 2021,
        isCurrent: true,
        description: "Board member of the national design association",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvOrganization.create({
      data: {
        cvId: cvs[2].id,
        organizationName: "Project Management Institute",
        roleTitle: "Member",
        organizationType: "professional",
        location: "Chicago, IL",
        startMonth: 3,
        startYear: 2018,
        isCurrent: true,
        description: "Active member of PMI local chapter",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create Portfolios
  const portfolios = await Promise.all([
    prisma.portfolio.create({
      data: {
        userId: users[0].id,
        title: "E-commerce Platform",
        slug: "e-commerce-platform",
        sortDescription: "Full-stack e-commerce solution",
        description:
          "A complete e-commerce platform built with React and Node.js, featuring user authentication, payment processing, and inventory management.",
        roleTitle: "Full Stack Developer",
        projectType: "work",
        industry: "Retail",
        month: 6,
        year: 2023,
        liveUrl: "https://example-ecommerce.com",
        repoUrl: "https://github.com/johndoe/ecommerce",
        cover: "https://example.com/ecommerce-cover.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolio.create({
      data: {
        userId: users[1].id,
        title: "Mobile Banking App",
        slug: "mobile-banking-app",
        sortDescription: "Modern banking application design",
        description:
          "UI/UX design for a mobile banking application with focus on user experience and security.",
        roleTitle: "UI/UX Designer",
        projectType: "freelance",
        industry: "Finance",
        month: 9,
        year: 2023,
        liveUrl: "https://example-banking.com",
        cover: "https://example.com/banking-cover.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolio.create({
      data: {
        userId: users[2].id,
        title: "Project Management Tool",
        slug: "project-management-tool",
        sortDescription: "Agile project management platform",
        description:
          "Web-based project management tool designed for agile teams with sprint planning and tracking features.",
        roleTitle: "Project Manager",
        projectType: "personal",
        industry: "Software",
        month: 3,
        year: 2023,
        repoUrl: "https://github.com/adminuser/pm-tool",
        cover: "https://example.com/pm-tool-cover.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create Portfolio Medias
  await Promise.all([
    prisma.portfolioMedia.create({
      data: {
        portfolioId: portfolios[0].id,
        path: "https://example.com/ecommerce-1.jpg",
        caption: "Homepage design",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioMedia.create({
      data: {
        portfolioId: portfolios[0].id,
        path: "https://example.com/ecommerce-2.jpg",
        caption: "Product listing page",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioMedia.create({
      data: {
        portfolioId: portfolios[1].id,
        path: "https://example.com/banking-1.jpg",
        caption: "Login screen",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioMedia.create({
      data: {
        portfolioId: portfolios[1].id,
        path: "https://example.com/banking-2.jpg",
        caption: "Dashboard design",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioMedia.create({
      data: {
        portfolioId: portfolios[2].id,
        path: "https://example.com/pm-tool-1.jpg",
        caption: "Project overview",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioMedia.create({
      data: {
        portfolioId: portfolios[2].id,
        path: "https://example.com/pm-tool-2.jpg",
        caption: "Sprint planning view",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create Portfolio Tools
  await Promise.all([
    prisma.portfolioTool.create({
      data: {
        portfolioId: portfolios[0].id,
        name: "React",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioTool.create({
      data: {
        portfolioId: portfolios[0].id,
        name: "Node.js",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioTool.create({
      data: {
        portfolioId: portfolios[0].id,
        name: "MongoDB",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioTool.create({
      data: {
        portfolioId: portfolios[1].id,
        name: "Figma",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioTool.create({
      data: {
        portfolioId: portfolios[1].id,
        name: "Adobe XD",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioTool.create({
      data: {
        portfolioId: portfolios[2].id,
        name: "React",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioTool.create({
      data: {
        portfolioId: portfolios[2].id,
        name: "TypeScript",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioTool.create({
      data: {
        portfolioId: portfolios[2].id,
        name: "PostgreSQL",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create Applications
  await Promise.all([
    prisma.application.create({
      data: {
        userId: users[0].id,
        companyName: "Tech Giants Inc.",
        companyUrl: "https://techgiants.com",
        position: "Senior Full Stack Developer",
        jobSource: "LinkedIn",
        jobType: "full_time",
        workSystem: "remote",
        salaryMin: BigInt(120000),
        salaryMax: BigInt(150000),
        location: "San Francisco, CA",
        date: new Date("2023-10-15"),
        status: "hr_interview",
        resultStatus: "pending",
        contactName: "Jane HR Manager",
        contactEmail: "hr@techgiants.com",
        contactPhone: "+1234567890",
        followUpDate: new Date("2023-10-25"),
        followUpNote: "Follow up after technical interview",
        jobUrl: "https://techgiants.com/careers/senior-dev",
        notes: "Great company culture and benefits package",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.application.create({
      data: {
        userId: users[1].id,
        companyName: "Design Studio",
        companyUrl: "https://designstudio.com",
        position: "Lead UI/UX Designer",
        jobSource: "Company Website",
        jobType: "full_time",
        workSystem: "hybrid",
        salaryMin: BigInt(100000),
        salaryMax: BigInt(130000),
        location: "New York, NY",
        date: new Date("2023-11-01"),
        status: "submitted",
        resultStatus: "pending",
        contactName: "John Creative Director",
        contactEmail: "jobs@designstudio.com",
        jobUrl: "https://designstudio.com/careers/lead-designer",
        notes: "Focus on mobile app design",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.application.create({
      data: {
        userId: users[2].id,
        companyName: "StartupXYZ",
        position: "Product Manager",
        jobSource: "Referral",
        jobType: "full_time",
        workSystem: "remote",
        salaryMin: BigInt(110000),
        salaryMax: BigInt(140000),
        location: "Remote",
        date: new Date("2023-09-20"),
        status: "rejected",
        resultStatus: "failed",
        contactName: "Sarah CEO",
        contactEmail: "sarah@startupxyz.com",
        notes: "Not enough experience with SaaS products",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create Application Letters
  await Promise.all([
    prisma.applicationLetter.create({
      data: {
        userId: users[0].id,
        templateId: templates[1].id,
        name: "John Doe",
        birthPlaceDate: "New York, January 15, 1995",
        gender: "male",
        maritalStatus: "single",
        education: "Bachelor of Computer Science",
        phone: "+1234567890",
        email: "john@example.com",
        address: "123 Main St, New York, NY",
        subject: "Application for Senior Full Stack Developer Position",
        applicantCity: "New York",
        applicationDate: "October 15, 2023",
        receiverTitle: "Hiring Manager",
        companyName: "Tech Giants Inc.",
        companyCity: "San Francisco",
        companyAddress: "123 Tech Street, San Francisco, CA",
        openingParagraph:
          "I am writing to express my interest in the Senior Full Stack Developer position at Tech Giants Inc.",
        bodyParagraph:
          "With over 5 years of experience in full stack development, I have a strong background in React, Node.js, and cloud technologies.",
        attachments: "Resume, Portfolio, Certifications",
        closingParagraph:
          "Thank you for considering my application. I look forward to discussing how my skills and experience align with your needs.",
        signature: "John Doe",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.applicationLetter.create({
      data: {
        userId: users[1].id,
        templateId: templates[1].id,
        name: "Jane Smith",
        birthPlaceDate: "Los Angeles, March 22, 1996",
        gender: "female",
        maritalStatus: "single",
        education: "Bachelor of Graphic Design",
        phone: "+1234567891",
        email: "jane@example.com",
        address: "456 Oak Ave, San Francisco, CA",
        subject: "Application for Lead UI/UX Designer Position",
        applicantCity: "San Francisco",
        applicationDate: "November 1, 2023",
        receiverTitle: "Creative Director",
        companyName: "Design Studio",
        companyCity: "New York",
        companyAddress: "456 Design Ave, New York, NY",
        openingParagraph:
          "I am excited to apply for the Lead UI/UX Designer position at Design Studio.",
        bodyParagraph:
          "My experience in designing user-centered interfaces for mobile and web applications aligns perfectly with your requirements.",
        attachments: "Resume, Portfolio, Design Samples",
        closingParagraph:
          "I am eager to contribute my design expertise to your team and help create exceptional user experiences.",
        signature: "Jane Smith",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.applicationLetter.create({
      data: {
        userId: users[2].id,
        templateId: templates[1].id,
        name: "Admin User",
        birthPlaceDate: "Chicago, July 10, 1990",
        gender: "male",
        maritalStatus: "married",
        education: "Master of Business Administration",
        phone: "+1234567892",
        email: "admin@example.com",
        address: "789 Pine Rd, Chicago, IL",
        subject: "Application for Product Manager Position",
        applicantCity: "Chicago",
        applicationDate: "September 20, 2023",
        receiverTitle: "CEO",
        companyName: "StartupXYZ",
        openingParagraph:
          "I am writing to express my strong interest in the Product Manager position at StartupXYZ.",
        bodyParagraph:
          "With my extensive experience in project management and product development, I am confident in my ability to drive product success.",
        attachments: "Resume, Certifications, Project Portfolio",
        closingParagraph:
          "I look forward to the opportunity to discuss how my leadership skills can benefit your organization.",
        signature: "Admin User",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create Blogs
  const blogs = await Promise.all([
    prisma.blog.create({
      data: {
        userId: users[0].id,
        categoryId: blogCategories[0].id,
        title: "Getting Started with React Hooks",
        slug: "getting-started-with-react-hooks",
        excerpt:
          "Learn the basics of React Hooks and how to use them in your applications.",
        content:
          "React Hooks revolutionized the way we write React components. In this article, we will explore the basic hooks like useState and useEffect...",
        featuredImage: "https://example.com/react-hooks.jpg",
        status: "published",
        readTime: 8,
        views: 1250,
        publishedAt: new Date("2023-10-01"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.blog.create({
      data: {
        userId: users[1].id,
        categoryId: blogCategories[1].id,
        title: "Building a Strong Design Portfolio",
        slug: "building-a-strong-design-portfolio",
        excerpt:
          "Tips and tricks for creating an impressive design portfolio that stands out.",
        content:
          "A well-crafted design portfolio is essential for showcasing your skills and attracting potential clients or employers...",
        featuredImage: "https://example.com/design-portfolio.jpg",
        status: "published",
        readTime: 6,
        views: 890,
        publishedAt: new Date("2023-11-05"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.blog.create({
      data: {
        userId: users[2].id,
        categoryId: blogCategories[2].id,
        title: "Principles of User-Centered Design",
        slug: "principles-of-user-centered-design",
        excerpt:
          "Understanding the core principles of user-centered design and how to apply them.",
        content:
          "User-centered design puts the needs and preferences of users at the forefront of the design process...",
        featuredImage: "https://example.com/ucd-principles.jpg",
        status: "draft",
        readTime: 10,
        views: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create Blog Tag Relations
  await Promise.all([
    prisma.blogTagRelation.create({
      data: {
        blogId: blogs[0].id,
        tagId: blogTags[0].id, // JavaScript
      },
    }),
    prisma.blogTagRelation.create({
      data: {
        blogId: blogs[0].id,
        tagId: blogTags[1].id, // React
      },
    }),
    prisma.blogTagRelation.create({
      data: {
        blogId: blogs[1].id,
        tagId: blogTags[1].id, // React
      },
    }),
    prisma.blogTagRelation.create({
      data: {
        blogId: blogs[2].id,
        tagId: blogTags[2].id, // Node.js
      },
    }),
  ]);

  // Create OTPs
  await Promise.all([
    prisma.otp.create({
      data: {
        userId: users[0].id,
        code: "123456",
        purpose: "login_verification",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.otp.create({
      data: {
        userId: users[1].id,
        code: "789012",
        purpose: "login_verification",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.otp.create({
      data: {
        userId: users[2].id,
        code: "345678",
        purpose: "login_verification",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  console.log("Seeding finished.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
