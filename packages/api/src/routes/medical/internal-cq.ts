// import { Contained } from "@metriport/carequality-sdk/models/contained";
// import { Address } from "@metriport/carequality-sdk/models/address";
// import { Carequality } from "@metriport/carequality-sdk/client/carequality";
// import { USState } from "@metriport/core/domain/geographic-locations";
// import { normalizeOid } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { createCQOrganization } from "../../command/medical/cq-directory/create-cq-organization";
// import { Config } from "../../shared/config";
import { asyncHandler } from "../util";

// const apiKey = Config.getCQApiKey();
// const apiMode = Config.getEnvType();

dayjs.extend(duration);

const router = Router();

router.post(
  "/test",
  asyncHandler(async (req: Request, res: Response) => {
    const testOrg = {
      oid: "1.1.1.1112",
      urlXCPD: "https://api.app.com/1",
      // urlDQ: "//api.app.com/2",
      // urlDR: "//api.app.com/3",
      // name: "Test Org",
      // latitude: "40.689247",
      // longitude: "-74.044502",
      // state: "NY",
      // data: {
      //   some: "thing",
      // },
    };

    const resp = await createCQOrganization(testOrg);
    console.log("RESP IS", resp);
    return res.status(httpStatus.OK).json(resp);
  })
);

// router.post(
//   "/",
//   asyncHandler(async (req: Request, res: Response) => {
//     const cq = new Carequality(apiKey, apiMode);

//     // const resp = await cq.listAllOrganizations();
//     const resp = await cq.listOrganizations(1);
//     const orgs = resp.organizations.flatMap(org => {
//       const orgOid = org?.identifier?.value?.value;
//       if (!orgOid) return [];

//       const oid = normalizeOid(org?.identifier?.value?.value);
//       const url = getUrls(org?.contained);
//       if (!url?.urlXCPD) return [];

//       const coordinates = getCoordinates(org?.address);
//       console.log(coordinates);

//       const orgData: CQDirectoryOrg = {
//         oid,
//         name: org.name?.value,
//         urlXCPD: url.urlXCPD,
//         urlDQ: url.urlDQ,
//         urlDR: url.urlDR,
//         latitude: undefined,
//         longitude: undefined,
//         data: {
//           some: "thing",
//         },
//         state: USState.NY,
//       };
//       return orgData;
//     });

//     console.log("Orgs", orgs);
//     for (const org of orgs) {
//       await createCQOrganization(org);
//     }

//     return res.status(httpStatus.OK).json(resp);
//   })
// );

// type XCUrls = {
//   urlXCPD: string;
//   urlDQ?: string;
//   urlDR?: string;
// };

// function getUrls(contained: Contained): XCUrls | undefined {
//   const endpointMap: Record<string, string> = {};

//   contained?.forEach(endpoint => {
//     const ext = endpoint?.Endpoint.extension.extension.find(ext => ext.url === "Transaction");
//     const type = ext?.valueString?.value;

//     // Store the endpoint URL in a map keyed by type
//     if (type && endpoint && endpoint.Endpoint.address && endpoint.Endpoint.address.value) {
//       endpointMap[type] = endpoint.Endpoint.address.value;
//     }
//   });

//   const urlXCPD = endpointMap["XCPD ITI-55"];

//   if (!urlXCPD) return;

//   const urls: XCUrls = {
//     urlXCPD,
//   };

//   if (endpointMap["XCA ITI-38"]) {
//     urls.urlDQ = endpointMap["XCA ITI-38"];
//   }
//   if (endpointMap["XCA ITI-39"]) {
//     urls.urlDR = endpointMap["XCA ITI-39"];
//   }

//   return urls;
// }

// function getCoordinates(
//   address: Address[] | undefined
// ): { latitude: string; longitude: string } | undefined {
//   if (!address) return;
//   const coordinates = address.flatMap(a => {
//     if (a.extension?.url === "OrgPosition") {
//       console.log("a.ext", JSON.stringify(a.extension, null, 2));
//       const position = a.extension?.valueCodeableConcept?.coding?.value?.position;
//       if (!position) return [];
//       return {
//         latitude: position.latitude.value,
//         longitude: position.longitude.value,
//       };
//     }
//   })[0];

//   return coordinates;
// }

export default router;
