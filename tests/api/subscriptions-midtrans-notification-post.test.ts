import request from "supertest";

let app: typeof import("../../src/index").default;
let SubscriptionService: typeof import("../../src/services/subscription.service").SubscriptionService;

beforeAll(async () => {
  jest.resetModules();
  jest.doMock("../../src/services/subscription.service", () => ({
    SubscriptionService: {
      handleMidtransNotification: jest.fn(),
    },
  }));

  ({ default: app } = await import("../../src/index"));
  ({ SubscriptionService } = await import(
    "../../src/services/subscription.service"
  ));
});

describe("POST /subscriptions/midtrans/notification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts Midtrans notification without authentication", async () => {
    const notificationMock = jest.mocked(
      SubscriptionService.handleMidtransNotification
    );
    notificationMock.mockResolvedValue(undefined);

    const response = await request(app)
      .post("/subscriptions/midtrans/notification")
      .send({
        order_id: "SUB-user-1-123",
        transaction_status: "settlement",
        gross_amount: "25000.00",
        signature_key: "signature",
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ message: "OK" });
  });
});
