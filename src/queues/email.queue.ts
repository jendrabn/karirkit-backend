import { Queue, Worker, type Job } from "bullmq";
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

const queueName = "email_queue";
const connection = {
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password,
  username: env.redis.username,
  db: env.redis.db,
  maxRetriesPerRequest: null,
};

const emailQueue = new Queue<EmailJobData>(queueName, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

emailQueue.on("error", (error) => {
  appLogger.error("Email queue connection error", {
    error: error.message,
  });
});

const processEmailJob = async (job: Job<EmailJobData>): Promise<void> => {
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
};

const emailWorker = new Worker<EmailJobData>(queueName, processEmailJob, {
  connection,
});

emailWorker.on("error", (error) => {
  appLogger.error("Email worker connection error", {
    error: error.message,
  });
});

emailWorker.on("stalled", (jobId) => {
  appLogger.warn("Email job stalled", {
    jobId,
  });
});

emailWorker.on("completed", (job) => {
  appLogger.info("Email job completed", {
    jobId: job.id,
    to: job.data.to,
    subject: job.data.subject,
  });
});

emailWorker.on("failed", (job, error) => {
  appLogger.error("Email job failed", {
    jobId: job?.id,
    error: error.message,
    to: job?.data.to,
    subject: job?.data.subject,
  });
});

export const enqueueEmail = async (data: EmailJobData): Promise<void> => {
  await emailQueue.add("send-email", data);
};

export default emailQueue;
