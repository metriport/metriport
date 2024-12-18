// /* eslint-disable @typescript-eslint/no-empty-function */
// import { v4 as uuidv4 } from "uuid";
// import * as appConfig from "../../../../external/aws/app-config";
// import { checkAiBriefEnabled } from "../check-ai-brief-enabled";

// let isAiBriefEnabledForCx_mock: jest.SpyInstance;

// beforeAll(() => {
//   jest.restoreAllMocks();
//   isAiBriefEnabledForCx_mock = jest.spyOn(appConfig, "isAiBriefEnabledForCx");
// });
// afterAll(() => {
//   jest.restoreAllMocks();
// });

// describe("checkAiBriefEnabled", () => {
//   const cxId = uuidv4();

//   describe("isAiBriefEnabledForCx is false", () => {
//     beforeEach(() => {
//       isAiBriefEnabledForCx_mock.mockReturnValue(false);
//     });

//     it("returns false when generateAiBrief is false", async () => {
//       const resp = await checkAiBriefEnabled({
//         cxId,
//         generateAiBrief: false,
//       });
//       expect(resp).toEqual(false);
//     });

//     it("returns false when generateAiBrief is undefined", async () => {
//       const resp = await checkAiBriefEnabled({
//         cxId,
//         generateAiBrief: undefined,
//       });
//       expect(resp).toEqual(false);
//     });

//     it("throws when generateAiBrief is true", async () => {
//       await expect(() =>
//         checkAiBriefEnabled({
//           cxId,
//           generateAiBrief: true,
//         })
//       ).rejects.toThrow("Contact Metriport to enable the AI Brief feature.");
//     });
//   });

//   describe("isAiBriefEnabledForCx is true", () => {
//     beforeEach(() => {
//       isAiBriefEnabledForCx_mock.mockReturnValue(true);
//     });

//     it("returns false when generateAiBrief is false", async () => {
//       const resp = await checkAiBriefEnabled({
//         cxId,
//         generateAiBrief: false,
//       });
//       expect(resp).toEqual(false);
//     });

//     it("returns true when generateAiBrief is undefined", async () => {
//       const resp = await checkAiBriefEnabled({
//         cxId,
//         generateAiBrief: undefined,
//       });
//       expect(resp).toEqual(true);
//     });

//     it("returns true when generateAiBrief is true", async () => {
//       const resp = await checkAiBriefEnabled({
//         cxId,
//         generateAiBrief: true,
//       });
//       expect(resp).toEqual(true);
//     });
//   });
// });
