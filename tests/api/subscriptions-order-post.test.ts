import request from "supertest";

let app: typeof import("../../src/index").default;
let SubscriptionService: typeof import("../../src/services/subscription.service").SubscriptionService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  jest.doMock("../../src/services/subscription.service", () => ({
    SubscriptionService: {
      createSubscriptionOrder: jest.fn(),
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

describe("POST /subscriptions/order", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a subscription order", async () => {
    const createOrderMock = jest.mocked(SubscriptionService.createSubscriptionOrder);
    createOrderMock.mockResolvedValue({
      subscriptionId: "sub-1",
      orderId: "SUB-user-1-123",
      snapToken: "snap-token",
      snapUrl: "https://app.sandbox.midtrans.com/snap/v2/vtweb/token",
      amount: 25000,
      plan: "pro",
    } as never);

    const response = await request(app)
      .post("/subscriptions/order")
      .set("Authorization", "Bearer user-token")
      .send({ planId: "pro" });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      subscription_id: "sub-1",
      order_id: "SUB-user-1-123",
      amount: 25000,
      plan: "pro",
    });
  });

  it("propagates order creation errors", async () => {
    const createOrderMock = jest.mocked(SubscriptionService.createSubscriptionOrder);
    createOrderMock.mockRejectedValue(
      new ResponseErrorClass(400, "Plan Free tidak memerlukan pembayaran")
    );

    const response = await request(app)
      .post("/subscriptions/order")
      .set("Authorization", "Bearer user-token")
      .send({ planId: "free" });

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe(
      "Plan Free tidak memerlukan pembayaran"
    );
  });
});
