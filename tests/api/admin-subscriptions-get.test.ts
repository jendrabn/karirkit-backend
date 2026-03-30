import request from "supertest";

let app: typeof import("../../src/index").default;
let SubscriptionService: typeof import("../../src/services/subscription.service").SubscriptionService;

beforeAll(async () => {
  jest.resetModules();
  jest.doMock("../../src/services/subscription.service", () => ({
    SubscriptionService: {
      listAdminSubscriptions: jest.fn(),
    },
  }));

  ({ default: app } = await import("../../src/index"));
  ({ SubscriptionService } = await import(
    "../../src/services/subscription.service"
  ));
});

describe("GET /admin/subscriptions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists subscriptions for admins", async () => {
    const listMock = jest.mocked(SubscriptionService.listAdminSubscriptions);
    listMock.mockResolvedValue({
      items: [
        {
          id: "sub-1",
          userId: "user-1",
          plan: "pro",
          status: "paid",
          amount: 25000,
        },
      ],
      pagination: { page: 1, per_page: 20, total_items: 1, total_pages: 1 },
    } as never);

    const response = await request(app)
      .get("/admin/subscriptions")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body.data.items[0]).toMatchObject({
      id: "sub-1",
      user_id: "user-1",
      plan: "pro",
      status: "paid",
    });
    expect(response.body.data.pagination.total_items).toBe(1);
  });

  it("returns 403 when a non-admin lists subscriptions", async () => {
    const response = await request(app)
      .get("/admin/subscriptions")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });
});
