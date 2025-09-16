import { CodeableConcept } from "@medplum/fhirtypes";
import { SNOMED_URL } from "@metriport/shared/medical";

/**
 * Gets the standard CodeableConcept for a route code.
 * @see https://build.fhir.org/valueset-route-codes.html
 * @param inputText - the display text to get the route code for
 * @returns
 */
export function getRouteCode(inputText: string): CodeableConcept | undefined {
  const words = inputText.toLowerCase().split(/\s+/);

  // First check if any word matches a known route phrase
  for (const word of words) {
    const code = ROUTE_PHRASE_TO_CODE[word];
    if (code) {
      const display = ROUTE_CODE_TO_DISPLAY[code] ?? inputText;
      return {
        coding: [
          {
            system: SNOMED_URL,
            code,
            display,
          },
        ],
      };
    }
  }

  // Then check if the display text matches a known route regex (for abbreviations and complex patterns)
  for (const [code, display, matchBy] of ROUTE_CODES_WITH_REGEX) {
    if (!matchBy.regex) continue;
    const displayMatch = inputText.match(matchBy.regex);
    if (displayMatch) {
      return {
        coding: [
          {
            system: SNOMED_URL,
            code,
            display,
          },
        ],
      };
    }
  }
  return undefined;
}

type RouteCodeDefinition = [string, string, { regex?: RegExp; phrase?: string }];

