const functionFromProcessor = async (userContext, events, done) => {
  userContext.vars.requestBodyFromProcessor = "something";
  // continue with executing the scenario:
  return done();
};

// https://www.artillery.io/docs/guides/guides/http-reference#beforerequest-hooks
function setJSONBody(requestParams, context, ee, next) {
  // ...
  return next(); // MUST be called for the scenario to continue
}

// https://www.artillery.io/docs/guides/guides/http-reference#afterresponse-hooks
function logHeaders(requestParams, response, context, ee, next) {
  console.log(response.headers);
  return next(); // MUST be called for the scenario to continue
}

module.exports = {
  functionFromProcessor,
  setJSONBody,
  logHeaders,
};
