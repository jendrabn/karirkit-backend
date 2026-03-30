import request from "supertest";

let app: typeof import("../../src/index").default;
let SubscriptionService: typeof import("../../src/services/subscription.service").SubscriptionService;

beforeAll(async () => {
  jest.resetModules();
  jest.doMock("../../src/services/subscription.service", () => ({
    SubscriptionService: {
      markFailed: jest.fn(),
    },
  }));

  ({ default: app } = await import("../../src/index"));
  ({ SubscriptionService } = await import(
    "../../src/services/subscription.service"
  ));
});

describe("PATCH /admin/subscriptions/:id/fail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("marks a subscription as failed", async () => {
    const failMock = jest.mocked(SubscriptionService.markFailed);
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
