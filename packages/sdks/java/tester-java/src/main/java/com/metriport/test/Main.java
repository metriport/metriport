package com.metriport.test;
import io.github.cdimascio.dotenv.Dotenv;
import com.metriport.api.Metriport;
import com.metriport.api.resources.commons.types.Address;
import com.metriport.api.resources.commons.types.UsState;
import com.metriport.api.resources.medical.organization.types.OrganizationCreate;
import com.metriport.api.resources.medical.organization.types.OrgType;


public class Main {
    public static void main(String[] args) {
      // GetOrg.main(args);
      // GetFacility.main(args);
      //CreateFacility.main(args); 
      GetPatient.getAllPatients(args);
      //GetPatient.getSpecificPatient(args);
    }
}