import { describe, expect, it } from "vitest";
import { buildZip, crc32 } from "./zip";

const text = (value: string) => new TextEncoder().encode(value);

describe("crc32", () => {
  it("ma'lum qiymatlar", () => {
    expect(crc32(text(""))).toBe(0);
    expect(crc32(text("123456789"))).toBe(0xcbf43926);
  });
});

describe("buildZip", () => {
  const zip = buildZip([
    { name: "a.txt", data: text("salom"), date: new Date(2026, 9, 31, 12, 30, 10) },
    { name: "yozuvlar/bet-1.md", data: text("Eslatma — oʻqish"), date: new Date(2026, 9, 31) },
  ]);
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

  it("oxirgi yozuv fayllar soni va markaziy katalog joyini ko'rsatadi", () => {
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const offset = view.getUint32(end + 16, true);
    expect(view.getUint32(offset, true)).toBe(0x02014b50);
    expect(offset + view.getUint32(end + 12, true)).toBe(end);
  });

  it("har fayl: mahalliy sarlavha, nom, ma'lumot va to'g'ri crc", () => {
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(14, true)).toBe(crc32(text("salom")));
    const nameLength = view.getUint16(26, true);
    expect(new TextDecoder().decode(zip.subarray(30, 30 + nameLength))).toBe("a.txt");
    const body = zip.subarray(30 + nameLength, 30 + nameLength + 5);
    expect(new TextDecoder().decode(body)).toBe("salom");
  });

  it("markaziy katalogdagi siljish mahalliy sarlavhaga olib boradi (UTF-8 nom)", () => {
    const end = zip.length - 22;
    let at = view.getUint32(end + 16, true);
    const offsets: number[] = [];
    for (let index = 0; index < 2; index += 1) {
      offsets.push(view.getUint32(at + 42, true));
      at += 46 + view.getUint16(at + 28, true);
    }
    expect(offsets[0]).toBe(0);
    expect(view.getUint32(offsets[1]!, true)).toBe(0x04034b50);
    const nameLength = view.getUint16(offsets[1]! + 26, true);
    expect(
      new TextDecoder().decode(zip.subarray(offsets[1]! + 30, offsets[1]! + 30 + nameLength)),
    ).toBe("yozuvlar/bet-1.md");
    expect(view.getUint16(offsets[1]! + 6, true) & 0x0800).toBe(0x0800);
  });

  it("bo'sh arxiv ham to'g'ri", () => {
    expect(buildZip([]).length).toBe(22);
  });
});
