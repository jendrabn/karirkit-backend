import request from "supertest";

let app: typeof import("../../src/index").default;
let SubscriptionService: typeof import("../../src/services/subscription.service").SubscriptionService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  jest.doMock("../../src/services/subscription.service", () => ({
    SubscriptionService: {
      getAdminSubscription: jest.fn(),
    },
  }));

  ({ default: app } = await import("../../src/index"));
  ({ SubscriptionService } = await import(
    "../../src/services/subscription.service"
  ));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

describe("GET /admin/subscriptions/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns subscription detail for admins", async () => {
    const getMock = jest.mocked(SubscriptionService.getAdminSubscription);
    getMock.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      user: {
        id: "user-1",
        name: "User",
        email: "user@example.com",
        phone: null,
      },
      plan: "max",
      status: "pending",
      amount: 50000,
      midtransOrderId: "SUB-user-1-123",
      midtransToken: "token",
      midtransPaymentType: null,
      paidAt: null,
      expiresAt: null,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    } as never);

    const response = await request(app)
      .get("/admin/subscriptions/sub-1")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: "sub-1",
      plan: "max",
      status: "pending",
    });
  });

  it("propagates admin detail errors", async () => {
    const getMock = jest.mocked(SubscriptionService.getAdminSubscription);
    getMock.mockRejectedValue(
      new ResponseErrorClass(404, "Subscription tidak ditemukan")
    );

    const response = await request(app)
      .get("/admin/subscriptions/sub-missing")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(404);
    expect(response.body.errors.general[0]).toBe("Subscription tidak ditemukan");
  });
});
