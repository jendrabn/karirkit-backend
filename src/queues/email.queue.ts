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
  appLogger.error({ error: error.message }, "Email queue connection error");
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
  appLogger.error({ error: error.message }, "Email worker connection error");
});

emailWorker.on("stalled", (jobId) => {
  appLogger.warn({ jobId }, "Email job stalled");
});

emailWorker.on("completed", (job) => {
  appLogger.info({ jobId: job.id, to: job.data.to, subject: job.data.subject }, "Email job completed");
});

emailWorker.on("failed", (job, error) => {
  appLogger.error({ jobId: job?.id, error: error.message, to: job?.data.to, subject: job?.data.subject }, "Email job failed");
});

export const enqueueEmail = async (data: EmailJobData): Promise<void> => {
  await emailQueue.add("send-email", data);
};

export default emailQueue;
