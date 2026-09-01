import { Queue, Worker } from "bullmq";
import env from "../config/env.config";
import { appLogger } from "../middleware/logger.middleware";
import { SubscriptionService } from "../services/subscription.service";

type SubscriptionExpiryJobData = Record<string, never>;

const queueName = "subscription_expiry_queue";
const connection = {
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password,
  username: env.redis.username,
  db: env.redis.db,
  maxRetriesPerRequest: null,
};

const subscriptionExpiryQueue = new Queue<SubscriptionExpiryJobData>(
  queueName,
  {
    connection,
  },
);

subscriptionExpiryQueue.on("error", (error) => {
  appLogger.error({ error: error.message }, "Subscription expiry queue connection error");
});

const subscriptionExpiryWorker = new Worker<SubscriptionExpiryJobData>(
  queueName,
  async () => {
    const result = await SubscriptionService.expireSubscriptions();

    if (result.expired_count > 0) {
      appLogger.info(result, "Expired subscriptions processed");
    }

    return result;
  },
  {
    connection,
  },
);

subscriptionExpiryWorker.on("error", (error) => {
  appLogger.error({ error: error.message }, "Subscription expiry worker connection error");
});

subscriptionExpiryWorker.on("completed", (job, result) => {
  appLogger.info({ jobId: job.id, result }, "Subscription expiry job completed");
});

subscriptionExpiryWorker.on("failed", (job, error) => {
  appLogger.error({ jobId: job?.id, error: error.message }, "Subscription expiry job failed");
});

void subscriptionExpiryQueue
  .add(
    "expire-subscriptions",
    {},
    {
      jobId: "subscription-expiry-daily",
      repeat: {
        pattern: "0 0 * * *",
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  )
  .catch((error) => {
    appLogger.error({ error: error.message }, "Failed to schedule subscription expiry job");
  });

export default subscriptionExpiryQueue;
