/* eslint-disable @typescript-eslint/no-empty-function */
import { OperationOutcomeError } from "@medplum/core";
import { OperationOutcome, OperationOutcomeIssue, ResourceType } from "@medplum/fhirtypes";
import { v4 as uuidv4 } from "uuid";
import { operationOutcomeIssueToString } from "@metriport/core/external/fhir/shared";
import { FhirErrorMapping, groupFHIRErrors, tryDetermineFhirError } from "../error-mapping";

const toOperationOutcome = (issue: OperationOutcomeIssue[]): OperationOutcome => ({
  resourceType: "OperationOutcome",
  issue,
});

interface LocalOperationOutcomeIssue extends OperationOutcomeIssue {
  _resource: ResourceType;
  _element?: string;
  _value: string;
}
const toExpected = (outcome: LocalOperationOutcomeIssue): FhirErrorMapping => ({
  resourceType: outcome._resource,
  ...(outcome._element ? { element: outcome._element } : {}),
  invalidValue: outcome._value,
  originalError: operationOutcomeIssueToString(outcome),
});

describe("FHIR error mapping", () => {
  describe("tryDetermineMappingError", () => {
    describe("FHIR related errors", () => {
      const operationOutcomeArray: LocalOperationOutcomeIssue[] = [
        {
          severity: "error",
          code: "processing",
          diagnostics:
            `HAPI-0450: Failed to parse request body as JSON resource. Error was: HAPI-1821: [element="status"] ` +
            `Invalid attribute value "Completed": Unknown MedicationStatementStatus code 'Completed'`,
          _resource: "MedicationStatement",
          _element: "status",
          _value: "Completed",
        },
        {
          severity: "error",
          code: "processing",
          diagnostics:
            `HAPI-0450: Failed to parse request body as JSON resource. Error was: HAPI-1821: [element="status"] ` +
            `Invalid attribute value "Discontinued": Unknown MedicationStatementStatus code 'Discontinued'`,
          _resource: "MedicationStatement",
          _element: "status",
          _value: "Discontinued",
        },
        {
          severity: "error",
          code: "processing",
          diagnostics:
            `HAPI-0450: Failed to parse request body as JSON resource. Error was: HAPI-1821: [element="status"] ` +
            `Invalid attribute value "new": Unknown MedicationStatementStatus code 'new'`,
          _resource: "MedicationStatement",
          _element: "status",
          _value: "new",
        },
        {
          severity: "error",
          code: "processing",
          diagnostics:
            `HAPI-0450: Failed to parse request body as JSON resource. Error was: HAPI-1821: [element="status"] ` +
            `Invalid attribute value "aborted": Unknown MedicationRequestStatus code 'aborted'`,
          _resource: "MedicationRequest",
          _element: "status",
          _value: "aborted",
        },
        {
          severity: "error",
          code: "processing",
          diagnostics:
            `HAPI-0450: Failed to parse request body as JSON resource. Error was: HAPI-1821: [element="severity"] ` +
            `Invalid attribute value "Severe": Unknown AllergyIntoleranceSeverity code 'Severe'`,
          _resource: "AllergyIntolerance",
          _element: "severity",
          _value: "Severe",
        },
        {
          severity: "error",
          code: "processing",
          diagnostics:
            `HAPI-0450: Failed to parse request body as JSON resource. Error was: HAPI-1821: [element="severity"] ` +
            `Invalid attribute value "Unknown": Unknown AllergyIntoleranceSeverity code 'Unknown'`,
          _resource: "AllergyIntolerance",
          _element: "severity",
          _value: "Unknown",
        },
        {
          severity: "error",
          code: "processing",
          diagnostics:
            `HAPI-0450: Failed to parse request body as JSON resource. Error was: HAPI-1821: [element="severity"] ` +
            `Invalid attribute value "Moderate": Unknown AllergyIntoleranceSeverity code 'Moderate'`,
          _resource: "AllergyIntolerance",
          _element: "severity",
          _value: "Moderate",
        },
      ];

      it(`works with single issue`, async () => {
        const outcome = operationOutcomeArray[0];
        const res = tryDetermineFhirError(new OperationOutcomeError(toOperationOutcome([outcome])));
        expect(res).toBeTruthy();
        expect(res.type).toEqual("mapping");
        if (res.type === "mapping") {
          expect(res.errors).toEqual(expect.arrayContaining([toExpected(outcome)]));
        } else {
          fail("should be mapping error");
        }
      });

      it(`works without element`, async () => {
        const outcome: LocalOperationOutcomeIssue = {
          severity: "error",
          code: "processing",
          diagnostics: `Invalid attribute value "Completed": Unknown MedicationStatementStatus code 'Completed'`,
          _resource: "MedicationStatement",
          _value: "Completed",
        };
        const res = tryDetermineFhirError(new OperationOutcomeError(toOperationOutcome([outcome])));
        expect(res).toBeTruthy();
        expect(res.type).toEqual("mapping");
        if (res.type === "mapping") {
          expect(res.errors).toEqual(
            expect.arrayContaining([
              {
                resourceType: "MedicationStatementStatus",
                invalidValue: outcome._value,
                originalError: outcome.diagnostics,
              },
            ])
          );
        } else {
          fail("should be mapping error");
        }
      });

      it(`works with multiple issues`, async () => {
        const outcomeArr = operationOutcomeArray.slice(0, 5);
        const res = tryDetermineFhirError(
          new OperationOutcomeError(toOperationOutcome(outcomeArr))
        );
        expect(res).toBeTruthy();
        if (res.type === "mapping") {
          expect(res.errors).toEqual(expect.arrayContaining(outcomeArr.map(toExpected)));
        } else {
          fail("should be mapping error");
        }
      });

      describe("validate all issues as single errors", () => {
        for (const op of operationOutcomeArray) {
          it(`category ${op._resource}.${op._element}.${op._value}`, async () => {
            const res = tryDetermineFhirError(new OperationOutcomeError(toOperationOutcome([op])));
            expect(res).toBeTruthy();
            if (res.type === "mapping") {
              expect(res.errors).toEqual(expect.arrayContaining([toExpected(op)]));
            } else {
              fail("should be mapping error");
            }
          });
        }
      });
    });

    describe("timeout errors", () => {
      const timeoutErrors = [
        `{"cause":{"name":"ConnectTimeoutError","code":"UND_ERR_CONNECT_TIMEOUT","message":"Connect Timeout Error"}}`,
        `{"cause":{"name":"HeadersTimeoutError","code":"UND_ERR_HEADERS_TIMEOUT","message":"Headers Timeout Error"}}`,
      ];
      for (const errMessage of timeoutErrors) {
        it(`returns 'timeout' for: ${errMessage}`, async () => {
          const res = tryDetermineFhirError(new Error(errMessage));
          expect(res).toBeTruthy();
          expect(res.type).toEqual("timeout");
        });
      }
    });

    describe("Other errors", () => {
      const otherErrors = [
        `{"cause": {"name": "SocketError", "code": "UND_ERR_SOCKET", "socket": {"localAddress": "10.0.208.202", "localPort": 46892, "remoteAddress": "10.0.213.19", "remotePort": 80, "remoteFamily": "IPv4", "bytesWritten": 338744, "bytesRead": 48770}}}`,
        `Some other random error`,
      ];
      for (const errMessage of otherErrors) {
        it(`returns 'unknown' for: ${errMessage}`, async () => {
          const res = tryDetermineFhirError(new Error(errMessage));
          expect(res).toBeTruthy();
          expect(res.type).toEqual("unknown");
        });
      }
    });
  });

  describe("groupFHIRErrors", () => {
    it(`works with single error`, async () => {
      const issue = {
        resourceType: "MedicationStatement",
        element: "status",
        invalidValue: "Completed",
        originalError: `Invalid attribute value "Completed": Unknown MedicationStatementStatus code 'Completed'`,
      };
      const res = groupFHIRErrors([issue]);
      expect(res).toBeTruthy();
      const keys = Object.keys(res);
      expect(keys.length).toEqual(1);
      expect(keys[0]).toEqual("MedicationStatement.status");
    });
    it(`works with multiple errors`, async () => {
      const issues = [
        {
          resourceType: "MedicationStatement",
          element: "status",
          invalidValue: uuidv4(),
          originalError: uuidv4(),
        },
        {
          resourceType: "AllergyIntolerance",
          element: "severity",
          invalidValue: uuidv4(),
          originalError: uuidv4(),
        },
        {
          resourceType: "MedicationStatement",
          element: "status",
          invalidValue: uuidv4(),
          originalError: uuidv4(),
        },
        {
          resourceType: "MedicationStatement",
          element: "aotherProp",
          invalidValue: uuidv4(),
          originalError: uuidv4(),
        },
      ];
      const res = groupFHIRErrors(issues);
      expect(res).toBeTruthy();
      const keys = Object.keys(res);
      expect(keys.length).toEqual(3);

      const key1 = "MedicationStatement.status";
      expect(keys).toEqual(expect.arrayContaining([key1]));
      expect(res[key1]?.length).toEqual(2);
      expect(res[key1]).toEqual(expect.arrayContaining([issues[0], issues[2]]));

      const key2 = "MedicationStatement.aotherProp";
      expect(keys).toEqual(expect.arrayContaining([key2]));
      expect(res[key2]?.length).toEqual(1);
      expect(res[key2]).toEqual(expect.arrayContaining([issues[3]]));

      const key3 = "AllergyIntolerance.severity";
      expect(keys).toEqual(expect.arrayContaining([key3]));
      expect(res[key3]?.length).toEqual(1);
      expect(res[key3]).toEqual(expect.arrayContaining([issues[1]]));
    });
  });
});
