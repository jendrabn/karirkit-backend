import crypto from "crypto";

const userFindUnique = jest.fn();
const subscriptionFindFirst = jest.fn();
const subscriptionFindMany = jest.fn();
const subscriptionFindUnique = jest.fn();
const subscriptionCreate = jest.fn();
const subscriptionUpdate = jest.fn();
const subscriptionUpdateMany = jest.fn();
const transaction = jest.fn();

const txSubscriptionUpdate = jest.fn();
const txSubscriptionUpdateMany = jest.fn();
const txUserUpdate = jest.fn();

const midtransCancel = jest.fn();
const midtransStatus = jest.fn();
const midtransCreateTransaction = jest.fn();
const midtransSnap = jest.fn(() => ({
  createTransaction: midtransCreateTransaction,
  transaction: {
    cancel: midtransCancel,
    status: midtransStatus,
  },
}));

const loadService = async (paymentGatewayEnabled: boolean) => {
  jest.resetModules();
  jest.doMock("../../src/config/env.config", () => ({
    __esModule: true,
    default: {
      paymentGatewayEnabled,
      frontendUrl: "http://localhost:5173",
      midtrans: {
        serverKey: "server-key",
        clientKey: "client-key",
        isProduction: false,
      },
    },
  }));
  jest.doMock("../../src/config/prisma.config", () => ({
    prisma: {
      user: {
        findUnique: userFindUnique,
      },
      subscription: {
        findFirst: subscriptionFindFirst,
        findMany: subscriptionFindMany,
        findUnique: subscriptionFindUnique,
        create: subscriptionCreate,
        update: subscriptionUpdate,
        updateMany: subscriptionUpdateMany,
      },
      $transaction: transaction,
    },
  }));
  jest.doMock("midtrans-client", () => ({
    Snap: midtransSnap,
  }));

  transaction.mockImplementation(async (callback) =>
    callback({
      subscription: {
        update: txSubscriptionUpdate,
        updateMany: txSubscriptionUpdateMany,
      },
      user: {
        update: txUserUpdate,
      },
    })
  );

  return (
    await import("../../src/services/subscription.service")
  ).SubscriptionService;
};

