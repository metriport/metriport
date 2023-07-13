const createDeepObject = (depth, rand) => {
  const origin = { "extra-property": "extra-value" };
  let current = origin;
  for (let i = 0; i < depth; ++i) {
    current[`property-${i}`] = {
      [`extra-property-${i}`]: `extra-value`,
      [`property-${i}`]: {},
    };
    current = current[`property-${i}`];
  }
  current[`property-inner`] = `value-${rand ? Math.random() : "inner"}`;
  return origin;
};

module.exports = {
  createDeepObject,
};
