// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const dataFiles = [
  "170.314B2_Amb_CCD.cda",
  "Care_Plan.cda",
  "CCD.cda",
  "C-CDA_R2-1_CCD.xml.cda",
  "CCD-Parent-Document-Replace-C-CDAR2.1.cda",
  "CDA_with_Embedded_PDF.cda",
  "Consultation_Note.cda",
  "Consult-Document-Closing-Referral-C-CDAR2.1.cda",
  "Diagnostic_Imaging_Report.cda",
  "Discharge_Summary.cda",
  "History_and_Physical.cda",
  "Operative_Note.cda",
  "Patient-1.cda",
  "Patient-and-Provider-Organization-Direct-Address-C-CDAR2.1.cda",
  "PROBLEMS_in_Empty_C-CDA_2.1-C-CDAR2.1.cda",
  "Procedure_Note.cda",
  "Progress_Note.cda",
  "Referral_Note.cda",
  "sample.cda",
  "Transfer_Summary.cda",
  "Unstructured_Document_embed.cda",
  "Unstructured_Document_reference.cda",
];
const templateFiles = ["ccd.hbs"];

module.exports = () => {
  const cases = [];
  dataFiles.forEach(dataFile =>
    cases.push(...templateFiles.map(templateFile => ({ dataFile, templateFile })))
  );
  return cases;
};
