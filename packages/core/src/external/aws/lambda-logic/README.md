# DEPRECATION NOTICE

This folder should not exist. If we put all "lambda logic" in this folder, we will have a hard time
maintaining it, as all lambdas' logic will be in a single place.

What we've been doing for all other lambdas is to call commands/functions that are stored in the
proper folder for each use case/business logic.
