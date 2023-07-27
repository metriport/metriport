import { makeDocRefMapping } from "../../../domain/medical/__tests__/docref-mapping";
import { DocRefMapping } from "../../../domain/medical/docref-mapping";
import { DocRefMappingModel } from "../docref-mapping";

export const makeDocRefMappingModel = (params?: Partial<DocRefMapping>): DocRefMappingModel =>
  makeDocRefMapping(params) as DocRefMappingModel;
