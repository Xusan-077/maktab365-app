import { describe, expect, it } from "vitest";
import { MockApi } from "./mock-api";

const as = (id: string) => new MockApi({ session: () => ({ id, name: id }) });

describe("MockApi: akkaunt", () => {
  it("rolni almashtiradi, ismni saqlaydi", async () => {
    const api = as("u1");
    await api.saveProfile({ role: "student", name: "Ali", grade: 5 });
    const teacher = await api.setRole("teacher");
    expect(teacher).toMatchObject({ role: "teacher", name: "Ali", subjects: [], grades: [] });
    expect(await api.getMe()).toEqual(teacher);
    expect(await api.setRole("student")).toMatchObject({ role: "student", name: "Ali" });
  });

  it("profilsiz rol almashtirilmaydi (404)", async () => {
    await expect(as("u2").setRole("teacher")).rejects.toMatchObject({ status: 404 });
  });

  it("ma'lumotni eksport qiladi", async () => {
    const api = as("u1");
    await api.saveProfile({ role: "teacher", name: "Vali", subjects: ["math"], grades: [5] });
    const data = await api.exportData();
    expect(data.user).toMatchObject({ id: "u1", role: "teacher" });
    expect(data.profile).toMatchObject({ display_name: "Vali", subjects: ["math"], grades: [5] });
  });

  it("akkauntni o'chiradi: profil yo'qoladi, boshqa akkaunt tegilmaydi", async () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => void memory.set(key, value),
    };
    const a = new MockApi({ session: () => ({ id: "a", name: "a" }), storage });
    const b = new MockApi({ session: () => ({ id: "b", name: "b" }), storage });
    await a.saveProfile({ role: "student", name: "A", grade: 1 });
    await b.saveProfile({ role: "student", name: "B", grade: 2 });
    await a.deleteAccount();
    expect(await a.getMe()).toBeNull();
    expect(await b.getMe()).toMatchObject({ name: "B" });
  });
});
