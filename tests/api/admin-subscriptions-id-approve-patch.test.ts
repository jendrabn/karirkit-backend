import request from "supertest";

let app: typeof import("../../src/index").default;
let SubscriptionService: typeof import("../../src/services/subscription.service").SubscriptionService;

beforeAll(async () => {
  jest.resetModules();
  jest.doMock("../../src/services/subscription.service", () => ({
    SubscriptionService: {
      manualApprove: jest.fn(),
    },
  }));

  ({ default: app } = await import("../../src/index"));
  ({ SubscriptionService } = await import(
    "../../src/services/subscription.service"
  ));
});

describe("PATCH /admin/subscriptions/:id/approve", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("approves a subscription manually", async () => {
    const approveMock = jest.mocked(SubscriptionService.manualApprove);
    approveMock.mockResolvedValue(undefined);

    const response = await request(app)
      .patch("/admin/subscriptions/sub-1/approve")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ message: "Subscription approved" });
  });
});
