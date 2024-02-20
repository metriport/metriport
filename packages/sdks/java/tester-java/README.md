# Metriport Java Test

This repository contains a simple Java terminal-based application to test
the Metriport Java SDK.

It configures the compiler to use UTF-8, Java 17, and enables reflection on parameters. It also shows
deprecated APIs and fails on warnings. It contains the [Maven wrapper](https://maven.apache.org/wrapper/).

It includes SLF4J as logging API, logback (with ISO8601 timestamps) as logging backend, JUnit 5 for testing,
and AssertJ for test assertions.

It copies the dependencies to `target/lib`, and configures the JAR file with a main class and a classpath,
so that the resulting JAR can be run with `java -jar`.

## How to use

Clone this repository, update the property `API_KEY` on the file `com.metriport.test.Main.java`, inserting
your API Key there. Your API Key can be found on [Metriport's dashboard](https://dash.metriport.com/),
under "Developers".

## Building

Run `./mvnw clean package` and check the `target` folder.

## Running

Run `java -Dapi_key=YOUR-KEY -jar target/metriport-test-1.0.jar` and:

- replace `YOUR-KEY` with the vale of your API key
- replace the version with whatever version defined on `pom.xml` (the default one is `1.0`, which doesn't
  require any changes)
- note that Dapi_key is not related to DAPI (devices API). It is java syntax to add the -D with no space
