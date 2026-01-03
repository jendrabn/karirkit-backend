import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Platform, PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcrypt";
import provinces from "../src/data/provinces.json";
import cities from "../src/data/cities.json";
import jobRoles from "../src/data/job_roles.json";

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
  await prisma.cvProject.deleteMany();
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
  await prisma.city.deleteMany();
  await prisma.province.deleteMany();
  await prisma.job.deleteMany();
  await prisma.jobRole.deleteMany();
  await prisma.company.deleteMany();

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
        headline: "Full Stack Developer & Tech Enthusiast",
        bio: "Passionate full stack developer with expertise in React, Node.js, and cloud technologies. Love building scalable applications and solving complex problems.",
        location: "San Francisco, CA",
        gender: "male",
        birthDate: new Date("1990-05-15"),
        avatar:
          "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80",
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
        headline: "Senior UI/UX Designer & Creative Director",
        bio: "Creative designer with a passion for creating beautiful and functional user experiences. Specialized in mobile and web design.",
        location: "New York, NY",
        gender: "female",
        birthDate: new Date("1992-08-22"),
        avatar:
          "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=400&q=80",
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
        headline: "System Administrator & Project Manager",
        bio: "Experienced project manager and system administrator with a focus on scalable infrastructure and team leadership.",
        location: "Chicago, IL",
        gender: "male",
        birthDate: new Date("1985-03-10"),
        avatar:
          "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
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
        type: "cv",
        language: "en",
        path: "/templates/cv/modern.docx",
        preview:
          "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&q=80&w=400",
        isPremium: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.template.create({
      data: {
        name: "Classic Application Letter",
        type: "application_letter",
        language: "en",
        path: "/templates/letter/classic.docx",
        preview:
          "https://images.unsplash.com/photo-1635350736475-c8cef4b21906?auto=format&fit=crop&q=80&w=400",
        isPremium: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.template.create({
      data: {
        name: "Creative CV Template",
        type: "cv",
        language: "id",
        path: "/templates/cv/creative.docx",
        preview:
          "https://images.unsplash.com/photo-1512486130939-2c4f79935e4f?auto=format&fit=crop&q=80&w=400",
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
        photo:
          "https://images.unsplash.com/photo-1511367461989-f85a21fda167?auto=format&fit=crop&w=600&q=80",
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
        photo:
          "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80",
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
        photo:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80",
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
        cvId: cvs[0].id,
        degree: "high_school",
        schoolName: "Tech High School",
        schoolLocation: "San Francisco, CA",
        major: "Science and Mathematics",
        startMonth: 9,
        startYear: 2011,
        endMonth: 6,
        endYear: 2015,
        isCurrent: false,
        gpa: 3.9,
        description: "Advanced placement courses in computer science",
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
        cvId: cvs[1].id,
        degree: "associate_d3",
        schoolName: "Art and Design College",
        schoolLocation: "Los Angeles, CA",
        major: "Digital Design",
        startMonth: 9,
        startYear: 2014,
        endMonth: 6,
        endYear: 2016,
        isCurrent: false,
        gpa: 3.7,
        description: "Foundation in digital arts and design principles",
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
    prisma.cvEducation.create({
      data: {
        cvId: cvs[2].id,
        degree: "doctorate",
        schoolName: "International Business University",
        schoolLocation: "London, UK",
        major: "Strategic Management",
        startMonth: 9,
        startYear: 2020,
        endMonth: 6,
        endYear: 2024,
        isCurrent: false,
        gpa: 4.0,
        description: "Research in organizational leadership and innovation",
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
        platform: Platform.linkedin,
        url: "https://linkedin.com/in/johndoe",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSocialLink.create({
      data: {
        cvId: cvs[0].id,
        platform: Platform.github,
        url: "https://github.com/johndoe",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSocialLink.create({
      data: {
        cvId: cvs[1].id,
        platform: Platform.linkedin,
        url: "https://linkedin.com/in/janesmith",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSocialLink.create({
      data: {
        cvId: cvs[1].id,
        platform: Platform.dribbble,
        url: "https://dribbble.com/janesmith",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSocialLink.create({
      data: {
        cvId: cvs[2].id,
        platform: Platform.linkedin,
        url: "https://linkedin.com/in/adminuser",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvSocialLink.create({
      data: {
        cvId: cvs[2].id,
        platform: Platform.x,
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

  // Create CV Projects
  await Promise.all([
    prisma.cvProject.create({
      data: {
        cvId: cvs[0].id,
        name: "Analytics Dashboard",
        description:
          "Built a real-time analytics dashboard for operations.\nImplemented role-based access and drill-down reports.",
        year: 2022,
        repoUrl: "https://github.com/johndoe/analytics-dashboard",
        liveUrl: "https://analytics.example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvProject.create({
      data: {
        cvId: cvs[1].id,
        name: "Design System Revamp",
        description:
          "Created a scalable design system for web and mobile.\nStandardized components and typography guidelines.",
        year: 2023,
        repoUrl: "https://github.com/janesmith/design-system",
        liveUrl: "https://designsystem.example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.cvProject.create({
      data: {
        cvId: cvs[2].id,
        name: "PMO Reporting Suite",
        description:
          "Launched KPI reporting suite for executive stakeholders.\nAutomated monthly reporting pipeline.",
        year: 2021,
        repoUrl: "https://github.com/adminuser/pmo-reporting",
        liveUrl: "https://reports.example.com",
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
        cover:
          "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
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
        cover:
          "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
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
        cover:
          "https://images.unsplash.com/photo-1489533119213-1c3f3c0ad5a0?auto=format&fit=crop&w=1200&q=80",
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
        path:
          "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1100&q=80",
        caption: "Homepage design",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioMedia.create({
      data: {
        portfolioId: portfolios[0].id,
        path:
          "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1100&q=80",
        caption: "Product listing page",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioMedia.create({
      data: {
        portfolioId: portfolios[1].id,
        path:
          "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1100&q=80",
        caption: "Login screen",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioMedia.create({
      data: {
        portfolioId: portfolios[1].id,
        path:
          "https://images.unsplash.com/photo-1493119508027-2b584f234d6c?auto=format&fit=crop&w=1100&q=80",
        caption: "Dashboard design",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioMedia.create({
      data: {
        portfolioId: portfolios[2].id,
        path:
          "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1100&q=80",
        caption: "Project overview",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.portfolioMedia.create({
      data: {
        portfolioId: portfolios[2].id,
        path:
          "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1100&q=80",
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
        featuredImage:
          "https://images.unsplash.com/photo-1488998527040-85054a85150e?auto=format&fit=crop&w=1200&q=80",
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
        featuredImage:
          "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1200&q=80",
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
        featuredImage:
          "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1200&q=80",
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

  // Create User Social Links
  await Promise.all([
    // John Doe's social links
    prisma.userSocialLink.create({
      data: {
        userId: users[0].id,
        platform: "linkedin",
        url: "https://linkedin.com/in/johndoe",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.userSocialLink.create({
      data: {
        userId: users[0].id,
        platform: "github",
        url: "https://github.com/johndoe",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.userSocialLink.create({
      data: {
        userId: users[0].id,
        platform: "x",
        url: "https://twitter.com/johndoe",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.userSocialLink.create({
      data: {
        userId: users[0].id,
        platform: "website",
        url: "https://johndoe.dev",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    // Jane Smith's social links
    prisma.userSocialLink.create({
      data: {
        userId: users[1].id,
        platform: "linkedin",
        url: "https://linkedin.com/in/janesmith",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.userSocialLink.create({
      data: {
        userId: users[1].id,
        platform: "dribbble",
        url: "https://dribbble.com/janesmith",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.userSocialLink.create({
      data: {
        userId: users[1].id,
        platform: "behance",
        url: "https://behance.net/janesmith",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.userSocialLink.create({
      data: {
        userId: users[1].id,
        platform: "instagram",
        url: "https://instagram.com/janesmith.design",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    // Admin User's social links
    prisma.userSocialLink.create({
      data: {
        userId: users[2].id,
        platform: "linkedin",
        url: "https://linkedin.com/in/adminuser",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.userSocialLink.create({
      data: {
        userId: users[2].id,
        platform: "x",
        url: "https://twitter.com/adminuser",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.userSocialLink.create({
      data: {
        userId: users[2].id,
        platform: "medium",
        url: "https://medium.com/@adminuser",
        createdAt: new Date(),
        updatedAt: new Date(),
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

  // Seed Provinces
  console.log("Seeding provinces...");
  const provinceMap = new Map();

  for (const province of provinces) {
    const createdProvince = await prisma.province.create({
      data: {
        id: province.id,
        name: province.name,
      },
    });
    provinceMap.set(province.id, createdProvince);
  }

  // Seed Cities
  console.log("Seeding cities...");
  for (const city of cities) {
    await prisma.city.create({
      data: {
        id: city.id,
        provinceId: city.province_id,
        name: city.name,
      },
    });
  }

  // Create Companies
  console.log("Seeding companies...");
  const companies = await Promise.all([
    prisma.company.create({
      data: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Tech Solutions Indonesia",
        slug: "tech-solutions-indonesia",
        description:
          "Perusahaan teknologi terkemuka di Indonesia yang fokus pada pengembangan solusi digital inovatif",
        logo:
          "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=600&q=80",
        employeeSize: "fifty_one_to_two_hundred",
        businessSector: "Technology",
        websiteUrl: "https://techsolutions.co.id",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.company.create({
      data: {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Digital Creative Agency",
        slug: "digital-creative-agency",
        description:
          "Agency kreatif digital yang menyediakan layanan desain dan pengembangan web",
        logo:
          "https://images.unsplash.com/photo-1487017159836-4e23ece2e4cf?auto=format&fit=crop&w=600&q=80",
        employeeSize: "eleven_to_fifty",
        businessSector: "Design & Creative",
        websiteUrl: "https://digitalcreative.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.company.create({
      data: {
        id: "550e8400-e29b-41d4-a716-446655440002",
        name: "FinTech Innovations",
        slug: "fintech-innovations",
        description:
          "Startup fintech yang mengembangkan solusi pembayaran digital untuk UMKM",
        logo:
          "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=600&q=80",
        employeeSize: "one_to_ten",
        businessSector: "Financial Technology",
        websiteUrl: "https://fintechinnovations.id",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ]);

  // Create Job Roles
  console.log("Seeding job roles...");
  const createdJobRoles = await Promise.all(
    jobRoles.map((role) =>
      prisma.jobRole.create({
        data: {
          name: role.name,
          slug: role.name
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^\w-]/g, ""),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
    )
  );

  // Create Jobs
  console.log("Seeding jobs...");
  await Promise.all([
    prisma.job.create({
      data: {
        id: "550e8400-e29b-41d4-a716-446655440020",
        companyId: companies[0].id,
        jobRoleId: createdJobRoles[0].id,
        cityId: "1", // Jakarta
        title: "Senior Front-End Web Developer",
        slug: "senior-front-end-web-developer",
        jobType: "full_time",
        workSystem: "hybrid",
        educationLevel: "bachelor",
        minYearsOfExperience: 3,
        maxYearsOfExperience: 5,
        description:
          "Kami mencari Senior Front-End Web Developer yang berpengalaman dalam mengembangkan aplikasi web modern dengan React.js. Anda akan bertanggung jawab atas pengembangan UI yang responsif dan interaktif, serta berkolaborasi dengan tim back-end untuk mengintegrasikan API.",
        requirements:
          "• Pengalaman minimal 3 tahun dengan React.js\n• Mahir dengan TypeScript dan JavaScript ES6+\n• Pengalaman dengan state management (Redux, Context API)\n• Familiar dengan RESTful API dan GraphQL\n• Memahami prinsip responsive design\n• Pengalaman dengan testing (Jest, React Testing Library)\n• Kemampuan komunikasi yang baik",
        salaryMin: BigInt(15000000),
        salaryMax: BigInt(25000000),
        talentQuota: 2,
        jobUrl:
          "https://techsolutions.co.id/careers/senior-front-end-developer",
        contactName: "HR Tech Solutions",
        contactEmail: "hr@techsolutions.co.id",
        contactPhone: "+6221-2345-6789",
        medias: {
          create: [
            {
            path:
              "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1000&q=80",
            },
          ],
        },
        status: "published",
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.job.create({
      data: {
        id: "550e8400-e29b-41d4-a716-446655440021",
        companyId: companies[1].id,
        jobRoleId: createdJobRoles[3].id,
        cityId: "2", // Surabaya
        title: "UI/UX Designer",
        slug: "ui-ux-designer",
        jobType: "full_time",
        workSystem: "remote",
        educationLevel: "bachelor",
        minYearsOfExperience: 2,
        maxYearsOfExperience: 4,
        description:
          "Digital Creative Agency mencari UI/UX Designer yang kreatif dan berpengalaman untuk bergabung dengan tim kami. Anda akan bertanggung jawab atas desain antarmuka pengguna untuk berbagai proyek klien.",
        requirements:
          "• Portfolio yang kuat\n• Pengalaman dengan Figma, Sketch, atau Adobe XD\n• Memahami prinsip desain yang berpusat pada pengguna\n• Kemampuan membuat prototipe interaktif\n• Pengalaman dengan user research dan testing\n• Kemampuan berkolaborasi dengan tim pengembang",
        salaryMin: BigInt(12000000),
        salaryMax: BigInt(18000000),
        talentQuota: 1,
        jobUrl: "https://digitalcreative.com/careers/ui-ux-designer",
        contactName: "Creative Director",
        contactEmail: "jobs@digitalcreative.com",
        contactPhone: "+6222-3456-7890",
        medias: {
          create: [
            {
            path:
              "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1000&q=80",
            },
          ],
        },
        status: "published",
        expirationDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.job.create({
      data: {
        id: "550e8400-e29b-41d4-a716-446655440022",
        companyId: companies[2].id,
        jobRoleId: createdJobRoles[2].id,
        cityId: "3", // Bandung
        title: "Full-Stack Developer (FinTech)",
        slug: "full-stack-developer-fintech",
        jobType: "full_time",
        workSystem: "remote",
        educationLevel: "bachelor",
        minYearsOfExperience: 4,
        maxYearsOfExperience: 7,
        description:
          "FinTech Innovations sedang mencari Full-Stack Developer yang berpengalaman dalam mengembangkan solusi keuangan digital. Anda akan bergabung dengan tim inovatif yang sedang mengubah lanskap industri keuangan di Indonesia.",
        requirements:
          "• Pengalaman 4+ tahun dengan Node.js dan Express.js\n• Mahir dengan React.js atau Vue.js\n• Pengalaman dengan database (PostgreSQL, MongoDB)\n• Memahami konsep microservices\n• Pengalaman dengan integrasi payment gateway\n• Familiar dengan cloud services (AWS, GCP)\n• Memahami prinsip keamanan aplikasi keuangan",
        salaryMin: BigInt(20000000),
        salaryMax: BigInt(35000000),
        talentQuota: 3,
        jobUrl: "https://fintechinnovations.id/careers/full-stack-developer",
        contactName: "CTO FinTech Innovations",
        contactEmail: "careers@fintechinnovations.id",
        contactPhone: "+6222-1234-5678",
        medias: {
          create: [
            {
            path:
              "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1000&q=80",
            },
          ],
        },
        status: "published",
        expirationDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
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
