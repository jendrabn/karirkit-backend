import request from "supertest";

let app: typeof import("../../src/index").default;
let SubscriptionService: typeof import("../../src/services/subscription.service").SubscriptionService;

beforeAll(async () => {
  jest.resetModules();
  jest.doMock("../../src/services/subscription.service", () => ({
    SubscriptionService: {
      createManualSubscription: jest.fn(),
    },
  }));

  ({ default: app } = await import("../../src/index"));
  ({ SubscriptionService } = await import(
    "../../src/services/subscription.service"
  ));
});

describe("POST /admin/subscriptions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a manual subscription for admins", async () => {
    const createMock = jest.mocked(SubscriptionService.createManualSubscription);
    createMock.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      user: {
        id: "user-1",
        name: "User",
        email: "user@example.com",
        phone: null,
      },
      plan: "pro",
      status: "paid",
      amount: 25000,
      midtransOrderId: "MANUAL-user-1-123",
      midtransToken: null,
      midtransPaymentType: null,
      paidAt: "2026-03-01T00:00:00.000Z",
      expiresAt: "2026-04-01T00:00:00.000Z",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    } as never);

    const response = await request(app)
      .post("/admin/subscriptions")
      .set("Authorization", "Bearer admin-token")
      .send({
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        plan: "pro",
        status: "paid",
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      id: "sub-1",
      plan: "pro",
      status: "paid",
    });
  });
});
