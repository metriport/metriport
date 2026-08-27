export const familyMemberHistoryRelationshipMap = {
  name: "FamilyMemberHistory",
  title: "FHIR v3 FamilyMember Value Set",
  resourceType: "ValueSet",
  url: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
  system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
  version: "2018-08-12",
  concept: [
    {
      code: "FAMMEMB",
      display: "family member",
      definition: 'A relationship between two people characterizing their "familial" relationship',
    },
    {
      code: "CHILD",
      display: "child",
      definition: "The player of the role is a child of the scoping entity.",
    },
    {
      code: "CHLDADOPT",
      display: "adopted child",
      definition:
        "The player of the role is a child taken into a family through legal means and raised by the scoping person (parent) as his or her own child.",
    },
    {
      code: "DAUADOPT",
      display: "adopted daughter",
      definition:
        "The player of the role is a female child taken into a family through legal means and raised by the scoping person (parent) as his or her own child.",
    },
    {
      code: "SONADOPT",
      display: "adopted son",
      definition:
        "The player of the role is a male child taken into a family through legal means and raised by the scoping person (parent) as his or her own child.",
    },
    {
      code: "CHLDFOST",
      display: "foster child",
      definition:
        "The player of the role is a child receiving parental care and nurture from the scoping person (parent) but not related to him or her through legal or blood ties.",
    },
    {
      code: "DAUFOST",
      display: "foster daughter",
      definition:
        "The player of the role is a female child receiving parental care and nurture from the scoping person (parent) but not related to him or her through legal or blood ties.",
    },
    {
      code: "SONFOST",
      display: "foster son",
      definition:
        "The player of the role is a male child receiving parental care and nurture from the scoping person (parent) but not related to him or her through legal or blood ties.",
    },
    {
      code: "DAUC",
      display: "daughter",
      definition:
        "The player of the role is a female child (of any type) of scoping entity (parent)",
    },
    {
      code: "DAU",
      display: "natural daughter",
      definition: "The player of the role is a female offspring of the scoping entity (parent).",
    },
    {
      code: "STPDAU",
      display: "stepdaughter",
      definition:
        "The player of the role is a daughter of the scoping person's spouse by a previous union.",
    },
    {
      code: "NCHILD",
      display: "natural child",
      definition:
        "The player of the role is an offspring of the scoping entity as determined by birth.",
    },
    {
      code: "SON",
      display: "natural son",
      definition: "The player of the role is a male offspring of the scoping entity (parent).",
    },
    {
      code: "SONC",
      display: "son",
      definition: "The player of the role is a male child (of any type) of scoping entity (parent)",
    },
    {
      code: "STPSON",
      display: "stepson",
      definition:
        "The player of the role is a son of the scoping person's spouse by a previous union.",
    },
    {
      code: "STPCHLD",
      display: "step child",
      definition:
        "The player of the role is a child of the scoping person's spouse by a previous union.",
    },
    {
      code: "EXT",
      display: "extended family member",
      definition:
        "A family member not having an immediate genetic or legal relationship e.g. Aunt, cousin, great grandparent, grandchild, grandparent, niece, nephew or uncle.",
    },
    {
      code: "AUNT",
      display: "aunt",
      definition: "The player of the role is a sister of the scoping person's mother or father.",
    },
    {
      code: "MAUNT",
      display: "maternal aunt",
      definition:
        "The player of the role is a biological sister of the scoping person's biological mother.",
    },
    {
      code: "PAUNT",
      display: "paternal aunt",
      definition:
        "The player of the role is a biological sister of the scoping person's biological father.",
    },
    {
      code: "COUSN",
      display: "cousin",
      definition:
        "The player of the role is a relative of the scoping person descended from a common ancestor, such as a grandparent, by two or more steps in a diverging line.",
    },
    {
      code: "MCOUSN",
      display: "maternal cousin",
      definition:
        "The player of the role is a biological relative of the scoping person descended from a common ancestor on the player's mother's side, such as a grandparent, by two or more steps in a diverging line.",
    },
    {
      code: "PCOUSN",
      display: "paternal cousin",
      definition:
        "The player of the role is a biological relative of the scoping person descended from a common ancestor on the player's father's side, such as a grandparent, by two or more steps in a diverging line.",
    },
    {
      code: "GGRPRN",
      display: "great grandparent",
      definition: "The player of the role is a parent of the scoping person's grandparent.",
    },
    {
      code: "GGRFTH",
      display: "great grandfather",
      definition: "The player of the role is the father of the scoping person's grandparent.",
    },
    {
      code: "MGGRFTH",
      display: "maternal great-grandfather",
      definition:
        "The player of the role is the biological father of the scoping person's biological mother's parent.",
    },
    {
      code: "PGGRFTH",
      display: "paternal great-grandfather",
      definition:
        "The player of the role is the biological father of the scoping person's biological father's parent.",
    },
    {
      code: "GGRMTH",
      display: "great grandmother",
      definition: "The player of the role is the mother of the scoping person's grandparent.",
    },
    {
      code: "MGGRMTH",
      display: "maternal great-grandmother",
      definition:
        "The player of the role is the biological mother of the scoping person's biological mother's parent.",
    },
    {
      code: "PGGRMTH",
      display: "paternal great-grandmother",
      definition:
        "The player of the role is the biological mother of the scoping person's biological father's parent.",
    },
    {
      code: "MGGRPRN",
      display: "maternal great-grandparent",
      definition:
        "The player of the role is a biological parent of the scoping person's biological mother's parent.",
    },
    {
      code: "PGGRPRN",
      display: "paternal great-grandparent",
      definition:
        "The player of the role is a biological parent of the scoping person's biological father's parent.",
    },
    {
      code: "GRNDCHILD",
      display: "grandchild",
      definition: "The player of the role is a child of the scoping person's son or daughter.",
    },
    {
      code: "GRNDDAU",
      display: "granddaughter",
      definition: "The player of the role is a daughter of the scoping person's son or daughter.",
    },
    {
      code: "GRNDSON",
      display: "grandson",
      definition: "The player of the role is a son of the scoping person's son or daughter.",
    },
    {
      code: "GRPRN",
      display: "grandparent",
      definition: "The player of the role is a parent of the scoping person's mother or father.",
    },
    {
      code: "GRFTH",
      display: "grandfather",
      definition: "The player of the role is the father of the scoping person's mother or father.",
    },
    {
      code: "MGRFTH",
      display: "maternal grandfather",
      definition:
        "The player of the role is the biological father of the scoping person's biological mother.",
    },
    {
      code: "PGRFTH",
      display: "paternal grandfather",
      definition:
        "The player of the role is the biological father of the scoping person's biological father.",
    },
    {
      code: "GRMTH",
      display: "grandmother",
      definition: "The player of the role is the mother of the scoping person's mother or father.",
    },
    {
      code: "MGRMTH",
      display: "maternal grandmother",
      definition:
        "The player of the role is the biological mother of the scoping person's biological mother.",
    },
    {
      code: "PGRMTH",
      display: "paternal grandmother",
      definition:
        "The player of the role is the biological mother of the scoping person's biological father.",
    },
    {
      code: "MGRPRN",
      display: "maternal grandparent",
      definition:
        "The player of the role is the biological parent of the scoping person's biological mother.",
    },
    {
      code: "PGRPRN",
      display: "paternal grandparent",
      definition:
        "The player of the role is the biological parent of the scoping person's biological father.",
    },
    {
      code: "INLAW",
      display: "inlaw",
      definition:
        "A relationship between an individual and a member of their spousal partner's immediate family.",
    },
    {
      code: "CHLDINLAW",
      display: "child-in-law",
      definition: "The player of the role is the spouse of scoping person's child.",
    },
    {
      code: "DAUINLAW",
      display: "daughter in-law",
      definition: "The player of the role is the wife of scoping person's son.",
    },
    {
      code: "SONINLAW",
      display: "son in-law",
      definition: "The player of the role is the husband of scoping person's daughter.",
    },
    {
      code: "PRNINLAW",
      display: "parent in-law",
      definition: "The player of the role is the parent of scoping person's husband or wife.",
    },
    {
      code: "FTHINLAW",
      display: "father-in-law",
      definition: "The player of the role is the father of the scoping person's husband or wife.",
    },
    {
      code: "MTHINLAW",
      display: "mother-in-law",
      definition: "The player of the role is the mother of the scoping person's husband or wife.",
    },
    {
      code: "SIBINLAW",
      display: "sibling in-law",
      definition:
        "The player of the role is: (1) a sibling of the scoping person's spouse, or (2) the spouse of the scoping person's sibling, or (3) the spouse of a sibling of the scoping person's spouse.",
    },
    {
      code: "BROINLAW",
      display: "brother-in-law",
      definition:
        "The player of the role is: (1) a brother of the scoping person's spouse, or (2) the husband of the scoping person's sister, or (3) the husband of a sister of the scoping person's spouse.",
    },
    {
      code: "SISINLAW",
      display: "sister-in-law",
      definition:
        "The player of the role is: (1) a sister of the scoping person's spouse, or (2) the wife of the scoping person's brother, or (3) the wife of a brother of the scoping person's spouse.",
    },
    {
      code: "NIENEPH",
      display: "niece/nephew",
      definition:
        "The player of the role is a child of scoping person's brother or sister or of the brother or sister of the scoping person's spouse.",
    },
    {
      code: "NEPHEW",
      display: "nephew",
      definition:
        "The player of the role is a son of the scoping person's brother or sister or of the brother or sister of the scoping person's spouse.",
    },
    {
      code: "NIECE",
      display: "niece",
      definition:
        "The player of the role is a daughter of the scoping person's brother or sister or of the brother or sister of the scoping person's spouse.",
    },
    {
      code: "UNCLE",
      display: "uncle",
      definition: "The player of the role is a brother of the scoping person's mother or father.",
    },
    {
      code: "MUNCLE",
      display: "maternal uncle",
      definition:
        "The player of the role is a biological brother of the scoping person's biological mother.",
    },
    {
      code: "PUNCLE",
      display: "paternal uncle",
      definition:
        "The player of the role is a biological brother of the scoping person's biological father.",
    },
    {
      code: "PRN",
      display: "parent",
      definition:
        "The player of the role is one who begets, gives birth to, or nurtures and raises the scoping entity (child).",
    },
    {
      code: "ADOPTP",
      display: "adoptive parent",
      definition:
        "The player of the role (parent) has taken the scoper (child) into their family through legal means and raises them as his or her own child.",
    },
    {
      code: "ADOPTF",
      display: "adoptive father",
      definition:
        "The player of the role (father) is a male who has taken the scoper (child) into their family through legal means and raises them as his own child.",
    },
    {
      code: "ADOPTM",
      display: "adoptive mother",
      definition:
        "The player of the role (father) is a female who has taken the scoper (child) into their family through legal means and raises them as her own child.",
    },
    {
      code: "FTH",
      display: "father",
      definition:
        "The player of the role is a male who begets or raises or nurtures the scoping entity (child).",
    },
    {
      code: "FTHFOST",
      display: "foster father",
      definition:
        "The player of the role (parent) who is a male state-certified caregiver responsible for the scoper (child) who has been placed in the parent's care. The placement of the child is usually arranged through the government or a social-service agency, and temporary. The state, via a jurisdiction recognized child protection agency, stands as in loco parentis to the child, making all legal decisions while the foster parent is responsible for the day-to-day care of the specified child.",
    },
    {
      code: "NFTH",
      display: "natural father",
      definition: "The player of the role is a male who begets the scoping entity (child).",
    },
    {
      code: "NFTHF",
      display: "natural father of fetus",
      definition: "Indicates the biologic male parent of a fetus.",
    },
    {
      code: "STPFTH",
      display: "stepfather",
      definition:
        "The player of the role is the husband of scoping person's mother and not the scoping person's natural father.",
    },
    {
      code: "MTH",
      display: "mother",
      definition:
        "The player of the role is a female who conceives, gives birth to, or raises and nurtures the scoping entity (child).",
    },
    {
      code: "GESTM",
      display: "gestational mother",
      definition:
        "The player is a female whose womb carries the fetus of the scoper. Generally used when the gestational mother and natural mother are not the same.",
    },
    {
      code: "MTHFOST",
      display: "foster mother",
      definition:
        "The player of the role (parent) who is a female state-certified caregiver responsible for the scoper (child) who has been placed in the parent's care. The placement of the child is usually arranged through the government or a social-service agency, and temporary. The state, via a jurisdiction recognized child protection agency, stands as in loco parentis to the child, making all legal decisions while the foster parent is responsible for the day-to-day care of the specified child.",
    },
    {
      code: "NMTH",
      display: "natural mother",
      definition:
        "The player of the role is a female who conceives or gives birth to the scoping entity (child).",
    },
    {
      code: "NMTHF",
      display: "natural mother of fetus",
      definition: "The player is the biologic female parent of the scoping fetus.",
    },
    {
      code: "STPMTH",
      display: "stepmother",
      definition:
        "The player of the role is the wife of scoping person's father and not the scoping person's natural mother.",
    },
    {
      code: "NPRN",
      display: "natural parent",
      definition: "natural parent",
    },
    {
      code: "PRNFOST",
      display: "foster parent",
      definition:
        "The player of the role (parent) who is a state-certified caregiver responsible for the scoper (child) who has been placed in the parent's care. The placement of the child is usually arranged through the government or a social-service agency, and temporary. The state, via a jurisdiction recognized child protection agency, stands as in loco parentis to the child, making all legal decisions while the foster parent is responsible for the day-to-day care of the specified child.",
    },
    {
      code: "STPPRN",
      display: "step parent",
      definition:
        "The player of the role is the spouse of the scoping person's parent and not the scoping person's natural parent.",
    },
    {
      code: "SIB",
      display: "sibling",
      definition:
        "The player of the role shares one or both parents in common with the scoping entity.",
    },
    {
      code: "BRO",
      display: "brother",
      definition:
        "The player of the role is a male sharing one or both parents in common with the scoping entity.",
    },
    {
      code: "HBRO",
      display: "half-brother",
      definition:
        "The player of the role is a male related to the scoping entity by sharing only one biological parent.",
    },
    {
      code: "NBRO",
      display: "natural brother",
      definition:
        "The player of the role is a male having the same biological parents as the scoping entity.",
    },
    {
      code: "TWINBRO",
      display: "twin brother",
      definition:
        "The scoper was carried in the same womb as the male player and shares common biological parents.",
    },
    {
      code: "FTWINBRO",
      display: "fraternal twin brother",
      definition:
        "The scoper was carried in the same womb as the male player and shares common biological parents but is the product of a distinct egg/sperm pair.",
    },
    {
      code: "ITWINBRO",
      display: "identical twin brother",
      definition: "The male scoper is an offspring of the same egg-sperm pair as the male player.",
    },
    {
      code: "STPBRO",
      display: "stepbrother",
      definition: "The player of the role is a son of the scoping person's stepparent.",
    },
    {
      code: "HSIB",
      display: "half-sibling",
      definition:
        "The player of the role is related to the scoping entity by sharing only one biological parent.",
    },
    {
      code: "HSIS",
      display: "half-sister",
      definition:
        "The player of the role is a female related to the scoping entity by sharing only one biological parent.",
    },
    {
      code: "NSIB",
      display: "natural sibling",
      definition:
        "The player of the role has both biological parents in common with the scoping entity.",
    },
    {
      code: "NSIS",
      display: "natural sister",
      definition:
        "The player of the role is a female having the same biological parents as the scoping entity.",
    },
    {
      code: "TWINSIS",
      display: "twin sister",
      definition:
        "The scoper was carried in the same womb as the female player and shares common biological parents.",
    },
    {
      code: "FTWINSIS",
      display: "fraternal twin sister",
      definition:
        "The scoper was carried in the same womb as the female player and shares common biological parents but is the product of a distinct egg/sperm pair.",
    },
    {
      code: "ITWINSIS",
      display: "identical twin sister",
      definition:
        "The female scoper is an offspring of the same egg-sperm pair as the female player.",
    },
    {
      code: "TWIN",
      display: "twin",
      definition:
        "The scoper and player were carried in the same womb and shared common biological parents.",
    },
    {
      code: "FTWIN",
      display: "fraternal twin",
      definition:
        "The scoper and player were carried in the same womb and share common biological parents but are the product of distinct egg/sperm pairs.",
    },
    {
      code: "ITWIN",
      display: "identical twin",
      definition: "The scoper and player are offspring of the same egg-sperm pair.",
    },
    {
      code: "SIS",
      display: "sister",
      definition:
        "The player of the role is a female sharing one or both parents in common with the scoping entity.",
    },
    {
      code: "STPSIS",
      display: "stepsister",
      definition: "The player of the role is a daughter of the scoping person's stepparent.",
    },
    {
      code: "STPSIB",
      display: "step sibling",
      definition: "The player of the role is a child of the scoping person's stepparent.",
    },
    {
      code: "SIGOTHR",
      display: "significant other",
      definition:
        "A person who is important to one's well being; especially a spouse or one in a similar relationship. (The player is the one who is important)",
    },
    {
      code: "DOMPART",
      display: "domestic partner",
      definition:
        "The player of the role cohabits with the scoping person but is not the scoping person's spouse.",
    },
    {
      code: "FMRSPS",
      display: "former spouse",
      definition:
        "Player of the role was previously joined to the scoping person in marriage and this marriage is now dissolved and inactive. Usage Note: This is significant to indicate as some jurisdictions have different legal requirements for former spouse to access the patient's record, from a general friend.",
    },
    {
      code: "SPS",
      display: "spouse",
      definition: "The player of the role is a marriage partner of the scoping person.",
    },
    {
      code: "HUSB",
      display: "husband",
      definition: "The player of the role is a man joined to a woman (scoping person) in marriage.",
    },
    {
      code: "WIFE",
      display: "wife",
      definition: "The player of the role is a woman joined to a man (scoping person) in marriage.",
    },
  ],
};
