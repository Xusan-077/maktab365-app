import { describe, expect, it, vi } from "vitest";
import { ACCOUNT_METHODS, withAccountApi } from "./index";
import type { MaktabApi } from "./types";

describe("withAccountApi", () => {
  it("akkaunt metodlari backend'ga, qolganlari asosiy klientga", async () => {
    const base = { getMe: vi.fn(), getSubjects: vi.fn(async () => ["mock"]) };
    const account = { getMe: vi.fn(async () => ({ id: "u1" })), getSubjects: vi.fn() };
    const api = withAccountApi(base as unknown as MaktabApi, account as unknown as MaktabApi);

    expect(await api.getMe()).toEqual({ id: "u1" });
    expect(await api.getSubjects()).toEqual(["mock"]);
    expect(base.getMe).not.toHaveBeenCalled();
    expect(account.getSubjects).not.toHaveBeenCalled();
  });

  it("metodlar o'z obyektiga bog'langan (this)", async () => {
    class Account {
      id = "acc";
      async getMe() {
        return this.id;
      }
    }
    const api = withAccountApi({} as MaktabApi, new Account() as unknown as MaktabApi);
    expect(await api.getMe()).toBe("acc");
    expect(ACCOUNT_METHODS).toEqual(
      expect.arrayContaining(["saveProfile", "sendSupport", "getMySupport"]),
    );
  });
});
