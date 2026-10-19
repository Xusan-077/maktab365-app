import { describe, expect, it } from "vitest";
import {
  appBaseOfPath,
  baseHome,
  bookPath,
  catalogPath,
  helpPath,
  roleBase,
  subjectPath,
  subjectsPath,
  topicBlockPath,
  toPublicPath,
  topicPath,
} from "./routes";

describe("appBaseOfPath", () => {
  it("panelni yo'ldan aniqlaydi", () => {
    expect(appBaseOfPath("/kabinet")).toBe("kabinet");
    expect(appBaseOfPath("/kabinet/darsliklar/algebra-9")).toBe("kabinet");
    expect(appBaseOfPath("/ustoz/mavzular")).toBe("ustoz");
  });

  it("marketing, sozlamalar va o'xshash prefikslarda null", () => {
    expect(appBaseOfPath("/")).toBeNull();
    expect(appBaseOfPath("/darsliklar")).toBeNull();
    expect(appBaseOfPath("/sozlamalar")).toBeNull();
    expect(appBaseOfPath("/kabinetim")).toBeNull();
    expect(appBaseOfPath("/ustozlar")).toBeNull();
  });
});

describe("baza bo'yicha yo'llar", () => {
  it("default marketing: eski yo'llar o'zgarmaydi", () => {
    expect(bookPath("algebra-9")).toBe("/darsliklar/algebra-9");
    expect(topicPath("algebra-9", "t1")).toBe("/darsliklar/algebra-9/t1");
    expect(subjectPath("matematika")).toBe("/fanlar/matematika");
    expect(catalogPath()).toBe("/darsliklar");
    expect(subjectsPath()).toBe("/fanlar");
    expect(baseHome("marketing")).toBe("/");
  });

  it("kabinet va ustoz o'z prefiksi ostida", () => {
    expect(bookPath("algebra-9", "kabinet")).toBe("/kabinet/darsliklar/algebra-9");
    expect(topicPath("algebra-9", "t1", "ustoz")).toBe("/ustoz/darsliklar/algebra-9/t1");
    expect(subjectPath("matematika", "ustoz")).toBe("/ustoz/fanlar/matematika");
    expect(topicBlockPath("b", "t", "x y", "kabinet")).toBe("/kabinet/darsliklar/b/t#block-x%20y");
    expect(baseHome("kabinet")).toBe("/kabinet");
    expect(baseHome("ustoz")).toBe("/ustoz");
  });

  it("katalog va fanlar ro'yxati: ustozda katalog panelning bosh sahifasi", () => {
    expect(catalogPath("kabinet")).toBe("/kabinet/darsliklar");
    expect(catalogPath("ustoz")).toBe("/ustoz");
    expect(subjectsPath("kabinet")).toBe("/kabinet/fanlar");
    expect(subjectsPath("ustoz")).toBe("/ustoz");
  });

  it("rolga mos baza va yordam sahifasi", () => {
    expect(roleBase("student")).toBe("kabinet");
    expect(roleBase("teacher")).toBe("ustoz");
    expect(helpPath("kabinet")).toBe("/kabinet/yordam");
    expect(helpPath("ustoz")).toBe("/ustoz/yordam");
  });
});

describe("toPublicPath", () => {
  it("panel yo'lini ochiq sayt yo'liga aylantiradi", () => {
    expect(toPublicPath("/uz/ustoz/darsliklar/algebra-9/diskriminant")).toBe(
      "/uz/darsliklar/algebra-9/diskriminant",
    );
    expect(toPublicPath("/uz-Cyrl/kabinet/darsliklar/a/b")).toBe("/uz-Cyrl/darsliklar/a/b");
  });

  it("ochiq yo'lni o'zgartirmaydi", () => {
    expect(toPublicPath("/ru/darsliklar/a/b")).toBe("/ru/darsliklar/a/b");
  });
});
