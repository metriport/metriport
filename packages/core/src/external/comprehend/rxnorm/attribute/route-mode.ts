import { RxNormAttributeType, RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { SNOMED_URL } from "@metriport/shared/medical";
import { CodeableConcept, Coding } from "@medplum/fhirtypes";
import { getAttribute } from "../shared";

interface RouteOrMode {
  regex: RegExp;
  coding: Coding[];
}

const routeOrModes: RouteOrMode[] = [
  {
    regex: /\btopical\b/gi,
    coding: [
      {
        system: SNOMED_URL,
        code: "6064005",
        display: "Topical route (qualifier value)",
      },
    ],
  },
  {
    regex: /^(p\.?o\.?|per os)$/gi,
    coding: [
      {
        system: SNOMED_URL,
        code: "26643006",
        display: "Oral route (qualifier value)",
      },
    ],
  },
  {
    regex: /^(i\.?v\.?|intravenous)$/gi,
    coding: [
      {
        system: SNOMED_URL,
        code: "47625008",
        display: "Intravenous route (qualifier value)",
      },
    ],
  },
  {
    regex: /^(i\.?m\.?|intramuscular)$/gi,
    coding: [
      {
        system: SNOMED_URL,
        code: "78421000",
        display: "Intramuscular route (qualifier value)",
      },
    ],
  },
  {
    regex: /^(s\.?c\.?|subcut|subcutaneous)$/gi,
    coding: [
      {
        system: SNOMED_URL,
        code: "34206005",
        display: "Subcutaneous route (qualifier value)",
      },
    ],
  },
  {
    regex: /^(p\.?r\.?|per rectum)$/gi,
    coding: [
      {
        system: SNOMED_URL,
        code: "37161004",
        display: "Rectal route (qualifier value)",
      },
    ],
  },
  {
    regex: /^(p\.?v\.?|per vagina)$/gi,
    coding: [
      {
        system: SNOMED_URL,
        code: "16857009",
        display: "Intrauterine route (qualifier value)",
      },
    ],
  },
];

/**
 * Builds the codeable concept for the route or mode of the medication.
 * @param entity
 * @returns
 */
export function buildRouteOrMode(entity: RxNormEntity): CodeableConcept | undefined {
  const routeOrMode = getAttribute(entity, RxNormAttributeType.ROUTE_OR_MODE);
  if (!routeOrMode) return undefined;

  const text = routeOrMode.Text;
  if (!text) return undefined;

  for (const routeOrMode of routeOrModes) {
    if (routeOrMode.regex.test(text)) {
      return {
        coding: routeOrMode.coding,
        text,
      };
    }
  }

  return undefined;
}

// 6064005 icon	http://snomed.info/sct	Topical route	A route that begins on the surface of the body.
// 10547007 icon	http://snomed.info/sct	Otic route	A route that begins on, in or by way of the ear.
// 12130007 icon	http://snomed.info/sct	Intra-articular route	A route that begins within a joint.
// 16857009 icon	http://snomed.info/sct	Per vagina	A route that begins in the vagina.
// 26643006 icon	http://snomed.info/sct	Oral route	A digestive tract route that begins in the mouth.
// 34206005 icon	http://snomed.info/sct	Subcutaneous route	A route that begins in subcutaneous tissue.
// 37161004 icon	http://snomed.info/sct	Per rectum	An intracolonic route that begins in the rectum.
// 37737002 icon	http://snomed.info/sct	Intraluminal route	A route that begins within the channel of a tubular structure or tubular organ.
// 37839007 icon	http://snomed.info/sct	Sublingual route	An oromucosal route that begins beneath the tongue.
// 38239002 icon	http://snomed.info/sct	Intraperitoneal route	A body cavity route of administration by entry into the peritoneum.
// 45890007 icon	http://snomed.info/sct	Transdermal route	A route of administration that is across the skin and into the systemic circulation.
// 46713006 icon	http://snomed.info/sct	Nasal route	A respiratory tract route that begins in the nasal cavity.
// 47625008 icon	http://snomed.info/sct	Intravenous route	An intravascular route that begins within a vein.
// 54471007 icon	http://snomed.info/sct	Buccal route	An oromucosal route that begins on the moist tissue lining of the cheek within the oral cavity.
// 54485002 icon	http://snomed.info/sct	Ophthalmic route	A route that begins in the eye region.
// 58100008 icon	http://snomed.info/sct	Intra-arterial route	An intravascular route that begins within an artery.
// 60213007 icon	http://snomed.info/sct	Intramedullary route	An intraosseous route that begins within the marrow cavity of a bone.
// 62226000 icon	http://snomed.info/sct	Intrauterine route	A body cavity route that begins within the uterine cavity.
// 72607000 icon	http://snomed.info/sct	Intrathecal route	An intrameningeal route that begins within the subarachnoid space in the cerebrospinal fluid, at any level of the cerebrospinal axis, including within the cerebral ventricles.
// 78421000 icon	http://snomed.info/sct	Intramuscular route	A route that begins within a muscle.
// 90028008 icon	http://snomed.info/sct	Urethral route	A route that begins within the urethra.
// 127490009 icon	http://snomed.info/sct	Gastrostomy route	An intragastric and gastrointestinal stoma route that begins through a surgically created opening into the stomach.
// 127491008 icon	http://snomed.info/sct	Jejunostomy route	An enteral and gastro-intestinal stoma route that begins through a surgically created opening in the jejunum.
// 127492001 icon	http://snomed.info/sct	Nasogastric route	An intragastric route that begins through the nose and into the stomach by means of a tube.
// 372449004 icon	http://snomed.info/sct	Dental use	An oral route that begins on or around the teeth or in the teeth.
// 372450004 icon	http://snomed.info/sct	Endocervical use	A route that begins within the canal of the cervix uteri.
// 372451000 icon	http://snomed.info/sct	Endosinusial use	An intrasinal route that begins within the nasal sinus.
// 372452007 icon	http://snomed.info/sct	Endotracheopulmonary use	A respiratory tract route that begins within the trachea.
// 372453002 icon	http://snomed.info/sct	Extra-amniotic use	An intrauterine route that is introduced between the amnion and the chorion.
// 372454008 icon	http://snomed.info/sct	Gastroenteral use	A digestive tract route that begins in the gastrointestinal tract (from the upper oesophagus through the rectum).
// 372457001 icon	http://snomed.info/sct	Gingival use	An oral and topical route that begins on the gingivae.
// 372458006 icon	http://snomed.info/sct	Intraamniotic use	An intrauterine route that begins on the inside of the amniotic cavity.
// 372459003 icon	http://snomed.info/sct	Intrabursal use	A route that begins within a bursa.
// 372460008 icon	http://snomed.info/sct	Intracardiac use	A route that begins within the heart.
// 372461007 icon	http://snomed.info/sct	Intracavernous use	A route that begins within a pathologic cavity.
// 372462000 icon	http://snomed.info/sct	Intracervical route (qualifier value)	A route that begins in the cervix uteri.
// 372463005 icon	http://snomed.info/sct	Intracoronary use	An intra-arterial route that begins within the coronary arteries.
// 372464004 icon	http://snomed.info/sct	Intradermal use	A route that begins within the dermis of the skin.
// 372465003 icon	http://snomed.info/sct	Intradiscal use	An intraspinal route that begins within a fibrocartilaginous intervertebral disc.
// 372466002 icon	http://snomed.info/sct	Intralesional use	A route that begins within a localised lesion.
// 372467006 icon	http://snomed.info/sct	Intralymphatic use	A route that begins within the lymphatic vessels or nodes.
// 372468001 icon	http://snomed.info/sct	Intraocular use	An ophthalmic route that begins within the eyeball.
// 372469009 icon	http://snomed.info/sct	Intrapleural use	A route that begins within the pleura or pleural space.
// 372470005 icon	http://snomed.info/sct	Intrasternal use	An intraosseous route that begins within the bone marrow of the sternum.
// 372471009 icon	http://snomed.info/sct	Intravesical use	A body cavity route that begins within the bladder cavity.
// 372472002 icon	http://snomed.info/sct	Ocular route (qualifier value)	A route that begins on the eyeball or conjunctiva.
// 372473007 icon	http://snomed.info/sct	Oromucosal use	An oral route that begins on the moist tissue lining the oral cavity.
// 372474001 icon	http://snomed.info/sct	Periarticular use	A route that begins within the tissues surrounding a joint.
// 372475000 icon	http://snomed.info/sct	Perineural use	A route that begins around a nerve or nerves.
// 372476004 icon	http://snomed.info/sct	Subconjunctival use	An ophthalmic route that begins beneath the conjunctiva.
// 404818005 icon	http://snomed.info/sct	Intratracheal route (qualifier value)	A route of administration that goes to the trachea.
// 404819002 icon	http://snomed.info/sct	Intrabiliary route (qualifier value)	A route that begins within the bile, bile ducts or gallbladder.
// 404820008 icon	http://snomed.info/sct	Epidural route (qualifier value)	A meningeal route that begins within the space surrounding the dura mater within the epidural space.
// 416174007 icon	http://snomed.info/sct	Suborbital route (qualifier value)	An ophthalmic route that begins beneath the orbit of the eye.
// 417070009 icon	http://snomed.info/sct	Caudal route (qualifier value)	An intraspinal route that begins within the cauda equina.
// 417255000 icon	http://snomed.info/sct	Intraosseous route (qualifier value)	A route that begins within the bone.
// 417950001 icon	http://snomed.info/sct	Intrathoracic route (qualifier value)	A route that begins within the thorax internal to the ribs.
// 417985001 icon	http://snomed.info/sct	Enteral route (qualifier value)	A gastroenteral route that begins in the intestinal tract (within the small and large intestines).
// 417989007 icon	http://snomed.info/sct	Intraductal route (qualifier value)	A route that begins within the duct of a gland.
// 418091004 icon	http://snomed.info/sct	Intratympanic route (qualifier value)	An otic route that begins within the auris media.
// 418114005 icon	http://snomed.info/sct	Intravenous central route (qualifier value)	An intravenous route that begins within the jugular, subclavian or femoral veins.
// 418133000 icon	http://snomed.info/sct	Intramyometrial route (qualifier value)	A route that begins within the myometrium.
// 418136008 icon	http://snomed.info/sct	Gastro-intestinal stoma route (qualifier value)	A gastroenteral route that begins through a surgically created opening into the gastrointestinal tract.
// 418162004 icon	http://snomed.info/sct	Colostomy route (qualifier value)	An intracolonic and gastro-intestinal stoma route that begins through a surgically created opening into the colon (part of the large intestine measured from the caecum to the rectum).
// 418204005 icon	http://snomed.info/sct	Periurethral route (qualifier value)	A route that begins within or around the tissues surrounding the urethra.
// 418287000 icon	http://snomed.info/sct	Intracoronal route (qualifier value)	A dental route that begins within a portion of a tooth which is covered by enamel and which is separated from the roots by a slightly constricted region known as the neck.
// 418321004 icon	http://snomed.info/sct	Retrobulbar route (qualifier value)	An ophthalmic route that begins behind the eyeball or pons of the eye.
// 418331006 icon	http://snomed.info/sct	Intracartilaginous route (qualifier value)	A periarticular route that begins within the articular cartilage.
// 418401004 icon	http://snomed.info/sct	Intravitreal route (qualifier value)	An intraocular route that begins within the vitreous humour of the eyeball.
// 418418000 icon	http://snomed.info/sct	Intraspinal route (qualifier value)	A route that begins within the vertebral column.
// 418441008 icon	http://snomed.info/sct	Orogastric route (qualifier value)	An intragastric route that begins through the mouth and into the stomach by means of a tube.
// 418511008 icon	http://snomed.info/sct	Transurethral route (qualifier value)	A urethral route that begins through the urethra.
// 418586008 icon	http://snomed.info/sct	Intratendinous route (qualifier value)	A route that begins within a tendon.
// 418608002 icon	http://snomed.info/sct	Intracorneal route (qualifier value)	An ophthalmic route that begins within the cornea.
// 418664002 icon	http://snomed.info/sct	Oropharyngeal route (qualifier value)	A respiratory tract route that begins with direct application to the oropharynx.
// 418722009 icon	http://snomed.info/sct	Peribulbar route (qualifier value)	An ophthalmic route that begins around the eyeball.
// 418730005 icon	http://snomed.info/sct	Nasojejunal route (qualifier value)	An intrajejunal route that begins through the nose and into the jejunum by means of a tube.
// 418743005 icon	http://snomed.info/sct	Fistula route (qualifier value)	A route that begins through a fistula.
// 418813001 icon	http://snomed.info/sct	Surgical drain route (qualifier value)	A route that begins through a surgical drain.
// 418821007 icon	http://snomed.info/sct	Intracameral route (qualifier value)	An intraocular route that begins in the anterior chamber of the eyeball.
// 418851001 icon	http://snomed.info/sct	Paracervical route (qualifier value)	A route that begins next to the uterine cervix.
// 418877009 icon	http://snomed.info/sct	Intrasynovial route (qualifier value)	An intra-articular route that begins within the synovial cavity of a joint.
// 418887008 icon	http://snomed.info/sct	Intraduodenal route (qualifier value)	An enteral route that begins within the duodenum.
// 418892005 icon	http://snomed.info/sct	Intracisternal route (qualifier value)	An intracranial and intrathecal route that begins within the cisterna magna cerebellomedullaris.
// 418947002 icon	http://snomed.info/sct	Intratesticular route (qualifier value)	A route that begins within the testicles (male reproductive glands).
// 418987007 icon	http://snomed.info/sct	Intracranial route (qualifier value)	A route that begins within the skull.
// 419021003 icon	http://snomed.info/sct	Tumour cavity route	An intratumour route that begins within a tumour cavity.
// 419165009 icon	http://snomed.info/sct	Paravertebral route (qualifier value)	A route that begins next to one or more vertebra.
// 419231003 icon	http://snomed.info/sct	Intrasinal route (qualifier value)	A respiratory tract route that begins within the nasal or periorbital sinuses.
// 419243002 icon	http://snomed.info/sct	Transcervical route (qualifier value)	A route that begins through the cervix.
// 419320008 icon	http://snomed.info/sct	Subtendinous route (qualifier value)	A route that begins beneath a tendon.
// 419396008 icon	http://snomed.info/sct	Intraabdominal route (qualifier value)	A route that begins within the abdomen.
// 419601003 icon	http://snomed.info/sct	Subgingival route (qualifier value)	A gingival route that begins beneath the free margin of the gingivae.
// 419631009 icon	http://snomed.info/sct	Intraovarian route (qualifier value)	A route that begins within an ovary or ovaries.
// 419684008 icon	http://snomed.info/sct	Ureteral route (qualifier value)	A route that begins within a ureter.
// 419762003 icon	http://snomed.info/sct	Peritendinous route (qualifier value)	A route that begins around a tendon.
// 419778001 icon	http://snomed.info/sct	Intrabronchial route (qualifier value)	An intrapulmonary tract route that begins within the bronchus.
// 419810008 icon	http://snomed.info/sct	Intraprostatic route (qualifier value)	A route that begins within the prostate gland.
// 419874009 icon	http://snomed.info/sct	Submucosal route (qualifier value)	A route that begins beneath the mucous membrane.
// 419894000 icon	http://snomed.info/sct	Surgical cavity route (qualifier value)	A route that begins within a surgical cavity.
// 419954003 icon	http://snomed.info/sct	Ileostomy route (qualifier value)	An intraileal and gastro-intestinal stoma route that begins through a surgically created opening into the ileum.
// 419993007 icon	http://snomed.info/sct	Intravenous peripheral route (qualifier value)	An intravenous route that begins in a peripheral vein.
// 420047004 icon	http://snomed.info/sct	Periosteal route (qualifier value)	A route that begins within the periosteum.
// 420163009 icon	http://snomed.info/sct	Esophagostomy route	An intraoesophageal and gastrointestinal stoma route that begins through a surgically created opening into the oesophagus.
// 420168000 icon	http://snomed.info/sct	Urostomy route (qualifier value)	A route that begins through a surgically created opening into the urinary tract.
// 420185003 icon	http://snomed.info/sct	Laryngeal route (qualifier value)	A respiratory tract route that begins on the larynx.
// 420201002 icon	http://snomed.info/sct	Intrapulmonary route (qualifier value)	A respiratory tract route that begins within the lungs or its bronchi.
// 420204005 icon	http://snomed.info/sct	Mucous fistula route (qualifier value)	A fistula route that begins within a mucous fistula.
// 420218003 icon	http://snomed.info/sct	Nasoduodenal route (qualifier value)	An intraduodenal route that begins through the nose and into the duodenum, usually by means of a tube.
// 420254004 icon	http://snomed.info/sct	Body cavity route (qualifier value)	A route that begins within a non-pathologic hollow cavity, such as that of the abdominal cavity or uterus.
// 420287000 icon	http://snomed.info/sct	Intraventricular route - cardiac (qualifier value)	An intracardiac route that begins within a cardiac ventricle.
// 420719007 icon	http://snomed.info/sct	Intracerebroventricular route (qualifier value)	An intracerebral and intrathecal route that begins within a cerebral ventricle.
// 428191002 icon	http://snomed.info/sct	Percutaneous route (qualifier value)	Percutaneous route
// 429817007 icon	http://snomed.info/sct	Interstitial route (qualifier value)	A route that begins within the interstices of a tissue.
// 445752009 icon	http://snomed.info/sct	Intraesophageal route (qualifier value)	A gastroenteral route that begins within the oesophagus.
// 445754005 icon	http://snomed.info/sct	Intragingival route (qualifier value)	An oral route that begins within the gingivae.
// 445755006 icon	http://snomed.info/sct	Intravascular route (qualifier value)	A route that begins with the vascular system.
// 445756007 icon	http://snomed.info/sct	Intradural route (qualifier value)	A meningeal route that begins within the dura.
// 445767008 icon	http://snomed.info/sct	Intrameningeal route (qualifier value)	A route that begins within the meninges.
// 445768003 icon	http://snomed.info/sct	Intragastric route (qualifier value)	A gastroenteral route that begins within the stomach.
// 445771006 icon	http://snomed.info/sct	Intrapericardial route (qualifier value)	An intrathoracic route that begins within the pericardium.
// 445913005 icon	http://snomed.info/sct	Intralingual route (qualifier value)	An oral route that begins in the tongue.
// 445941009 icon	http://snomed.info/sct	Intrahepatic route (qualifier value)	A route that begins within the liver.
// 446105004 icon	http://snomed.info/sct	Conjunctival route (qualifier value)	An ophthalmic and topical route that begins on the conjunctiva.
// 446407004 icon	http://snomed.info/sct	Intraepicardial route (qualifier value)	An intrathoracic route that begins within the epicardium.
// 446435000 icon	http://snomed.info/sct	Transendocardial route (qualifier value)	An intracardiac route that begins in the endocardium.
// 446442000 icon	http://snomed.info/sct	Transplacental route (qualifier value)	An intrauterine route for a substance that has the propensity for fetal absorption via the placenta.
// 446540005 icon	http://snomed.info/sct	Intracerebral route (qualifier value)	An intracranial route that begins within the cerebrum.
// 447026006 icon	http://snomed.info/sct	Intraileal route (qualifier value)	An enteral route that begins within the ileum.
// 447052000 icon	http://snomed.info/sct	Periodontal route (qualifier value)	A dental route that begins around a tooth.
// 447080003 icon	http://snomed.info/sct	Peridural route (qualifier value)	A meningeal route that begins within the space surrounding the dura mater of the spinal cord.
// 447081004 icon	http://snomed.info/sct	Lower respiratory tract route (qualifier value)	Lower respiratory tract route
// 447121004 icon	http://snomed.info/sct	Intramammary route (qualifier value)	A route that begins within the breast.
// 447122006 icon	http://snomed.info/sct	Intratumor route (qualifier value)	A route that begins within a tumour.
// 447227007 icon	http://snomed.info/sct	Transtympanic route (qualifier value)	An otic route that begins across the tympanic cavity.
// 447229005 icon	http://snomed.info/sct	Transtracheal route (qualifier value)	An endotracheopulmonary route that begins through the wall of the trachea.
// 447694001 icon	http://snomed.info/sct	Respiratory tract route (qualifier value)	A route that begins within the respiratory tract, including the oropharynx and nasopharynx.
// 447964005 icon	http://snomed.info/sct	Digestive tract route (qualifier value)	A route that begins anywhere in the digestive tract extending from the mouth through the rectum.
// 448077001 icon	http://snomed.info/sct	Intraepidermal route (qualifier value)	A route that begins within the epidermis of the skin.
// 448491004 icon	http://snomed.info/sct	Intrajejunal route (qualifier value)	An enteral route that begins within the jejunum.
// 448492006 icon	http://snomed.info/sct	Intracolonic route (qualifier value)	An enteral route that begins within the colon.
// 448598008 icon	http://snomed.info/sct	Cutaneous route (qualifier value)	A topical route that begins on the skin or cutaneous wounds and/or nails and/or hair.
// 697971008 icon	http://snomed.info/sct	Arteriovenous fistula route (qualifier value)	Arteriovenous fistula route
// 711360002 icon	http://snomed.info/sct	Intraneural route (qualifier value)	A route of administration into a peripheral nerve.
// 711378007 icon	http://snomed.info/sct	Intramural route (qualifier value)	Intramural route
// 714743009 icon	http://snomed.info/sct	Extracorporeal route (qualifier value)	A route that occurs outside of the body.
// 718329006 icon	http://snomed.info/sct	Infiltration route (qualifier value)	A route that begins with diffusion or accumulation in a tissue or cells.
// 764723001 icon	http://snomed.info/sct	Epilesional route (qualifier value)	A route that begins on the surface of a localised lesion.
// 766790006 icon	http://snomed.info/sct	Extracorporeal hemodialysis route (qualifier value)	A route used for extracorporeal hemodialysis where the product interacts with the patient blood through a semipermeable membrane.
// 876824003 icon	http://snomed.info/sct	Intradialytic route	Intradialytic route (qualifier value)
// 1254769004 icon	http://snomed.info/sct	Suprachoroidal route	An ophthalmic route that begins within the suprachoroidal space.
// 1259221004 icon	http://snomed.info/sct	Intracorporus cavernosum route (qualifier value)	Intracorporus cavernosum route
// 1611000175109 icon	http://snomed.info/sct	Sublesional route (qualifier value)	Sublesional route
// 58751000052109 icon	http://snomed.info/sct	Intraglandular route (qualifier value)	A route that begins within a gland.
// 58761000052107 icon	http://snomed.info/sct	Intracholangiopancreatic route	A route that begins within the bile duct and pancreatic duct.
// 58771000052103 icon	http://snomed.info/sct	Intraportal route	An intravascular route that begins within the hepatic portal vein.
// 58811000052103 icon	http://snomed.info/sct	Peritumoral route (qualifier value)	A route that goes to the region surrounding a tumour.
// 58821000052106 icon	http://snomed.info/sct	Posterior juxtascleral route (qualifier value)	An ophthalmic route that begins in the episcleral space adjacent to the macula.
// 58831000052108 icon	http://snomed.info/sct	Subretinal route (qualifier value)	An intraocular route that begins between the sensory retina and the retinal pigment epithelium of the eyeball.
// 66621000052103 icon	http://snomed.info/sct	Sublabial use	An oromucosal route that begins on the moist tissue lining between the lip and gingiva within the oral cavity.
