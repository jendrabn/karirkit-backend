import request from "supertest";

let app: typeof import("../../src/index").default;
let SubscriptionService: typeof import("../../src/services/subscription.service").SubscriptionService;

beforeAll(async () => {
  jest.resetModules();
  jest.doMock("../../src/services/subscription.service", () => ({
    SubscriptionService: {
      forceDowngradeToFree: jest.fn(),
    },
  }));

  ({ default: app } = await import("../../src/index"));
  ({ SubscriptionService } = await import(
    "../../src/services/subscription.service"
  ));
});

describe("PATCH /admin/subscriptions/users/:userId/downgrade", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forces a user downgrade to free", async () => {
    const downgradeMock = jest.mocked(SubscriptionService.forceDowngradeToFree);
    downgradeMock.mockResolvedValue(undefined);

    const response = await request(app)
      .patch(
        "/admin/subscriptions/users/550e8400-e29b-41d4-a716-446655440000/downgrade"
      )
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ message: "User downgraded to Free" });
  });
});
