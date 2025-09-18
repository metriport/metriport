import { ASCII_START, ASCII_END, INITIAL_STATE, NOWHERE } from "./constants";
import { characterSetMap } from "./utils";

export class SearchAutomaton {
  private searchTerms: string[];
  private maxStates: number;

  private nextState: number[][];
  private failureState: number[];
  private output: boolean[][];

  constructor(searchTerms: string[]) {
    this.searchTerms = searchTerms;
    // Max number of states in the automaton is the sum of the lengths of all words + 1 for the zero (null) state.
    this.maxStates = searchTerms.reduce(function (characterCount, word) {
      return characterCount + word.length;
    }, 1);

    this.output = new Array(this.maxStates)
      .fill(null)
      .map(() => new Array(this.searchTerms.length).fill(false));
    this.nextState = new Array(this.maxStates).fill(null).map(() => characterSetMap());
    this.failureState = new Array(this.maxStates).fill(NOWHERE);

    this.buildAutomaton();
  }

  /**
   * Constructs the search automaton by adding each word into the state transition tables.
   */
  private buildAutomaton() {
    // Initially, there is only one state (the "zero state")
    let totalStates = 1;

    for (let termIndex = 0; termIndex < this.searchTerms.length; termIndex++) {
      const searchTerm = this.searchTerms[termIndex] as string;
      let currentState = INITIAL_STATE;

      // Insert all characters of current word into state transitions
      for (let charIndex = 0; charIndex < searchTerm.length; charIndex++) {
        const charCode = searchTerm.charCodeAt(charIndex);
        // Skip characters that are not in the searchable ASCII range
        if (charCode < ASCII_START || charCode >= ASCII_END) {
          continue;
        }
        const char = charCode - ASCII_START;

        // Create a new state if there is no next state already set for this character
        const stateTransition = this.nextState[currentState];
        if (!stateTransition) continue;
        if (stateTransition[char] == NOWHERE) {
          stateTransition[char] = totalStates++;
        }

        // Transition to the next state
        currentState = stateTransition[char] as number;
      }

      // Add reference to current word at final state
      const output = this.output[currentState] as boolean[];
      output[termIndex] = true;
    }
  }

  getSearchTerms() {
    return this.searchTerms;
  }
}
