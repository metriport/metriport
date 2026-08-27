import { normalizePhoneNumberToEhexFormat } from "../xcpd-response";

describe("normalizePhoneNumberToEhexFormat", () => {
  it("formats valid 10-digit phone number as tel:+1-XXX-XXX-XXXX", () => {
    const result = normalizePhoneNumberToEhexFormat("0987654321");
    expect(result).toBe("tel:+1-098-765-4321");
  });

  it("removes country code when it starts with 1 and has 11 digits, then formats", () => {
    const result = normalizePhoneNumberToEhexFormat("10987654321");
    expect(result).toBe("tel:+1-098-765-4321");
  });

  it("removes country code when it starts with +1 and has 12 digits, then formats", () => {
    const result = normalizePhoneNumberToEhexFormat("+10987654321");
    expect(result).toBe("tel:+1-098-765-4321");
  });

  it("removes formatting characters and formats valid phone number", () => {
    const result = normalizePhoneNumberToEhexFormat("(098) 765-4321");
    expect(result).toBe("tel:+1-098-765-4321");
  });

  it("removes all prepended text and formats the bare 10 digit phone number", () => {
    const result = normalizePhoneNumberToEhexFormat("tel:+1-222-333-4455");
    expect(result).toBe("tel:+1-222-333-4455");
  });

  it("returns 10 leftmost digits when does not start with 1 and has more than 10 digits, then formats", () => {
    const result = normalizePhoneNumberToEhexFormat("20987654321");
    expect(result).toBe("tel:+1-209-876-5432");
  });

  it("removes first digit and returns remaining leftmost digits when starts with 1 and has more than 10 digits, then formats", () => {
    const result = normalizePhoneNumberToEhexFormat("1987654321555");
    expect(result).toBe("tel:+1-987-654-3215");
  });

  it("returns undefined when phone number normalizes to less than 10 digits", () => {
    const result = normalizePhoneNumberToEhexFormat("123456789");
    expect(result).toBeUndefined();
  });

  it("formats the leftmost 10 digits when phone number normalizes to more than 10 digits", () => {
    const result = normalizePhoneNumberToEhexFormat("12345678901234");
    expect(result).toBe("tel:+1-234-567-8901");
  });

  it("handles phone numbers with spaces and dashes", () => {
    const result = normalizePhoneNumberToEhexFormat("098 765-4321");
    expect(result).toBe("tel:+1-098-765-4321");
  });

  it("handles phone numbers with extension text", () => {
    const result = normalizePhoneNumberToEhexFormat("0987654321 ext 999");
    expect(result).toBe("tel:+1-098-765-4321");
  });
});
