import { SearchAutomaton } from "../search/search-automaton";

describe("Search automaton test", () => {
  /**
   * This is a classic textbook example which ensures that suffix links work properly.
   */
  it("should work on a textbook example", () => {
    const automaton = new SearchAutomaton(["he", "she", "his", "hers"]);
    expect(automaton.findAll("ushers")).toEqual([
      { searchTerm: "he", startIndex: 2, endIndex: 4 },
      { searchTerm: "she", startIndex: 1, endIndex: 4 },
      { searchTerm: "hers", startIndex: 2, endIndex: 6 },
    ]);
  });

  it("should work on overlapping matches", () => {
    const automaton = new SearchAutomaton(["aba", "bab"]);
    expect(automaton.findAll("ababa")).toEqual([
      { searchTerm: "aba", startIndex: 0, endIndex: 3 },
      { searchTerm: "bab", startIndex: 1, endIndex: 4 },
      { searchTerm: "aba", startIndex: 2, endIndex: 5 },
    ]);
  });

  it("should work on shared prefixes", () => {
    const automaton = new SearchAutomaton(["a", "ab", "abc"]);
    expect(automaton.findAll("abcab")).toEqual([
      { searchTerm: "a", startIndex: 0, endIndex: 1 },
      { searchTerm: "ab", startIndex: 0, endIndex: 2 },
      { searchTerm: "abc", startIndex: 0, endIndex: 3 },
      { searchTerm: "a", startIndex: 3, endIndex: 4 },
      { searchTerm: "ab", startIndex: 3, endIndex: 5 },
    ]);
  });

  it("should follow failure links back on partial matches", () => {
    const automaton = new SearchAutomaton(["abcd", "bcd", "cd"]);
    expect(automaton.findAll("xabcdcdy")).toEqual([
      { searchTerm: "abcd", startIndex: 1, endIndex: 5 },
      { searchTerm: "bcd", startIndex: 2, endIndex: 5 },
      { searchTerm: "cd", startIndex: 3, endIndex: 5 },
      { searchTerm: "cd", startIndex: 5, endIndex: 7 },
    ]);
  });

  it("should not report false positives", () => {
    const automaton = new SearchAutomaton(["xyz", "123"]);
    expect(automaton.findAll("yzabcdefgxy xyyz 121223 xya bxy 93210 2124")).toEqual([]);
  });

  it("should be able to search within a long clinical text for several keywords", () => {
    const automaton = new SearchAutomaton(["Medications:", "MEDS:", "MEDICATIONS"]);

    expect(
      automaton.findAll("MEDICATIONS: 10 mg tylenol, 20 mg ibuprofen, ... Medications: MEDS:")
    ).toEqual([
      { searchTerm: "MEDICATIONS", startIndex: 0, endIndex: 11 },
      { searchTerm: "Medications:", startIndex: 49, endIndex: 61 },
      { searchTerm: "MEDS:", startIndex: 62, endIndex: 67 },
    ]);
  });

  it("should be able to search for multiple terms", () => {
    const automaton = new SearchAutomaton(["hello", "world"]);
    expect(automaton.findAll("hello world")).toEqual([
      { searchTerm: "hello", startIndex: 0, endIndex: 5 },
      { searchTerm: "world", startIndex: 6, endIndex: 11 },
    ]);

    expect(automaton.findAll("world hello")).toEqual([
      { searchTerm: "world", startIndex: 0, endIndex: 5 },
      { searchTerm: "hello", startIndex: 6, endIndex: 11 },
    ]);

    expect(automaton.findAll("world hello world")).toEqual([
      { searchTerm: "world", startIndex: 0, endIndex: 5 },
      { searchTerm: "hello", startIndex: 6, endIndex: 11 },
      { searchTerm: "world", startIndex: 12, endIndex: 17 },
    ]);
  });

  it("should be able to search for multiple terms with overlapping matches", () => {
    const automaton = new SearchAutomaton(["aaa", "bbb", "aba", "bab", "baba"]);
    expect(automaton.findAll("aaabbbabababbb")).toEqual([
      { searchTerm: "aaa", startIndex: 0, endIndex: 3 },
      { searchTerm: "bbb", startIndex: 3, endIndex: 6 },
      { searchTerm: "bab", startIndex: 5, endIndex: 8 },
      { searchTerm: "aba", startIndex: 6, endIndex: 9 },
      { searchTerm: "baba", startIndex: 5, endIndex: 9 },
      { searchTerm: "bab", startIndex: 7, endIndex: 10 },
      { searchTerm: "aba", startIndex: 8, endIndex: 11 },
      { searchTerm: "baba", startIndex: 7, endIndex: 11 },
      { searchTerm: "bab", startIndex: 9, endIndex: 12 },
      { searchTerm: "bbb", startIndex: 11, endIndex: 14 },
    ]);
  });
});
