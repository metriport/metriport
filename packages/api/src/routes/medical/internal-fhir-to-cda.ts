import { ConverterService } from "../../fern/api/resources/medical/resources/converter/service/ConverterService";

export function createConverterService() {
  return new ConverterService({
    convertToFhir: async (req, res) => {
      // send stuff to libary function through req.body
      //
      res.send([]);
    },
  });
}
