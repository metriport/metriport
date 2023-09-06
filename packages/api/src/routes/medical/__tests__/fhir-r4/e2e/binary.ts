import { Binary } from "@medplum/fhirtypes";
import { nanoid } from "../../../../__tests__/shared";

const makeData = () =>
  JSON.stringify({
    prop1: "value of prop1",
    prop2: "value of prop2",
    prop3: "value of prop3",
  });

const defaultId = "2.16.840.1.113883.3.9621.666." + nanoid();

export const makeBinary = ({ id, data } = { id: defaultId, data: makeData() }): Binary => ({
  resourceType: "Binary",
  id,
  contentType: "application/json",
  data: data,
});
