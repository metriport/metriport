# Metriport Core package

A package to share common SERVER-SIDE code across other [Metriport](https://metriport.com/) packages.

Important: avoid code that executes logic asynchronously! Since code from this package is used by Lambdas, and those terminate the Node process upon return of their `handle()` function, this means that any code running asynchronously in the background might be killed, leading to unexpected behavior.

If you're looking for Metriport's API SDK, check this one out: https://www.npmjs.com/package/@metriport/api-sdk

If you're looking for a package to share common code that can be used across the stack, check out the `packages/shared` one.

[Metriport](https://metriport.com/) is a universal and open-source API for healthcare data.

```
            ,▄,
          ▄▓███▌
      ▄▀╙   ▀▓▀    ²▄
    ▄└               ╙▌
  ,▀                   ╨▄
  ▌                     ║
                         ▌
                         ▌
,▓██▄                 ╔███▄
╙███▌                 ▀███▀
    ▀▄
      ▀╗▄         ,▄
         '╙▀▀▀▀▀╙''


      by Metriport Inc.

```
