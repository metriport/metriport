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
      contact.email = null;
      expect(() => contactSchema.parse(contact)).not.toThrow();
    });
  });

  describe("emailSchema", () => {
    it("accepts simple email", async () => {
      expect(() => emailSchema.parse("test@metriport.com")).not.toThrow();
    });

    it("fails when gets null", async () => {
      expect(() => emailSchema.parse(null)).toThrow();
    });

    it("fails when gets undefined", async () => {
      expect(() => emailSchema.parse(undefined)).toThrow();
    });

    it("accepts email with dot", async () => {
      expect(() => emailSchema.parse("test.two@metriport.com")).not.toThrow();
    });

    it("fails when gets email with colon", async () => {
      expect(() => emailSchema.parse("test:two@metriport.com")).toThrow();
    });
  });
});
