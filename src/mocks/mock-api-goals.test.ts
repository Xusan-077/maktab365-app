import { describe, expect, it } from "vitest";
import { MockApi } from "./mock-api";

const as = (id: string, storage?: Pick<Storage, "getItem" | "setItem">) =>
  new MockApi({ session: () => ({ id, name: id }), storage });

describe("MockApi: o'qish rejasi", () => {
  it("maqsad qo'shadi, yangisini birinchi qaytaradi", async () => {
    const api = as("u1");
    const first = await api.createGoal("  Viyet teoremasini takrorlash ");
    expect(first).toMatchObject({ title: "Viyet teoremasini takrorlash", done: false });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await api.createGoal("Present Perfect mashqlari");
    const goals = await api.getGoals();
    expect(goals.map((goal) => goal.title)).toEqual([
      "Present Perfect mashqlari",
      "Viyet teoremasini takrorlash",
    ]);
  });

  it("nomini o'zgartiradi va bajarildi deb belgilaydi", async () => {
    const api = as("u1");
    const goal = await api.createGoal("Eski nom");
    const done = await api.updateGoal(goal.id, { done: true });
    expect(done).toMatchObject({ title: "Eski nom", done: true });
    const renamed = await api.updateGoal(goal.id, { title: " Yangi nom " });
    expect(renamed).toMatchObject({ title: "Yangi nom", done: true });
  });

  it("bo'sh nomni rad etadi, topilmasa 404", async () => {
    const api = as("u1");
    const goal = await api.createGoal("A");
    await expect(api.createGoal("   ")).rejects.toMatchObject({ status: 400 });
    await expect(api.updateGoal(goal.id, { title: " " })).rejects.toMatchObject({ status: 400 });
    await expect(api.updateGoal("yoq", { done: true })).rejects.toMatchObject({ status: 404 });
    await expect(api.deleteGoal("yoq")).rejects.toMatchObject({ status: 404 });
  });

  it("o'chiradi va akkauntlar bir-biriga aralashmaydi", async () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => void memory.set(key, value),
    };
    const a = as("a", storage);
    const b = as("b", storage);
    const goal = await a.createGoal("Faqat A uchun");
    expect(await b.getGoals()).toEqual([]);
    await a.deleteGoal(goal.id);
    expect(await a.getGoals()).toEqual([]);
  });

  it("sessiyasiz 401", async () => {
    await expect(new MockApi({ session: () => null }).getGoals()).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("MockApi: fikr-mulohaza", () => {
  it("xabarni qirqib saqlaydi, bo'sh xabarni rad etadi", async () => {
    const api = as("u1");
    const sent = await api.submitFeedback({ kind: "bug", message: "  Tugma ishlamayapti  " });
    expect(sent).toMatchObject({ kind: "bug", message: "Tugma ishlamayapti", userId: "u1" });
    await expect(api.submitFeedback({ kind: "idea", message: "   " })).rejects.toMatchObject({
      status: 400,
    });
  });

  it("kirmagan foydalanuvchi uchun 401", async () => {
    const api = new MockApi({ session: () => null });
    await expect(api.submitFeedback({ kind: "question", message: "Salom" })).rejects.toMatchObject({
      status: 401,
    });
  });
});
