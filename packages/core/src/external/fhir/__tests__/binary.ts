import { Binary } from "@medplum/fhirtypes";
import { v4 as uuidv4 } from "uuid";

const makeData = () =>
  JSON.stringify({
    prop1: "value of prop1",
    prop2: "value of prop2",
    prop3: "value of prop3",
  });

export const makeBinary = ({ id, data } = { id: uuidv4(), data: makeData() }): Binary => ({
  resourceType: "Binary",
  id,
  contentType: "application/json",
  data: data,
});
