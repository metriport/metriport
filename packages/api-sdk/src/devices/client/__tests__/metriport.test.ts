import { mocked } from "jest-mock";
import axios from "axios";
import { MetriportDevicesApi } from "../metriport";
import { faker } from "@faker-js/faker";

jest.mock("axios");

describe("getMetriportUserId", () => {
  const userId = faker.string.uuid();
  const apiKey = faker.string.uuid();
  const mockedAxios = mocked(axios);

  it("returns the userId", async () => {
    const metriportClient = new MetriportDevicesApi(apiKey);

    metriportClient["api"] = mockedAxios;

    jest.spyOn(metriportClient, "getMetriportUserId");

    mockedAxios.post.mockResolvedValueOnce({ data: { userId } });

    const result = await metriportClient.getMetriportUserId(userId);

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(`/user`, null, { params: { appUserId: userId } });
    expect(result).toEqual(userId);
  });
});
