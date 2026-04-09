import { AccountValidation } from "../../src/validations/account.validation";
import { UserValidation } from "../../src/validations/admin/user.validation";

describe("Account validation", () => {
  it("rejects empty core fields on PATCH /account/me payload", () => {
    const result = AccountValidation.UPDATE_ME.safeParse({
      name: "",
      username: "",
      email: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toBeDefined();
      expect(result.error.flatten().fieldErrors.username).toBeDefined();
      expect(result.error.flatten().fieldErrors.email).toBeDefined();
    }
  });

  it("rejects empty core fields on admin user update payload", () => {
    const result = UserValidation.UPDATE.safeParse({
      name: "",
      username: "",
      email: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toBeDefined();
      expect(result.error.flatten().fieldErrors.username).toBeDefined();
      expect(result.error.flatten().fieldErrors.email).toBeDefined();
    }
  });
});
