import { describe, expect, it } from "vitest";
import contract from "../../../../contracts/fixtures/support-message-quality.json";
import { createSupportSchema } from "./support";
import { isMeaningless, SUPPORT_MESSAGE_MIN } from "./support-quality";

describe("isMeaningless — backend bilan umumiy kontrakt", () => {
  it("minimal uzunlik bir xil", () => {
    expect(SUPPORT_MESSAGE_MIN).toBe(contract.min_length);
  });

  it.each(contract.cases)("$text → $meaningless", ({ text, meaningless }) => {
    expect(isMeaningless(text)).toBe(meaningless);
  });
});

describe("createSupportSchema", () => {
  const schema = createSupportSchema({ emailRequired: false });
  const errorOf = async (message: string) =>
    schema
      .validate({ kind: "question", email: "", message, website: "" })
      .then(() => null)
      .catch((error: { message: string }) => error.message);

  it("qisqa, ma'nosiz va yaxshi xabar", async () => {
    expect(await errorOf("Xato bor ekan")).toBe("messageTooShort");
    expect(await errorOf("Dnxdnxdnxdnxdnxdnx")).toBe("messageMeaningless");
    expect(await errorOf("3-betdagi formulada xato bor")).toBeNull();
  });
});
