import { DocumentExtractionJob } from "../../types";

export interface ExtractDocumentCommand {
  extractDocument(job: DocumentExtractionJob): Promise<void>;
}
