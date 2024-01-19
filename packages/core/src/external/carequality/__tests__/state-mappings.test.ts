import { stateMappings } from "../pd/validating-pd";
import { USState } from "../../../domain/geographic-locations";

describe("State Mappings Validation", () => {
  it("should have an entry for every USState", () => {
    const allStates = Object.values(USState);
    const mappedStates = new Set(Object.values(stateMappings));

    allStates.forEach(state => {
      expect(mappedStates.has(state)).toBeTruthy();
    });
  });
});
