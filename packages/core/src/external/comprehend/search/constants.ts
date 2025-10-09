// Recognized ASCII range for matching characters
export const ASCII_START = 32;
export const ASCII_END = 126;
export const CHARACTER_SET = new Array(ASCII_END - ASCII_START + 1)
  .fill(0)
  .map((_, i) => String.fromCharCode(i + ASCII_START));

// State constants
export const INITIAL_STATE = 0;
export const NOWHERE = -1;
