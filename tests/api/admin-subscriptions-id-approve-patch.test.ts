import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
let app: typeof import("../../src/index").default;
let SubscriptionService: typeof import("../../src/services/subscription.service").SubscriptionService;

beforeAll(async () => {
    mock.module("../../src/services/subscription.service", () => ({
    SubscriptionService: {
      manualApprove: mock(() => {}),
    },
  }));

  ({ default: app } = await import("../../src/index"));
  ({ SubscriptionService } = await import(
    "../../src/services/subscription.service"
  ));
});

describe("PATCH /admin/subscriptions/:id/approve", () => {
  beforeEach(() => {
    mock.clearAllMocks();
  });

  it("approves a subscription manually", async () => {
    const approveMock = SubscriptionService.manualApprove;
    approveMock.mockResolvedValue(undefined);

    const response = await request(app)
      .patch("/admin/subscriptions/sub-1/approve")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ message: "Subscription approved" });
  });
});
