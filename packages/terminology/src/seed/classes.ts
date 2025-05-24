/** @see https://www.ncbi.nlm.nih.gov/books/NBK9685/table/ch03.T.simple_concept_and_atom_attribute */
export class UmlsAttribute {
  /** Unique identifier for concept (if METAUI is a relationship identifier, this will be CUI1 for that relationship). */
  readonly CUI: string;
  /** Unique identifier for term (optional - present for atom attributes, but not for relationship attributes). */
  readonly LUI: string;
  /** Unique identifier for string (optional - present for atom attributes, but not for relationship attributes). */
  readonly SUI: string;
  /** Metathesaurus atom identifier (will have a leading A) or Metathesaurus relationship identifier (will have a leading R) or blank if it is a concept attribute. */
  readonly AUI: string;
  /** The name of the column in MRCONSO.RRF or MRREL.RRF that contains the identifier to which the attribute is attached, i.e. AUI, CODE, CUI, RUI, SCUI, SDUI. */
  readonly STYPE: string;
  /** Most useful source asserted identifier (if the source vocabulary contains more than one) or a Metathesaurus-generated source entry identifier (if the source vocabulary has none). Optional - present if METAUI is an AUI. */
  readonly CODE: string;
  /** Unique identifier for attribute. */
  readonly ATUI: string;
  /** Source asserted attribute identifier (optional - present if it exists). */
  readonly SATUI: string;
  /**
   * Attribute name.
   *
   * @see http://www.nlm.nih.gov/research/umls/knowledge_sources/metathesaurus/release/attribute_names.html
   */
  readonly ATN: string;
  /**
   * Source abbreviation.  This uniquely identifies the underlying source vocabulary.
   *
   * @see https://www.nlm.nih.gov/research/umls/sourcereleasedocs/index.html
   */
  readonly SAB: string;
  /**
   * Attribute value described under specific attribute name on the Attributes Names page.
   *
   * @see http://www.nlm.nih.gov/research/umls/knowledge_sources/metathesaurus/release/abbreviations.html
   */
  readonly ATV: string;
  /**
   * Suppressible flag.
   *
   * O = All obsolete content, whether they are obsolesced by the source or by NLM
   * E = Non-obsolete content marked suppressible by an editor
   * Y = Non-obsolete content deemed suppressible during inversion
   * N = None of the above (not suppressible)
   */
  readonly SUPPRESS;

  constructor(line: string) {
    [
      this.CUI,
      this.LUI,
      this.SUI,
      this.AUI,
      this.STYPE,
      this.CODE,
      this.ATUI,
      this.SATUI,
      this.ATN,
      this.SAB,
      this.ATV,
      this.SUPPRESS,
    ] = line.split("|");
  }
}

/** @see https://www.ncbi.nlm.nih.gov/books/NBK9685/table/ch03.T.concept_names_and_sources_file_mr */
export class UmlsConcept {
  /** Unique identifier for concept, assigned by UMLS. */
  readonly CUI: string;
  /** Language of Term(s), e.g. "ENG" */
  readonly LAT: string;
  /** Term status, e.g. "P" (preferred) or "S" (non-preferred).  This indicates whether UMLS prefers this specific word choice overall, not whether the term is preferred in its code system. */
  readonly TS: string;
  /**  Unique identifier for term, assigned by UMLS. */
  readonly LUI: string;
  /**
   * String type.  This indicates the UMLS-preferred word order, not whether the code system itself prefers it.
   *
   * PF = Preferred form of term
   * VCW = Case and word-order variant of the preferred form
   * VC = Case variant of the preferred form
   * VO = Variant of the preferred form
   * VW = Word-order variant of the preferred form
   */
  readonly STT: string;
  /** Unique identifier for string. */
  readonly SUI: string;
  /** Indicates whether this coding is preferred in its own code system, either "Y" (preferred) or "N" (non-preferred). */
  readonly ISPREF: string;
  /** Atom Unique Identifiers. */
  readonly AUI: string;
  /** Source asserted atom identifier. */
  readonly SAUI: string;
  /** Source asserted concept identifier. */
  readonly SCUI: string;
  /** Source asserted descriptor identifier. */
  readonly SDUI: string;
  /**
   * Source abbreviation.  This uniquely identifies the underlying source vocabulary.
   *
   * @see https://www.nlm.nih.gov/research/umls/sourcereleasedocs/index.html
   */
  readonly SAB: string;
  /**
   * Term type in source, e.g. "PT" (Preferred Term).  This identifies the type of display string this term represents.
   *
   * @see https://www.nlm.nih.gov/research/umls/knowledge_sources/metathesaurus/release/abbreviations.html#mrdoc_TTY
   */
  readonly TTY: string;
  /** Unique Identifier or code for string in source. */
  readonly CODE: string;
  /** String description for the code. */
  readonly STR: string;
  /** Source Restriction Level. */
  readonly SRL: string;
  /**
   * Suppressible flag.
   *
   * O = All obsolete content, whether they are obsolesced by the source or by NLM
   * E = Non-obsolete content marked suppressible by an editor
   * Y = Non-obsolete content deemed suppressible during inversion
   * N = None of the above (not suppressible)
   */
  readonly SUPPRESS;

  constructor(line: string) {
    [
      this.CUI,
      this.LAT,
      this.TS,
      this.LUI,
      this.STT,
      this.SUI,
      this.ISPREF,
      this.AUI,
      this.SAUI,
      this.SCUI,
      this.SDUI,
      this.SAB,
      this.TTY,
      this.CODE,
      this.STR,
      this.SRL,
      this.SUPPRESS,
    ] = line.split("|");
  }

  toString(): string {
    return [
      this.CUI,
      this.LAT,
      this.TS,
      this.LUI,
      this.STT,
      this.SUI,
      this.ISPREF,
      this.AUI,
      this.SAUI,
      this.SCUI,
      this.SDUI,
      this.SAB,
      this.TTY,
      this.CODE,
      this.STR,
      this.SRL,
      this.SUPPRESS,
    ].join("|");
  }
}
