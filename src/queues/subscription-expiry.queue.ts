import Bull from "bull";
import env from "../config/env.config";
import { appLogger } from "../middleware/logger.middleware";
import { SubscriptionService } from "../services/subscription.service";

const subscriptionExpiryQueue = new Bull("subscription_expiry_queue", {
  redis: {
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
    username: env.redis.username,
    db: env.redis.db,
  },
});

subscriptionExpiryQueue.on("error", (error) => {
  appLogger.error("Subscription expiry queue connection error", {
    error: error.message,
  });
});

subscriptionExpiryQueue.process(async () => {
  const result = await SubscriptionService.expireSubscriptions();

  if (result.expired_count > 0) {
    appLogger.info("Expired subscriptions processed", result);
  }

  return result;
});

void subscriptionExpiryQueue
  .add(
    {},
    {
      jobId: "subscription-expiry-daily",
      repeat: {
        cron: "0 0 * * *",
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
