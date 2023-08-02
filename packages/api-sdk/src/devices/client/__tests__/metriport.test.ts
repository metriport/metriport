import { MetriportDevicesApi } from "../metriport";
import axios from "axios";

jest.mock("axios");

describe("getMetriportUserId", () => {
  const userId = "1";
  const apiKey = "FAKE_KEY";
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  it("returns the userId", async () => {
    const metriportClient = new MetriportDevicesApi(apiKey);

    metriportClient["api"] = mockedAxios;

    jest.spyOn(metriportClient, "getMetriportUserId");

    mockedAxios.post.mockResolvedValueOnce({ data: { userId } });

    const result = await metriportClient.getMetriportUserId(userId);

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(`/user`, null, { params: { appUserId: userId } });
    expect(metriportClient.getMetriportUserId).toHaveBeenCalledTimes(1);
    expect(result).toEqual(userId);
  });
});
