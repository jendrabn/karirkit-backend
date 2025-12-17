import nodemailer, { SendMailOptions as NodemailerOptions } from "nodemailer";
import env from "../config/env.config";
import { appLogger } from "../middleware/logger.middleware";
import path from "path";
import fs from "fs";

export interface SendMailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  attachments?: NodemailerOptions["attachments"];
}

const isSecure = env.mail.encryption === "ssl";

const transporter = nodemailer.createTransport({
  host: env.mail.host,
  port: env.mail.port,
  secure: isSecure,
  auth:
    env.mail.username && env.mail.password
      ? {
          user: env.mail.username,
          pass: env.mail.password,
        }
      : undefined,
  tls:
    env.mail.encryption === "tls"
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
});

export const sendMail = async (options: SendMailOptions): Promise<void> => {
  // Default attachments include logo if not provided
  const defaultAttachments = options.attachments || [];

  // Add logo as attachment if not already included
  const hasLogo = defaultAttachments.some((att) => att.cid === "logo");
  if (!hasLogo) {
    const logoPath = path.join(process.cwd(), "public", "images", "logo.png");
    if (fs.existsSync(logoPath)) {
      defaultAttachments.push({
        filename: "logo.png",
        path: logoPath,
        cid: "logo",
      });
    }
  }

  const mailOptions: NodemailerOptions = {
    from: options.from ?? `${env.mail.fromName} <${env.mail.fromAddress}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    attachments: defaultAttachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    appLogger.info("Email sent successfully", {
      to: options.to,
      subject: options.subject,
      messageId: info.messageId,
      response: info.response,
    });
  } catch (error) {
    appLogger.error("Failed to send email", {
      error: (error as Error).message,
      to: options.to,
      subject: options.subject,
    });
    throw error;
  }
};
