const b64String = "c29tZSBwYXRpZW50IGRhdGE=";
const b64StringValuable = "dmFsdWFibGUgcGF0aWVudCBkYXRhIA==";
const b64StringProtected = "c2VjcmV0IHBhdGllbnQgZGF0YSA=";
const emptyComponent = [];
const componentWithEmptyObservations = [{ observation: {} }];
const componentWithEmptyValue = [{ observation: { value: {} } }];
const component = [
  { observation: { value: { _b64: b64StringValuable } } },
  { observation: { value: { _b64: b64StringProtected } } },
];

const makePresentedFormEntry = strings => {
  return strings.map(string => {
    return {
      data: string,
      contentType: "text/plain",
    };
  });
};

module.exports = {
  b64String,
  b64StringValuable,
  b64StringProtected,
  makePresentedFormEntry,
  emptyComponent,
  componentWithEmptyObservations,
  componentWithEmptyValue,
  component,
};