describe("SubscriptionService payment gateway fallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userFindUnique.mockResolvedValue({
      id: "user-1",
      name: "User",
      email: "user@example.com",
      phone: null,
      subscriptionPlan: "free",
      subscriptionExpiresAt: null,
    });
    subscriptionFindFirst.mockResolvedValue(null);
    subscriptionFindMany.mockResolvedValue([]);
    subscriptionCreate.mockImplementation(async ({ data }) => ({
      id: "sub-1",
      ...data,
    }));
    subscriptionUpdateMany.mockResolvedValue({ count: 1 });
    txSubscriptionUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("creates a manual pending order without initializing Midtrans", async () => {
    const SubscriptionService = await loadService(false);

    const result = await SubscriptionService.createSubscriptionOrder(
      "user-1",
      { planId: "max" }
    );

    expect(result).toMatchObject({
      subscriptionId: "sub-1",
      gateway: "manual",
      snapToken: null,
      snapUrl: null,
      amount: 50000,
      plan: "max",
    });
    expect(result.orderId).toMatch(/^MANUAL-MAX-/);
    expect(midtransSnap).not.toHaveBeenCalled();
    expect(subscriptionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        gateway: "manual",
        status: "pending",
        pendingKey: "user-1",
        providerToken: null,
      }),
    });
  });

  it("creates a Midtrans order when the gateway flag is enabled", async () => {
    const SubscriptionService = await loadService(true);
    midtransCreateTransaction.mockResolvedValue({
      token: "snap-token",
      redirect_url: "https://app.sandbox.midtrans.com/snap/v2/vtweb/token",
    });

    const result = await SubscriptionService.createSubscriptionOrder(
      "user-1",
      { planId: "pro" }
    );

    expect(midtransSnap).toHaveBeenCalledTimes(1);
    expect(midtransCreateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction_details: expect.objectContaining({
          gross_amount: 25000,
        }),
      })
    );
    expect(result).toMatchObject({
      subscriptionId: "sub-1",
      gateway: "midtrans",
      snapToken: "snap-token",
      amount: 25000,
      plan: "pro",
    });
  });

  it("returns a pending upgrade even while the current plan is still active", async () => {
    const SubscriptionService = await loadService(false);
    userFindUnique.mockResolvedValue({
      id: "user-1",
      name: "User",
      email: "user@example.com",
      phone: null,
      subscriptionPlan: "pro",
      subscriptionExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    subscriptionFindFirst
      .mockResolvedValueOnce({
        id: "sub-active",
        plan: "pro",
        status: "paid",
        gateway: "midtrans",
        orderId: "SUB-PRO-PAID",
        providerToken: null,
        paymentType: "gopay",
        amount: 25000,
        paidAt: new Date("2026-06-01T00:00:00.000Z"),
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        id: "sub-upgrade",
        plan: "max",
        status: "pending",
        gateway: "manual",
        orderId: "MANUAL-MAX-PENDING",
        providerToken: null,
        paymentType: null,
        amount: 50000,
        paidAt: null,
        expiresAt: null,
      });

    const result =
      await SubscriptionService.getCurrentSubscription("user-1");

    expect(result).toMatchObject({
      id: "sub-upgrade",
      plan: "pro",
      pendingPlan: "max",
      status: "pending",
      gateway: "manual",
      orderId: "MANUAL-MAX-PENDING",
      amount: 50000,
    });
  });

  it("resumes the same pending order after the gateway flag changes", async () => {
    const SubscriptionService = await loadService(false);
    subscriptionFindFirst.mockResolvedValue({
      id: "sub-pending",
      amount: 25000,
      plan: "pro",
      gateway: "midtrans",
      orderId: "SUB-PRO-123",
      providerToken: "snap-token",
    });

    const result = await SubscriptionService.createSubscriptionOrder(
      "user-1",
      {
        planId: "pro",
      }
    );

    expect(result).toMatchObject({
      subscriptionId: "sub-pending",
      gateway: "midtrans",
      orderId: "SUB-PRO-123",
      snapToken: "snap-token",
    });
    expect(subscriptionCreate).not.toHaveBeenCalled();
  });

  it("rejects a different plan while another order is pending", async () => {
    const SubscriptionService = await loadService(false);
    subscriptionFindFirst.mockResolvedValue({
      id: "sub-pending",
      amount: 25000,
      plan: "pro",
      gateway: "midtrans",
      orderId: "SUB-PRO-123",
      providerToken: "snap-token",
    });

    await expect(
      SubscriptionService.createSubscriptionOrder("user-1", {
        planId: "max",
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("returns the winning manual order when parallel creation hits the unique constraint", async () => {
    const SubscriptionService = await loadService(false);
    subscriptionFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "sub-winning",
        amount: 50000,
        plan: "max",
        gateway: "manual",
        orderId: "MANUAL-MAX-WINNING",
        providerToken: null,
      });
    subscriptionCreate.mockRejectedValueOnce({ code: "P2002" });

    const result = await SubscriptionService.createSubscriptionOrder(
      "user-1",
      { planId: "max" }
    );

    expect(result).toMatchObject({
      subscriptionId: "sub-winning",
      orderId: "MANUAL-MAX-WINNING",
      gateway: "manual",
    });
  });

  it("cancels a duplicate Midtrans transaction created during a race", async () => {
    const SubscriptionService = await loadService(true);
    subscriptionFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "sub-winning",
        amount: 25000,
        plan: "pro",
        gateway: "midtrans",
        orderId: "SUB-PRO-WINNING",
        providerToken: "winning-token",
      });
    midtransCreateTransaction.mockResolvedValue({
      token: "duplicate-token",
      redirect_url: "https://app.sandbox.midtrans.com/duplicate",
    });
    midtransCancel.mockResolvedValue({ status_code: "200" });
    subscriptionCreate.mockRejectedValueOnce({ code: "P2002" });

    const result = await SubscriptionService.createSubscriptionOrder(
      "user-1",
      { planId: "pro" }
    );

    expect(midtransCancel).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      subscriptionId: "sub-winning",
      orderId: "SUB-PRO-WINNING",
      snapToken: "winning-token",
    });
  });

  it("cancels a pending Midtrans transaction before updating local status", async () => {
    const SubscriptionService = await loadService(true);
    subscriptionFindUnique.mockResolvedValue(null);
    subscriptionFindFirst.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      status: "pending",
      gateway: "midtrans",
      orderId: "SUB-PRO-123",
    });
    midtransCancel.mockResolvedValue({ status_code: "200" });
    subscriptionUpdate.mockResolvedValue({});

    await SubscriptionService.cancelSubscription("user-1", "sub-1");

    expect(midtransCancel).toHaveBeenCalledWith("SUB-PRO-123");
    expect(subscriptionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "sub-1",
        userId: "user-1",
        status: "pending",
      },
      data: expect.objectContaining({
        status: "cancelled",
        pendingKey: null,
      }),
    });
  });

  it("keeps an admin-approved Midtrans order paid on a late webhook", async () => {
    const SubscriptionService = await loadService(true);
    subscriptionFindUnique.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      gateway: "midtrans",
      status: "paid",
      amount: 25000,
    });

    const payload = {
      order_id: "SUB-PRO-123",
      status_code: "407",
      transaction_status: "expire",
      gross_amount: "25000.00",
      signature_key: crypto
        .createHash("sha512")
        .update("SUB-PRO-12340725000.00server-key")
        .digest("hex"),
    };

    await SubscriptionService.handleMidtransNotification(payload);

    expect(transaction).not.toHaveBeenCalled();
    expect(subscriptionUpdate).not.toHaveBeenCalled();
  });

  it("does not reopen a cancelled order from a late pending webhook", async () => {
    const SubscriptionService = await loadService(true);
    subscriptionFindUnique.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      gateway: "midtrans",
      status: "cancelled",
      amount: 25000,
    });

    const payload = {
      order_id: "SUB-PRO-123",
      status_code: "201",
      transaction_status: "pending",
      gross_amount: "25000.00",
      signature_key: crypto
        .createHash("sha512")
        .update("SUB-PRO-12320125000.00server-key")
        .digest("hex"),
    };

    await SubscriptionService.handleMidtransNotification(payload);

    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a validly signed webhook with a different gross amount", async () => {
    const SubscriptionService = await loadService(true);
    subscriptionFindUnique.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      plan: "pro",
      gateway: "midtrans",
      status: "pending",
      amount: 25000,
    });

    const payload = {
      order_id: "SUB-PRO-123",
      status_code: "200",
      transaction_status: "settlement",
      gross_amount: "50000.00",
      signature_key: crypto
        .createHash("sha512")
        .update("SUB-PRO-12320050000.00server-key")
        .digest("hex"),
    };

    await expect(
      SubscriptionService.handleMidtransNotification(payload)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("does not overwrite an order when another action wins the status race", async () => {
    const SubscriptionService = await loadService(true);
    subscriptionFindUnique.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      plan: "pro",
      gateway: "midtrans",
      status: "pending",
      amount: 25000,
      paidAt: null,
    });
    txSubscriptionUpdateMany.mockResolvedValueOnce({ count: 0 });

    const payload = {
      order_id: "SUB-PRO-123",
      status_code: "200",
      transaction_status: "settlement",
      gross_amount: "25000.00",
      signature_key: crypto
        .createHash("sha512")
        .update("SUB-PRO-12320025000.00server-key")
        .digest("hex"),
    };

    await SubscriptionService.handleMidtransNotification(payload);

    expect(txUserUpdate).not.toHaveBeenCalled();
  });

  it("allows an admin to approve a pending Midtrans order", async () => {
    const SubscriptionService = await loadService(true);
    subscriptionFindUnique.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      plan: "pro",
      gateway: "midtrans",
      status: "pending",
    });

    await SubscriptionService.manualApprove("sub-1");

    expect(txSubscriptionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "sub-1",
        status: "pending",
      },
      data: expect.objectContaining({
        status: "paid",
        pendingKey: null,
      }),
    });
    expect(txUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        subscriptionPlan: "pro",
      }),
    });
  });

  it("cancels pending Midtrans orders before forcing a downgrade", async () => {
    const SubscriptionService = await loadService(true);
    subscriptionFindMany.mockResolvedValue([
      {
        id: "sub-pending",
        gateway: "midtrans",
        orderId: "SUB-PRO-PENDING",
      },
    ]);
    midtransCancel.mockResolvedValue({ status_code: "200" });

    await SubscriptionService.forceDowngradeToFree("user-1");

    expect(midtransCancel).toHaveBeenCalledWith("SUB-PRO-PENDING");
    expect(txUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        subscriptionPlan: "free",
      }),
    });
  });
});
