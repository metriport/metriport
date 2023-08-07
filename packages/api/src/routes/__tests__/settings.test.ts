import { MetriportDevicesApi } from "@metriport/api-sdk";

describe("Space test suite", () => {
  it("tests /destinations endpoints", async () => {
    const metriportClient = new MetriportDevicesApi(
      "Y1VRSllfTTE2TWdEbGFsdThzQmZiOjc3ZTMyNzg1LWY0NjMtNGIzZC1hNmMwLTc4YzY2YzUxMjUyZA",
      {
        baseURL: "https://api.staging.metriport.com",
      }
    );

    const response = await metriportClient.getSettings();

    console.log(response);

    // expect(response.body).toEqual(["Mars", "Moon", "Earth", "Mercury", "Venus", "Jupiter"]);
    // expect(response.body).toHaveLength(6);
    // expect(response.statusCode).toBe(200);
    // // Testing a single element in the array
    // expect(response.body).toEqual(expect.arrayContaining(["Earth"]));
  });

  // Insert other tests below this line

  // Insert other tests above this line
});
