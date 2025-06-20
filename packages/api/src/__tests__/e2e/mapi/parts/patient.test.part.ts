/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { faker } from "@faker-js/faker";
import { OperationOutcomeError } from "@medplum/core";
import { PatientDTO, PatientUpdate } from "@metriport/api-sdk";
import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { E2eContext, fhirApi, fhirHeaders, medicalApi } from "../shared";
import {
  createPatient,
  patientDtoToFhir,
  validateFhirPatient,
  validateLocalPatient,
} from "./patient";

dayjs.extend(duration);

const waitTimeBetweenPdAndDq = dayjs.duration({ seconds: 1 }); // not much needed, we schedule DQ if PD still in progress

const getPatient = async (patientId: string): Promise<PatientDTO> => {
  return await medicalApi.getPatient(patientId);
};

const getFhirPatient = async (patientId: string) => {
  fhirApi.invalidateAll();
  return await fhirApi.readResource("Patient", patientId, fhirHeaders);
};

export function runPatientTestsPart1(e2e: E2eContext) {
  it("creates and gets the patient", async () => {
    if (!e2e.facility) throw new Error("Missing facility");
    e2e.patient = await medicalApi.createPatient(createPatient, e2e.facility.id);
    e2e.patientFhir = patientDtoToFhir(e2e.patient);
    console.log(`Created patient: ${e2e.patient.id}`);
    await sleep(100);
    const [createdPatient, fhirPatient] = await Promise.all([
      getPatient(e2e.patient.id),
      getFhirPatient(e2e.patient.id),
    ]);
    validateLocalPatient(createdPatient, createPatient);
    validateLocalPatient(createdPatient, e2e.patient);
    validateFhirPatient(fhirPatient, e2e.patient);
  });

  it("updates a patient", async () => {
    const patient = e2e.patient;
    if (!patient) throw new Error("Missing patient");
    if (!e2e.facility) throw new Error("Missing facility");
    const patientUpdate: PatientUpdate = {
      ...createPatient,
      id: patient.id,
      lastName: patient.lastName + `_${faker.person.lastName()}`,
    };
    e2e.patient = await medicalApi.updatePatient(patientUpdate, e2e.facility.id);
    expect(e2e.patient.lastName).toEqual(patientUpdate.lastName);
    e2e.patient = await getPatient(e2e.patient.id);
    expect(e2e.patient.lastName).toEqual(patientUpdate.lastName);
  });

  it("awaits patient update to be replicated", async () => {
    // Creating a CW patient is done in the background need to await so we can query docs
    await sleep(waitTimeBetweenPdAndDq.asMilliseconds());
  });
}

export function runPatientTestsPart2(e2e: E2eContext) {
  it("gives some time for other processes to finish", async () => {
    await sleep(5_000);
  });

  it("deletes the patients", async () => {
    if (!e2e.patient) throw new Error("Missing patient");
    if (!e2e.facility) throw new Error("Missing facility");
    await medicalApi.deletePatient(e2e.patient.id, e2e.facility.id);
    await sleep(100);
    expect(async () => getPatient(e2e.patient!.id)).rejects.toThrow(
      "Request failed with status code 404"
    );
    expect(async () => getFhirPatient(e2e.patient!.id)).rejects.toThrowError(OperationOutcomeError);
  });
}
