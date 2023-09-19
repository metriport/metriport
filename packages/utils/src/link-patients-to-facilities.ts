import * as fs from "fs";
import * as dotenv from "dotenv";
import { chunk } from "lodash";
import { MetriportMedicalApi, Patient } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "./shared/env";
import axios from "axios";

dotenv.config();
// Keep dotenv import and config before everything else

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const CQ_ORG_CHUNK_SIZE = 50;

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

type SimpleOrg = {
  Id: string;
  Name: string;
  States: string[];
};

const patientIdsArr: Patient[] = [];
const cqOrgsList = fs.readFileSync("./cq-org-list.json", "utf8");
const orgOid = "2.16.840.1.113883.3.9621.5.102";
const cookie =
  "MP_RQ_COOKIE=EncryptedC=fe928949-96bb-4373-adec-a6a98ce95988; SessionTimeoutRedirect=true; __RequestVerificationToken=75xc17bIrzpcz5o3r9sagTbiydCwiDMMFLO2ZkkAA4x-6CuGIPaBWvL0UXY6Bd9_p1__p7CxQeZbCJIsv1huCFtzyCc1; MPUserTimeZoneOffset=240,Eastern (UTC-4); _ga=GA1.2.1518410388.1674654658; _ga_JM06ZBM0N2=GS1.1.1694712523.4.0.1694712731.60.0.0; _ga_27EK9JH4G3=GS1.1.1694712524.4.0.1694712731.0.0.0; .AspNet.Cookies=OpECwECt7xpJeiROc78gAI1YkQN5SjxLj_SzC6xNmXlVjrbccL6EXJrLuAybU_5514ME2B8oz0-p2qWrymzhfShXHdc3t6huaCDh2OHgjvywL_RutOVeqJR2WI2pDPF-MPwpWUgMg2EheZl6pKplTP_wRoRAP8x1HpBTMWdxYg8wozebM4BWhlh5UtbtiiULgrvfiAu6RzcYNwChpv06ryNM06FWMm_mc3-Nnkc4FGvAh8u0Lipk8_uW8itEDxX75xiSNspHrMvK5hcuyi11LagQnx-owVMVT4rHRkrp4W58sZhHmNaS1u-kzlRySZAhLYl-1IapybNG79VAO4DMl7N88-LEMyAAUd48I4ph6iKr9ISEUSvBiM6IgbVSNfnziVqjl1pThvOAuwlQfT69vHVvPfpcSeLVmAwHVeY310sN50IxYQbIJBDvvrU2fl7siLIB4TM2r3XrxdwuKBeV0QKpQY_sRWfeqt7Fyo8XaoTN662iH-M2fJnfG9ITXkeVN7uEYQkLwx3gjgo7s7u9l-PsGag8tBKcta1DUeU6knZF5nhb3B76H0UIAZ94fwEE_e9gpJO1KDkgvFHa10CkcacxUG5MIp33ussrk944lHOje3nt-ginFKan0rU6DAs9gJ3TwuBwAv_vUXnBPDaeo84VYXLbMS9uqY7q8SKGBP8CZii9v_gYCZgIEozOwq5UAKAAhNCkcQyrMHaCF0s13AmdaRonlk-E4aSM6welcdlIVZh5w9_vM5Myp3ojxX2ImQD_CoVHLAsa1UEReEUsK3jfD-vj9_ZmCWkvjzegm5P4mA7zaJ53v7LbnZRzTF5cYvyQWY7o1cCS93_tOpO0AIZ0ZqEyuc1QY9f3P9DuYATyxwTvN2r3xGnKCCscDxy7Hhga5JaLwZWg2NyC_WtBn2K-F2d8TYM1u8Lj4IbOaHbDFV2D8JVheWtYisCNRBYlh0gvy9So8_xpUoq-Q_iR2g5bf8iTXsrnDfQZUPNu9V_SC72AFTq3HX21eEhEg7_1RYpFL-h2H-OQrogWYVmy3X_zUm-l_Dw6GoADEQ90EVK0wTZhBZ7o0Q_QAVgjCZaKTXm3G4POZ5TZEqW9weJPBp75VMQFRsD_YAmaXv118N4ysP7g_paLlDWfx7bUPQUl9kELa_b6B4oqbZuvlmGcgUegkTTinXS7kINaKZXlTCYaeO9z6w5kVTeGLeqEP6NDdfp3axxrBt9UF8ACTQ2suU9gLRyPj2AnTpglJEuD9uJrWb7g54MfpWtRDZ7ATaqaOgKRp8TkYEh1o6yxw0x5kf_VTpPmzA8KKpLpEGELAxM5PdSmdCOBoFajQ22QmxW0q6WtTMSWDUTPqgCpalUa_PtYnSpwWoaax0lLAO5OEnT1n-dKhLaMz5MiI6mlgPEhkDfZ8XlNIXkJg3iUpVzhqIvC6AklTfHfW4Mb4PwqhalcBzUfILXXuOMec0xUqvQJv5g4EPcxDtIk9uJRNI5hFElUhctJU16VzksKgE7Ftw-yMMU9hKNRTpcgz2EujthPW_7RHErgS0erBK0zZTKLc0f_-rROGeHtDxnLTQciyYP7_7cTwf2T7-VTKesgRJmvMjv-gPvb8gYSG4g6oI_xQE6BVI3AGYthrwr4zlm6XBFNHt-nD09kyxr3Sj17Axw6qW31W-kmGC9yelW8ZeLgfd-BSt-ZzcATgauGmCOlFTkyeokGw_sDLSU59NtCudgmji8X7wcmTRX8IMtysOT8oHc7nXg7ht5hg9xKjLBIfHkbXkTRZ5S1Ds85KwlLmvtZ1JiEIvcLUoOBl4a_xDmFWlJZpUUbJmtPS7KV-CIDkMlGj_p-MRisIBMwUg-IwGV6gfTnMSXarR-ka8QNph5Bdtla98QV0SnwYKkt9TDoAT71qf2-eFsTwKSrAG98YBWEZuKx6Y11iebBOC9qVaCxvOLJvNQbASRGzfv4oeWR62HCvYy94U3F6teXFRNFuFe9joM7pDUPfs8Iu2r8hvZPq-XHpKutn_6iEYyp2SGdKX4SsDt7nmnXBx7s06fOQO_YX0Cmo9R21tsAGhhZ2HUvd9B_iQtQi6w3c3TDXbGjM3473a_OGVJqSyOF_crmGS0RCLnHu1L6ajSSAuWab8jXMAQ1KQe2Inp-nd65HAJCMHv-pzM86De5cIejzx9QJaPF80nrEvlxiTtLVPl4VN9KQ9kiyk9amretURHar087pwqV4ZvXyqSalgyrnj2iUiOFBVlQcJ91adJZJkxf7LqI8w5WrIduU1jNqbcd15hZaMR7YzRVVo9EglP6eLbSKtm1czIoSutrEPhkCiIgz1e2QqI12E1KipR57pH5ASxQM61i4wb7Xhxarznfk6hYtGtDIscXArKjZ3y9Hd_QqGk5Hmdt2fv1KRJo2WXtB2WlVjldtfJRpnFS0mVgNPxKRPuZF624OpOwUaZfC_iS58RTodu6293l-t33tHUbTYiF2tWxqLYh2EDwzME1zJ1yrRxCCroCycjgwEWv9uPQKUuklFcg8DMcfSRSEqp8JIboYnljsEJ-5tbA6iyajzdGDzZ6CaAR27YhNe-EWaksOKK0fjlXdax_FIQYiDpkNpf_MeaO1G_SgHUOjPQ1LroqQpcxSmR6XL9njbu4VPqQOJXSTiS5QL702VnHkHj5DjwIf0pTcWbKE1Xh3sbvdNC96Bw31Q49NW91YV7MHWfAWtZxlRbKMXQb3OWA769-bEtFg3k-5RcXKVvM7u85ZegxGgPI3yCLVtV_00IZLGu0zSFJKLG8eZfeRW0SCEFcb2YlHuAoBAim44PPexHLBhlXsqnZKPvWQaHaWCmym7dzbo8ufXVna2esoowI9ZohLAv3doCOpxGAvAjo-_5zkfVdrhxqySXIs8ES0hBwEDpLB3fXyJ3our5VEc5qFdwdAV3oPGr7eIcgVblwiHK4oerW0naQ9LeTkG_6Gzlb-KVrdVaJIlonI8VASn4OrbzSaCAFhfBIgXjYD85-iDNQlKoPNkOji1osto6pxaqNuVXvbAHOnw0nR9WnePCEd_y2b715hwIP10gAdOLsh1Na0PaeRa-Ls55JBeOQ3DolLiMQU2u_IiFaCXM";

