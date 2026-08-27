export type HtmlToPdfInput = {
  htmlFileName: string;
  pdfFileName: string;
  cxId: string;
  patientId: string;
};

export type HtmlToPdfOutput = {
  pdfFileName: string;
  signedUrl: string;
};
