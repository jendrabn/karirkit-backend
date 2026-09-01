import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
let app: typeof import("../../src/index").default;
let SubscriptionService: typeof import("../../src/services/subscription.service").SubscriptionService;

beforeAll(async () => {
    mock.module("../../src/services/subscription.service", () => ({
    SubscriptionService: {
      markFailed: mock(() => {}),
    },
  }));

  ({ default: app } = await import("../../src/index"));
  ({ SubscriptionService } = await import(
    "../../src/services/subscription.service"
  ));
});

describe("PATCH /admin/subscriptions/:id/fail", () => {
  beforeEach(() => {
    mock.clearAllMocks();
  });

  it("marks a subscription as failed", async () => {
    const failMock = SubscriptionService.markFailed;
    failMock.mockResolvedValue(undefined);

    const response = await request(app)
      .patch("/admin/subscriptions/sub-1/fail")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      message: "Subscription marked as failed",
    });
  });
});