async function main() {
  let patients: Patient[] = [];

  if (patients.length === 0) {
    const facilities = await metriportAPI.listFacilities();

    for (const facility of facilities) {
      const patientsList = await metriportAPI.listPatients(facility.id);

      patientsList.forEach(patient => {
        patients.push(patient);
      });
    }
  } else {
    patients = patientIdsArr;
  }

  const orgs: SimpleOrg[] = JSON.parse(cqOrgsList);

  const chunks = chunk(orgs, CQ_ORG_CHUNK_SIZE);

  for (const [i, orgChunk] of chunks.entries()) {
    const orgIds = orgChunk.map(org => org.Id);

    console.log("ORG CHUNK", i + 1, chunks.length);

    try {
      await axios.post(
        `https://portal.commonwellalliance.org/Organization/${orgOid}/IncludeList`,
        {
          LocalOrganizationid: orgOid,
          IncludedOrganizationIdList: orgIds,
        },
        {
          headers: {
            Cookie: cookie,
          },
        }
      );
    } catch (error) {
      console.log("ERROR", error);
    }

    const patientsToUpdate = getPatientsToUpdate(patients, orgChunk);

    const newPatients = await Promise.all(
      patientsToUpdate.map(async patient => {
        return await metriportAPI.updatePatient(patient, patient.facilityIds[0]);
      })
    );

    patients = newPatients;

    console.log("UPDATED PATIENTS", patientsToUpdate.length);

    await sleep(10000);
  }
}

const getPatientsToUpdate = (patients: Patient[], orgs: SimpleOrg[]): Patient[] => {
  const orgStates = orgs.map(org => org.States);

  const filteredPatients = patients.filter(patient => {
    let patientStates: string[] = [];

    if (Array.isArray(patient.address)) {
      const patientWithValidStates = patient.address.reduce((acc: string[], address) => {
        if (address.state) {
          return [...acc, address.state];
        }

        return acc;
      }, []);

      patientStates = patientWithValidStates;
    } else {
      if (patient.address.state) patientStates = [patient.address.state];
    }

    return orgStates.some(states => {
      return states.some(state => patientStates.includes(state));
    });
  });

  return filteredPatients;
};

main();

const sleep = (timeInMs: number) => new Promise(resolve => setTimeout(resolve, timeInMs));
