import Bull from "bull";
import env from "../config/env.config";
import { sendMail } from "../utils/email.util";
import { renderMailTemplate } from "../utils/mail-template.util";
import { appLogger } from "../middleware/logger.middleware";

export interface EmailJobData {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  context?: Record<string, unknown>;
  attachments?: any[];
}

const emailQueue = new Bull<EmailJobData>("email_queue", {
  redis: {
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
    username: env.redis.username,
    db: env.redis.db,
  },
});

emailQueue.on("error", (error) => {
  appLogger.error("Email queue connection error", {
    error: error.message,
  });
});

emailQueue.on("stalled", (job) => {
  appLogger.warn("Email job stalled", {
    jobId: job.id,
  });
});

emailQueue.process(async (job) => {
  const { to, subject, text, html, template, context } = job.data;
  let finalHtml = html;

  if (!finalHtml && template) {
    finalHtml = await renderMailTemplate(template, context ?? {});
  }

  await sendMail({
    to,
    subject,
    text,
    html: finalHtml,
    attachments: job.data.attachments,
  });
});

emailQueue.on("completed", (job) => {
  appLogger.info("Email job completed", {
    jobId: job.id,
    to: job.data.to,
    subject: job.data.subject,
  });
});

emailQueue.on("failed", (job, error) => {
  appLogger.error("Email job failed", {
    jobId: job?.id,
    error: error.message,
    to: job?.data.to,
    subject: job?.data.subject,
  });
});

export const enqueueEmail = async (data: EmailJobData): Promise<void> => {
  await emailQueue.add(data, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  });
};

export default emailQueue;
