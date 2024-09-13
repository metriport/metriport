type ParamRoutes = { basePath: string; paramPaths: { regex: RegExp; matchIndex: number }[] };

export const patientParamRoutes: ParamRoutes = {
  basePath: "/medical/v1/patient",
  paramPaths: [
    { regex: new RegExp("^(/medical/v1/patient/)(([a-z]|[A-Z]|[0-9])+)$"), matchIndex: 2 },
    {
      regex: new RegExp("^(/medical/v1/patient/)(([a-z]|[A-Z]|[0-9])+)(/consolidated/count)$"),
      matchIndex: 2,
    },
    {
      regex: new RegExp("^(/medical/v1/patient/)(([a-z]|[A-Z]|[0-9])+)(/consolidated/query)$"),
      matchIndex: 2,
    },
    {
      regex: new RegExp("^(/medical/v1/patient/)(([a-z]|[A-Z]|[0-9])+)(/consolidated/webhook)$"),
      matchIndex: 2,
    },
    {
      regex: new RegExp("^(/medical/v1/patient/)(([a-z]|[A-Z]|[0-9])+)(/medical-record)$"),
      matchIndex: 2,
    },
    {
      regex: new RegExp("^(/medical/v1/patient/)(([a-z]|[A-Z]|[0-9])+)(/medical-record-status)$"),
      matchIndex: 1,
    },
  ],
};
