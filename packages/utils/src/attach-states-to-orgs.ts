import * as fs from "fs";
import * as dotenv from "dotenv";
import axios from "axios";

dotenv.config();
// Keep dotenv import and config before everything else

type SimpleOrg = {
  Id: string;
  Name: string;
  States?: string[];
};

type Org = {
  Id: string;
  Name: string;
  AllSelected: boolean;
  Organizations: SimpleOrg[];
};

type Orgs = {
  AllCareQualityOrganizations: Org[];
};

const orgsList = fs.readFileSync("./orgs-list.json", "utf8");

async function main() {
  const orgs: Orgs = JSON.parse(orgsList);

  let newList: SimpleOrg[] = [];

  for (const org of orgs.AllCareQualityOrganizations) {
    for (const simpleOrg of org.Organizations) {
      try {
        const url = `https://wpapi.sequoiaproject.org/fhir-stu3/1.0.0/Organization?_format=json&apikey=7sWkoiMqhCxR-eFJ9wQHXrmaPzfAgSTvE8YU2Gy4jbcLZNpduK&_name:contains=${simpleOrg.Name}&_radius=30&_sort=orgname&_active=true`;

        const response = await axios.get(url);

        const states = response.data.Bundle.entry.map((entry: any) => {
          return entry.resource.Organization.address.state.value;
        });

        const newOrg = {
          ...simpleOrg,
          States: states,
        };

        newList = [...newList, newOrg];
      } catch (error) {
        newList = [
          ...newList,
          {
            ...simpleOrg,
            States: [],
          },
        ];
        console.log("ERROR", error);
      }
    }
  }

  const newListCount = newList.length;
  const listWithStatesCount = newList.filter(org => org.States?.length).length;

  console.log("COUNTS", newListCount, listWithStatesCount);

  fs.writeFileSync("./converted-org-list.json", JSON.stringify(newList));
}

main();
