import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let SubscriptionService: typeof import("../../src/services/subscription.service").SubscriptionService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/subscription.service", () => ({
      SubscriptionService: {
        cancelSubscription: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ SubscriptionService } = await import(
    "../../src/services/subscription.service"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("DELETE /subscriptions/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("cancels a pending subscription", async () => {
    const cancelMock = jest.mocked(SubscriptionService.cancelSubscription);
    cancelMock.mockResolvedValue(undefined);

    const response = await request(app)
      .delete("/subscriptions/sub-1")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ message: "Subscription cancelled" });
  });
});

describe("DELETE /subscriptions/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }

  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("cancels a pending subscription in the database", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("subscriptions-cancel-pending");
    trackedEmails.add(user.email);

    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "pro",
        status: "pending",
        midtransOrderId: `SUB-${user.id}-${Date.now()}`,
        midtransToken: "snap-token",
        amount: 25000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const token = await createSessionToken(user);
    const response = await request(app)
      .delete(`/subscriptions/${subscription.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ message: "Subscription cancelled" });

    const stored = await prisma.subscription.findUnique({
      where: { id: subscription.id },
    });
    expect(stored?.status).toBe("cancelled");
  });
});
