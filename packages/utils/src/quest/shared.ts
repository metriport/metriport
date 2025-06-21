import fs from "fs";
import csv from "csv-parser";

interface PatientTransmission {
  cxId: string;
  patientId: string;
  transmissionId: string;
}

export async function getTransmissionsFromCsv(
  cxId: string,
  csvData: string
): Promise<PatientTransmission[]> {
  return new Promise((resolve, reject) => {
    const transmissions: PatientTransmission[] = [];
    fs.createReadStream(csvData)
      .pipe(csv())
      .on("data", function (row) {
        transmissions.push({
          cxId,
          patientId: row.patient_id,
          transmissionId: row.transmission_id,
        });
      })
      .on("end", function () {
        resolve(transmissions);
      })
      .on("error", function (error) {
        reject(error);
      });
  });
}
