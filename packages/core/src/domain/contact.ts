export type ContactTypes = "email" | "phone";

export type Contact = Partial<Record<ContactTypes, string | undefined>>;