const ROUTE_CODES: RouteCodeDefinition[] = [
  ["6064005", "Topical route", { phrase: "topical" }],
  ["10547007", "Otic route", { phrase: "otic" }],
  ["12130007", "Intra-articular route", { phrase: "intra-articular" }],
  ["16857009", "Per vagina", { regex: /\b(per vagina|vaginal|p\.?v\.?)\b/gi }],
  ["26643006", "Oral route", { phrase: "oral", regex: /\b(oral|p\.?o\.?|per\s+os)\b/gi }],
  ["34206005", "Subcutaneous route", { regex: /\b(subcutaneous|s\.?c\.?)\b/gi }],
  ["37161004", "Per rectum", { regex: /\b(per rectum|p\.?r\.?)\b/gi }],
  ["37737002", "Intraluminal route", { phrase: "intraluminal" }],
  ["37839007", "Sublingual route", { regex: /\b(sublingual|s\.?l\.?)\b/gi }],
  ["38239002", "Intraperitoneal route", { phrase: "intraperitoneal" }],
  ["45890007", "Transdermal route", { phrase: "transdermal" }],
  ["46713006", "Nasal route", { phrase: "nasal" }],
  ["47625008", "Intravenous route", { regex: /\b(intravenous|i\.?v\.?)\b/gi }],
  ["54471007", "Buccal route", { phrase: "buccal" }],
  ["54485002", "Ophthalmic route", { phrase: "ophthalmic" }],
  ["58100008", "Intra-arterial route", { phrase: "intra-arterial" }],
  ["60213007", "Intramedullary route", { phrase: "intramedullary" }],
  ["62226000", "Intrauterine route", { phrase: "intrauterine" }],
  ["72607000", "Intrathecal route", { phrase: "intrathecal" }],
  ["78421000", "Intramuscular route", { regex: /\b(intramuscular|i\.?m\.?)\b/gi }],
  ["90028008", "Urethral route", { phrase: "urethral" }],
  ["127490009", "Gastrostomy route", { phrase: "gastrostomy" }],
  ["127491008", "Jejunostomy route", { phrase: "jejunostomy" }],
  ["127492001", "Nasogastric route", { phrase: "nasogastric" }],
  ["372449004", "Dental use", { phrase: "dental" }],
  ["372450004", "Endocervical use", { phrase: "endocervical" }],
  ["372451000", "Endosinusial use", { phrase: "endosinusial" }],
  ["372452007", "Endotracheopulmonary use", { phrase: "endotracheopulmonary" }],
  ["372453002", "Extra-amniotic use", { phrase: "extra-amniotic" }],
  ["372454008", "Gastroenteral use", { phrase: "gastroenteral" }],
  ["372457001", "Gingival use", { phrase: "gingival" }],
  ["372458006", "Intraamniotic use", { phrase: "intraamniotic" }],
  ["372459003", "Intrabursal use", { phrase: "intrabursal" }],
  ["372460008", "Intracardiac use", { phrase: "intracardiac" }],
  ["372461007", "Intracavernous use", { phrase: "intracavernous" }],
  ["372462000", "Intracervical route (qualifier value)", { phrase: "intracervical" }],
  ["372463005", "Intracoronary use", { phrase: "intracoronary" }],
  ["372464004", "Intradermal use", { phrase: "intradermal" }],
  ["372465003", "Intradiscal use", { phrase: "intradiscal" }],
  ["372466002", "Intralesional use", { phrase: "intralesional" }],
  ["372467006", "Intralymphatic use", { phrase: "intralymphatic" }],
  ["372468001", "Intraocular use", { phrase: "intraocular" }],
  ["372469009", "Intrapleural use", { phrase: "intrapleural" }],
  ["372470005", "Intrasternal use", { phrase: "intrasternal" }],
  ["372471009", "Intravesical use", { phrase: "intravesical" }],
  ["372472002", "Ocular route (qualifier value)", { phrase: "ocular" }],
  ["372473007", "Oromucosal use", { phrase: "oromucosal" }],
  ["372474001", "Periarticular use", { phrase: "periarticular" }],
  ["372475000", "Perineural use", { phrase: "perineural" }],
  ["372476004", "Subconjunctival use", { phrase: "subconjunctival" }],
  ["404818005", "Intratracheal route (qualifier value)", { phrase: "intratracheal" }],
  ["404819002", "Intrabiliary route (qualifier value)", { phrase: "intrabiliary" }],
  ["404820008", "Epidural route (qualifier value)", { phrase: "epidural" }],
  ["416174007", "Suborbital route (qualifier value)", { phrase: "suborbital" }],
  ["417070009", "Caudal route (qualifier value)", { phrase: "caudal" }],
  ["417255000", "Intraosseous route (qualifier value)", { phrase: "intraosseous" }],
  ["417950001", "Intrathoracic route (qualifier value)", { phrase: "intrathoracic" }],
  ["417985001", "Enteral route (qualifier value)", { phrase: "enteral" }],
  ["417989007", "Intraductal route (qualifier value)", { phrase: "intraductal" }],
  ["418091004", "Intratympanic route (qualifier value)", { phrase: "intratympanic" }],
  ["418114005", "Intravenous central route (qualifier value)", { phrase: "intravenous central" }],
  ["418133000", "Intramyometrial route (qualifier value)", { phrase: "intramyometrial" }],
  [
    "418136008",
    "Gastro-intestinal stoma route (qualifier value)",
    { phrase: "gastro-intestinal stoma" },
  ],
  ["418162004", "Colostomy route (qualifier value)", { phrase: "colostomy" }],
  ["418204005", "Periurethral route (qualifier value)", { phrase: "periurethral" }],
  ["418287000", "Intracoronal route (qualifier value)", { phrase: "intracoronal" }],
  ["418321004", "Retrobulbar route (qualifier value)", { phrase: "retrobulbar" }],
  ["418331006", "Intracartilaginous route (qualifier value)", { phrase: "intracartilaginous" }],
  ["418401004", "Intravitreal route (qualifier value)", { phrase: "intravitreal" }],
  ["418418000", "Intraspinal route (qualifier value)", { phrase: "intraspinal" }],
  ["418441008", "Orogastric route (qualifier value)", { phrase: "orogastric" }],
  ["418511008", "Transurethral route (qualifier value)", { phrase: "transurethral" }],
  ["418586008", "Intratendinous route (qualifier value)", { phrase: "intratendinous" }],
  ["418608002", "Intracorneal route (qualifier value)", { phrase: "intracorneal" }],
  ["418664002", "Oropharyngeal route (qualifier value)", { phrase: "oropharyngeal" }],
  ["418722009", "Peribulbar route (qualifier value)", { phrase: "peribulbar" }],
  ["418730005", "Nasojejunal route (qualifier value)", { phrase: "nasojejunal" }],
  ["418743005", "Fistula route (qualifier value)", { phrase: "fistula" }],
  ["418813001", "Surgical drain route (qualifier value)", { phrase: "surgical drain" }],
  ["418821007", "Intracameral route (qualifier value)", { phrase: "intracameral" }],
  ["418851001", "Paracervical route (qualifier value)", { phrase: "paracervical" }],
  ["418877009", "Intrasynovial route (qualifier value)", { phrase: "intrasynovial" }],
  ["418887008", "Intraduodenal route (qualifier value)", { phrase: "intraduodenal" }],
  ["418892005", "Intracisternal route (qualifier value)", { phrase: "intracisternal" }],
  ["418947002", "Intratesticular route (qualifier value)", { phrase: "intratesticular" }],
  ["418987007", "Intracranial route (qualifier value)", { phrase: "intracranial" }],
  ["419021003", "Tumour cavity route", { phrase: "tumour cavity" }],
  ["419165009", "Paravertebral route (qualifier value)", { phrase: "paravertebral" }],
  ["419231003", "Intrasinal route (qualifier value)", { phrase: "intrasinal" }],
  ["419243002", "Transcervical route (qualifier value)", { phrase: "transcervical" }],
  ["419320008", "Subtendinous route (qualifier value)", { phrase: "subtendinous" }],
  ["419396008", "Intraabdominal route (qualifier value)", { phrase: "intraabdominal" }],
  ["419601003", "Subgingival route (qualifier value)", { phrase: "subgingival" }],
  ["419631009", "Intraovarian route (qualifier value)", { phrase: "intraovarian" }],
  ["419684008", "Ureteral route (qualifier value)", { phrase: "ureteral" }],
  ["419762003", "Peritendinous route (qualifier value)", { phrase: "peritendinous" }],
  ["419778001", "Intrabronchial route (qualifier value)", { phrase: "intrabronchial" }],
  ["419810008", "Intraprostatic route (qualifier value)", { phrase: "intraprostatic" }],
  ["419874009", "Submucosal route (qualifier value)", { phrase: "submucosal" }],
  ["419894000", "Surgical cavity route (qualifier value)", { phrase: "surgical cavity" }],
  ["419954003", "Ileostomy route (qualifier value)", { phrase: "ileostomy" }],
  [
    "419993007",
    "Intravenous peripheral route (qualifier value)",
    { phrase: "intravenous peripheral" },
  ],
  ["420047004", "Periosteal route (qualifier value)", { phrase: "periosteal" }],
  ["420163009", "Esophagostomy route", { phrase: "esophagostomy" }],
  ["420168000", "Urostomy route (qualifier value)", { phrase: "urostomy" }],
  ["420185003", "Laryngeal route (qualifier value)", { phrase: "laryngeal" }],
  ["420201002", "Intrapulmonary route (qualifier value)", { phrase: "intrapulmonary" }],
  ["420204005", "Mucous fistula route (qualifier value)", { phrase: "mucous fistula" }],
  ["420218003", "Nasoduodenal route (qualifier value)", { phrase: "nasoduodenal" }],
  ["420254004", "Body cavity route (qualifier value)", { phrase: "body cavity" }],
  [
    "420287000",
    "Intraventricular route - cardiac (qualifier value)",
    { phrase: "intraventricular cardiac" },
  ],
  [
    "420719007",
    "Intracerebroventricular route (qualifier value)",
    { phrase: "intracerebroventricular" },
  ],
  ["428191002", "Percutaneous route (qualifier value)", { phrase: "percutaneous" }],
  ["429817007", "Interstitial route (qualifier value)", { phrase: "interstitial" }],
  ["445752009", "Intraesophageal route (qualifier value)", { phrase: "intraesophageal" }],
  ["445754005", "Intragingival route (qualifier value)", { phrase: "intragingival" }],
  ["445755006", "Intravascular route (qualifier value)", { phrase: "intravascular" }],
  ["445756007", "Intradural route (qualifier value)", { phrase: "intradural" }],
  ["445767008", "Intrameningeal route (qualifier value)", { phrase: "intrameningeal" }],
  ["445768003", "Intragastric route (qualifier value)", { phrase: "intragastric" }],
  ["445771006", "Intrapericardial route (qualifier value)", { phrase: "intrapericardial" }],
  ["445913005", "Intralingual route (qualifier value)", { phrase: "intralingual" }],
  ["445941009", "Intrahepatic route (qualifier value)", { phrase: "intrahepatic" }],
  ["446105004", "Conjunctival route (qualifier value)", { phrase: "conjunctival" }],
  ["446407004", "Intraepicardial route (qualifier value)", { phrase: "intraepicardial" }],
  ["446435000", "Transendocardial route (qualifier value)", { phrase: "transendocardial" }],
  ["446442000", "Transplacental route (qualifier value)", { phrase: "transplacental" }],
  ["446540005", "Intracerebral route (qualifier value)", { phrase: "intracerebral" }],
  ["447026006", "Intraileal route (qualifier value)", { phrase: "intraileal" }],
  ["447052000", "Periodontal route (qualifier value)", { phrase: "periodontal" }],
  ["447080003", "Peridural route (qualifier value)", { phrase: "peridural" }],
  [
    "447081004",
    "Lower respiratory tract route (qualifier value)",
    { phrase: "lower respiratory tract" },
  ],
  ["447121004", "Intramammary route (qualifier value)", { phrase: "intramammary" }],
  ["447122006", "Intratumor route (qualifier value)", { phrase: "intratumor" }],
  ["447227007", "Transtympanic route (qualifier value)", { phrase: "transtympanic" }],
  ["447229005", "Transtracheal route (qualifier value)", { phrase: "transtracheal" }],
  ["447694001", "Respiratory tract route (qualifier value)", { phrase: "respiratory tract" }],
  ["447964005", "Digestive tract route (qualifier value)", { phrase: "digestive tract" }],
  ["448077001", "Intraepidermal route (qualifier value)", { phrase: "intraepidermal" }],
  ["448491004", "Intrajejunal route (qualifier value)", { phrase: "intrajejunal" }],
  ["448492006", "Intracolonic route (qualifier value)", { phrase: "intracolonic" }],
  ["448598008", "Cutaneous route (qualifier value)", { phrase: "cutaneous" }],
  [
    "697971008",
    "Arteriovenous fistula route (qualifier value)",
    { phrase: "arteriovenous fistula" },
  ],
  ["711360002", "Intraneural route (qualifier value)", { phrase: "intraneural" }],
  ["711378007", "Intramural route (qualifier value)", { phrase: "intramural" }],
  ["714743009", "Extracorporeal route (qualifier value)", { phrase: "extracorporeal" }],
  ["718329006", "Infiltration route (qualifier value)", { phrase: "infiltration" }],
  ["764723001", "Epilesional route (qualifier value)", { phrase: "epilesional" }],
  [
    "766790006",
    "Extracorporeal hemodialysis route (qualifier value)",
    { phrase: "extracorporeal hemodialysis" },
  ],
  ["876824003", "Intradialytic route", { phrase: "intradialytic" }],
  ["1254769004", "Suprachoroidal route", { phrase: "suprachoroidal" }],
  [
    "1259221004",
    "Intracorporus cavernosum route (qualifier value)",
    { phrase: "intracorporus cavernosum" },
  ],
  ["1611000175109", "Sublesional route (qualifier value)", { phrase: "sublesional" }],
  ["58751000052109", "Intraglandular route (qualifier value)", { phrase: "intraglandular" }],
  ["58761000052107", "Intracholangiopancreatic route", { phrase: "intracholangiopancreatic" }],
  ["58771000052103", "Intraportal route", { phrase: "intraportal" }],
  ["58811000052103", "Peritumoral route (qualifier value)", { phrase: "peritumoral" }],
  [
    "58821000052106",
    "Posterior juxtascleral route (qualifier value)",
    { phrase: "posterior juxtascleral" },
  ],
  ["58831000052108", "Subretinal route (qualifier value)", { phrase: "subretinal" }],
  ["66621000052103", "Sublabial use", { phrase: "sublabial" }],
];

const ROUTE_CODES_WITH_REGEX = ROUTE_CODES.filter(route => route[2].regex);
const ROUTE_PHRASE_TO_CODE: Record<string, string> = Object.fromEntries(
  ROUTE_CODES.filter(route => route[2].phrase).map(route => [route[2].phrase, route[0]])
);
const ROUTE_CODE_TO_DISPLAY: Record<string, string> = Object.fromEntries(
  ROUTE_CODES.map(route => [route[0], route[1]])
);
