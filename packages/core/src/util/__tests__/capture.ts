import { Capture } from "../capture";

export function mockCapture(): Capture {
  return {
    error: jest.fn(),
    message: jest.fn(),
  };
}
