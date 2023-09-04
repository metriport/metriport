import * as dotenv from "dotenv";
dotenv.config();

// import { MetriportMedicalApi } from "@metriport/api-sdk";
// import { FhirClient } from "../../../../../external/fhir/api/api";
// import { ResourceType } from "../../../../../external/fhir/shared";
// import { validateCWOrg, validateFhirOrg, validateLocalOrg } from "./organization";
// import { setupE2ETest } from "./shared";
// import { Config } from "../../../../../shared/config";
// import { getOne as cwOrgGetOne } from "../../../../../external/commonwell/__tests__/organization";

// jest.setTimeout(30000);

// if (Config.isProdEnv()) {
//   describe("MAPI E2E Tests", () => {
//     let medicalApi: MetriportMedicalApi;
//     let fhirApi: FhirClient;

//     beforeAll(async () => {
//       const setup = await setupE2ETest(false);

//       medicalApi = setup.apis.medicalApi;
//       fhirApi = setup.apis.fhirApi;
//     });

//     it("gets an organization", async () => {
//       const org = await medicalApi.getOrganization();

//       if (org) {
//         const fhirOrg = await fhirApi.readResource(ResourceType.Organization, org.id);
//         const cwOrg = await cwOrgGetOne(org.oid);

//         validateLocalOrg(org);
//         validateCWOrg(cwOrg);
//         validateFhirOrg(fhirOrg);
//       }
//     });
//   });
// }
