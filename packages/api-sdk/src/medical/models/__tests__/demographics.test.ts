import { contactSchema, emailSchema } from "../demographics";
import { makeContact } from "./contact";

describe("demographicsSchema", () => {
  describe("contactSchema", () => {
    it("accepts simple email", async () => {
      const contact = makeContact({ email: "test@metriport.com" });
      expect(() => contactSchema.parse(contact)).not.toThrow();
    });

    it("accepts null email", async () => {
      const contact = makeContact();
      contact.email = null;
      expect(() => contactSchema.parse(contact)).not.toThrow();
    });

    it("accepts undefined email", async () => {
      const contact = makeContact();
      contact.email = undefined;
      expect(() => contactSchema.parse(contact)).not.toThrow();
    });
  });

  describe("emailSchema", () => {
    const casesToSucceed: string[] = [
      "t@m.co",
      "test@metriport.com",
      "test.second@metriport.com",
      "test_second@metriport.com",
      "test-second@metriport.com",
      "user123@metriport.com",
      "123user@metriport.com",
      "user@metriport.com.br",
      "test!user@example.com",
      "test+user@example.com",
      "test_user@example.com",
      "test-user@example.com",
      "test.user@example.com",
      "test_user+test@example.com",
    ];
    const casesToFail: (string | null | undefined)[] = [
      null,
      undefined,
      " test@metriport.com",
      "test@metriport.com ",
      "test:second@metriport.com",
      "test second@metriport.com",
      "test metriport.com",
      "test@ metriport.com",
      "test@metriport",
      "test@.com",
    ];
    for (const email of casesToSucceed) {
      it(`accepts '${email}'`, async () => {
        expect(() => emailSchema.parse(email)).not.toThrow();
      });
    }
    for (const email of casesToFail) {
      it(`fails when gets '${email}'`, async () => {
        expect(() => emailSchema.parse(email)).toThrow();
      });
    }
  });
});
