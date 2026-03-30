import request from "supertest";

let app: typeof import("../../src/index").default;
let SubscriptionService: typeof import("../../src/services/subscription.service").SubscriptionService;

beforeAll(async () => {
  jest.resetModules();
  jest.doMock("../../src/services/subscription.service", () => ({
    SubscriptionService: {
      manualCancel: jest.fn(),
    },
  }));

  ({ default: app } = await import("../../src/index"));
  ({ SubscriptionService } = await import(
    "../../src/services/subscription.service"
  ));
});

describe("PATCH /admin/subscriptions/:id/cancel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("cancels a subscription manually", async () => {
    const cancelMock = jest.mocked(SubscriptionService.manualCancel);
    cancelMock.mockResolvedValue(undefined);

    const response = await request(app)
      .patch("/admin/subscriptions/sub-1/cancel")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ message: "Subscription cancelled" });
  });
});
