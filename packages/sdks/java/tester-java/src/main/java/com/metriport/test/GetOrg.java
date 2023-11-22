package com.metriport.test;

import io.github.cdimascio.dotenv.Dotenv;
import com.metriport.api.Metriport;

public class GetOrg {
    public static void main(String[] args) {
        Dotenv dotenv = Dotenv.load();

        Metriport metriport = Metriport.builder()
            .apiKey(dotenv.get("API_KEY"))
            .url(dotenv.get("BASE_URL"))
            .build();

        var response = metriport.medical().organization().get();
        System.out.println("Received response!" + response);
    }
}
