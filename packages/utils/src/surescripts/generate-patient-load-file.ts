#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import { SurescriptsSftpClient } from "@metriport/core/external/sftp/surescripts/client";
import { SurescriptsApi } from "@metriport/core/external/sftp/surescripts/api";
import { toSurescriptsPatientLoadFile } from "@metriport/core/external/sftp/surescripts/message";
import { SurescriptsReplica } from "@metriport/core/external/sftp/surescripts/replica";

const program = new Command();

program
  .name("generate-plf")
  .option("-cx, --cx-id <cx>", "The CX ID of the requester")
  .option("-f, --facility-id <facility>", "The facility ID of the requester")
  .description("Generate a patient load file and place into the outgoing replica directory")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async () => {
    const { cxId, facilityId } = program.opts();
    console.log("Generating patient load file...");

    if (!cxId) throw new Error("CX ID is required");
    if (!facilityId) throw new Error("Facility ID is required");

    const api = new SurescriptsApi();
    const client = new SurescriptsSftpClient({});

    const customer = await api.getCustomer(cxId);
    const facility = customer.facilities.find(f => f.id === facilityId);

    if (!facility) throw new Error(`Facility ${facilityId} not found`);

    const transmission = client.createEnrollment({
      npiNumber: facility.npi,
      cxId,
    });

    const patientIds = await api.getPatientIds(cxId);
    const patients = await Promise.all(patientIds.patientIds.map(id => api.getPatient(cxId, id)));
    console.log("Found " + patients.length + " patients");
    const message = toSurescriptsPatientLoadFile(client, transmission, []);

    // const fileName = client.getPatientLoadFileName(transmission);
    const replica = new SurescriptsReplica({ sftpClient: client });
    await replica.writePatientLoadFileToStorage(transmission, message);
  });

export default program;
