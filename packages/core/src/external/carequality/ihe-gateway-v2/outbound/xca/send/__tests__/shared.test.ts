import { shouldReportOutboundError } from "../shared";
import { AxiosError } from "axios";

describe("shared", () => {
  describe("shouldReportOutboundError", () => {
    it("returns true if the error is not in the list of errors to skip", async () => {
      const error = new Error("Some random error");
      const resp = shouldReportOutboundError(error);
      expect(resp).toBeTruthy();
    });

    it("returns false if the error is ECONNRESET", async () => {
      const error = new Error("ECONNRESET");
      const resp = shouldReportOutboundError(error);
      expect(resp).toBeFalsy();
    });

    it("returns false if the error is Request failed with status code 500", async () => {
      const error = new Error("Request failed with status code 500");
      const resp = shouldReportOutboundError(error);
      expect(resp).toBeFalsy();
    });

    it("returns false if the error is Request failed with status code 502", async () => {
      const error = new Error("Request failed with status code 502");
      const resp = shouldReportOutboundError(error);
      expect(resp).toBeFalsy();
    });

    it("returns false if the error is Bad Gateway", async () => {
      const error = new Error("Bad Gateway");
      const resp = shouldReportOutboundError(error);
      expect(resp).toBeFalsy();
    });

    it("returns false if the error is Error with AxiosError: timeout of", async () => {
      const error = new Error("AxiosError: timeout of 120000ms");
      const resp = shouldReportOutboundError(error);
      expect(resp).toBeFalsy();
    });

    it("returns false if the error is AxiosError with AxiosError: timeout of", async () => {
      const error = new AxiosError("timeout of 120000ms");
      const resp = shouldReportOutboundError(error);
      expect(resp).toBeFalsy();
    });
  });
});
