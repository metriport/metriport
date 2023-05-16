Steps to update auto-generated files:

1. install Java
2. download antlr4 jar from http://www.antlr.org/download/
3. "java -jar c:\Javalib\antlr-4.9.2-complete.jar -Dlanguage=JavaScript -listener -visitor C:\src2\conversion-pilot\src\lib\outputProcessor\json.g4 -o C:\src2\conversion-pilot\src\lib\outputProcessor\autogen\"
