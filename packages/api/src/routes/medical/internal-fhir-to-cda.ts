import { ConverterService } from "@metriport/core/src/fhir-to-cda/fern/api/resources/medical/resources/converter/service/ConverterService";
import { splitBundleByCompositions } from "@metriport/core/fhir-to-cda/composition-splitter";

export function createConverterService() {
  return new ConverterService({
    convertToFhir: async (req, res) => {
      // send stuff to libary function through req.body
      res.send([]);
    },
  });
}
