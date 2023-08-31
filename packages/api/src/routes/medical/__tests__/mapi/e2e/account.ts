export type Customer = {
  id: string;
  subscriptionStatus: "disabled" | "active" | "overdue";
  stripeCxId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  website: string | null;
};

export type Account = { customer: Customer; idToken: string; accessToken: string };

export const testAccount = {
  email: "test+123@metriport.com",
  password: "Abc123!@#",
  firstName: "John",
  lastName: "Doe",
  website: "https://metriport.com",
};
