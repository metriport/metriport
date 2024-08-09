import { USState } from "@metriport/shared";

function isKeyOfUSState(key: string): key is keyof typeof USState {
  return key in USState;
}

export function getStateEnum(state: string): USState | undefined {
  const upperCaseState = state.toUpperCase();
  if (isKeyOfUSState(upperCaseState)) {
    return USState[upperCaseState];
  }
  return undefined;
}
