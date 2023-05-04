export type ContactTypes = "email" | "phone";

export type Contact =
  | {
      email?: string | null;
      phone?: string | null;
    }
  | null
  | undefined;
