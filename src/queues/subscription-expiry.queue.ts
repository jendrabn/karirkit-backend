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

const subscriptionExpiryQueue = new Queue<SubscriptionExpiryJobData>(queueName, {
  connection,
});

subscriptionExpiryQueue.on("error", (error) => {
  appLogger.error("Subscription expiry queue connection error", {
    error: error.message,
  });
});

const subscriptionExpiryWorker = new Worker<SubscriptionExpiryJobData>(queueName, async () => {
  const result = await SubscriptionService.expireSubscriptions();

  if (result.expired_count > 0) {
    appLogger.info("Expired subscriptions processed", result);
  }

  return result;
}, {
  connection,
});

subscriptionExpiryWorker.on("error", (error) => {
  appLogger.error("Subscription expiry worker connection error", {
    error: error.message,
  });
});

subscriptionExpiryWorker.on("completed", (job, result) => {
  appLogger.info("Subscription expiry job completed", {
    jobId: job.id,
    result,
  });
});

subscriptionExpiryWorker.on("failed", (job, error) => {
  appLogger.error("Subscription expiry job failed", {
    jobId: job?.id,
    error: error.message,
  });
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
    }
  )
  .catch((error) => {
    appLogger.error("Failed to schedule subscription expiry job", {
      error: error.message,
    });
  });

export default subscriptionExpiryQueue;
