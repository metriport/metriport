export type ContactTypes = "email" | "phone";

export type Contact = {
  [k in ContactTypes]?: string;
};
