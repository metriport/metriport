import { ASCII_START, ASCII_END, CHARACTER_SET, INITIAL_STATE, NOWHERE } from "./constants";
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

  search(text: string, handler: (word: string, start: number, end: number) => void) {
    let currentState = 0;
    for (let i = 0; i < text.length; i++) {
      const nextChar = text[i] as string;
      currentState = this.findNextState(currentState, nextChar);
      const currentStateOutput = this.output[currentState] as boolean[];
      // If match not found, move to next state
      if (currentStateOutput.every(output => !output)) continue;

      // Match found, return the match to the callback function
      for (let j = 0; j < this.searchTerms.length; ++j) {
        if (currentStateOutput[j]) {
          const searchTerm = this.searchTerms[j];
          if (!searchTerm) continue;
          handler(searchTerm, i - searchTerm.length + 1, i);
        }
      }
    }
  }

  /**
   * Returns the state index that this automaton would transition to after encountering the given character.
   * @param currentState
   * @param nextChar
   * @returns
   */
  findNextState(currentState: number, nextChar: string): number {
    let finalState = currentState;

    // Do not transition states for invalid characters that were ignored when the automaton was constructed
    const char = nextChar.charCodeAt(0) - ASCII_START;
    if (char < 0 || char >= CHARACTER_SET.length) {
      return currentState;
    }

    // Transition to the most optimal next state
    const stateTransition = this.nextState[finalState] as number[];
    let finalStateTransition = stateTransition;
    while (finalStateTransition[char] === NOWHERE) {
      finalState = this.failureState[finalState] as number;
      finalStateTransition = this.nextState[finalState] as number[];
    }
    return finalStateTransition[char] as number;
  }

  // Below is a modified implementation of the Aho-Corasick algorithm, specifically optimized for working with the
  // ASCII character ranges that are typically found in medical text.
  // https://en.wikipedia.org/wiki/Aho%E2%80%93Corasick_algorithm

  /**
   * Constructs the search automaton by adding each word into the state transition tables.
   */
  private buildAutomaton() {
    this.addSearchTermsToAutomaton();
    this.addReferencesToInitialState();
    this.computeOptimalFailureStates();
  }

  /**
   * Adds each search term to the search automaton. This is effectively the same as the process of constructing a
   * Trie, but with a more efficient space implementation which allows the optimal failure state to be efficiently
   * computed.
   */
  private addSearchTermsToAutomaton() {
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

  /**
   * Configures state 0 to be "self-referential", i.e. any character that was not configured in
   * the state transitions above will automatically transition to state 0.
   */
  private addReferencesToInitialState() {
    const nextStateFromInitialState = this.nextState[INITIAL_STATE] as number[];
    for (let char = 0; char < CHARACTER_SET.length; char++) {
      const firstState = nextStateFromInitialState[char];
      if (firstState == NOWHERE) {
        nextStateFromInitialState[char] = INITIAL_STATE;
      }
    }
  }

  /**
   * Compresses the automaton by removing unnecessary states and transitions.
   */
  private computeOptimalFailureStates() {
    const nextStateFromInitialState = this.nextState[INITIAL_STATE] as number[];
    // Compute the "failure function", which finds the most efficient continuation point in the automaton
    // when a "failure" (i.e. a character mismatch) occurs.
    const queue: number[] = [];
    for (let char = 0; char < CHARACTER_SET.length; char++) {
      const firstState = nextStateFromInitialState[char] as number;
      if (firstState != INITIAL_STATE) {
        this.failureState[firstState] = 0;
        queue.push(firstState);
      }
    }

    // Iterate over all states to find failure transitions where there is not a defined
    // state transition.
    while (queue.length > 0) {
      const state = queue.shift() as number;

      // For each character in the alphabet, find the failure state for the current state
      for (let char = 0; char < CHARACTER_SET.length; char++) {
        const nextState = this.nextState[state];
        if (!nextState) continue;

        if (nextState[char] != NOWHERE) {
          // Find failure state of removed state
          let failure = this.failureState[state] as number;

          // Find the deepest node labeled by proper suffix of string from root to current state.
          const nextFailureState = this.nextState[failure] as number[];
          while (nextFailureState[char] == NOWHERE) {
            failure = this.failureState[failure] as number;
          }

          failure = nextFailureState[char] as number;
          const nextFailure = nextState[char] as number;
          this.failureState[nextFailure] = failure;

          // Merge output values
          const gotoOutput = this.output[nextFailure] as boolean[];
          const failureOutput = this.output[failure] as boolean[];

          for (let i = 0; i < gotoOutput.length; i++) {
            gotoOutput[i] = gotoOutput[i] || failureOutput[i] || false;
          }

          // Insert the next level node (of Trie) in Queue
          queue.push(nextState[char] as number);
        }
      }
    }
  }

  getSearchTerms() {
    return this.searchTerms;
  }
}
