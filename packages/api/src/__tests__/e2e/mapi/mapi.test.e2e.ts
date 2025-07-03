import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { initMapiE2e, tearDownMapiE2e } from "./init";
import { runCohortTestsPart1, runCohortTestsPart2 } from "./parts/cohort.test.part";
import { runConsolidatedTests } from "./parts/consolidated.test.part";
import { runContributedTests } from "./parts/contributed.test.part";
import { runDocumentQueryTests } from "./parts/document-query.test.part";
import { runFacilityTestsPart1, runFacilityTestsPart2 } from "./parts/facility.test.part";
import { runOrganizationTests } from "./parts/organization.test.part";
import { runPatientTestsPart1, runPatientTestsPart2 } from "./parts/patient.test.part";
import { runSettingsTests } from "./parts/settings.test.part";
import { E2eContext } from "./shared";

dayjs.extend(duration);

const maxTotalTestDuration = dayjs.duration({ minutes: 12 });

jest.setTimeout(maxTotalTestDuration.asMilliseconds());

beforeAll(async () => {
  await initMapiE2e();
});
afterAll(async () => {
  await tearDownMapiE2e();
});

describe("MAPI E2E Tests", () => {
  const e2e: E2eContext = {};

  describe("Settings", () => {
    runSettingsTests();
  });

  describe("Organization", () => {
    runOrganizationTests();
  });

  describe("Facility", () => {
    runFacilityTestsPart1(e2e);
  });

  describe("Patient", () => {
    runPatientTestsPart1(e2e);
  });

  describe("Cohort", () => {
    runCohortTestsPart1(e2e);
  });

  describe("Contributed", () => {
    runContributedTests(e2e);
  });

  describe("Consolidated", () => {
    runConsolidatedTests(e2e);
  });

  describe("Document Query", () => {
    runDocumentQueryTests(e2e);
  });

  describe("Patient Part 2", () => {
    runPatientTestsPart2(e2e);
  });

  describe("Cohort Part2", () => {
    runCohortTestsPart2(e2e);
  });

  describe("Facility Part 2", () => {
    runFacilityTestsPart2(e2e);
  });
});
