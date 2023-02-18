#!/bin/bash
############################################################
# Help                                                     #
############################################################
Help()
{
   # Display Help
   echo "Script used to deploy the Metriport API."
   echo
   echo "Syntax: deploy.sh [h|e|s|d]"
   echo "options:"
   echo "h     Print this Help."
   echo "e     The environment to which to deploy to. Must be one of production|sandbox|staging"
   echo "s     The name of the CDK stack you want to deploy."
   echo "d     Indicates to issue a 'diff' command instead of deploy."
   echo
   echo "Example: deploy.sh -e \"production\" -s \"APIInfrastructureStack\""
   echo
}

############################################################
# Deploy                                                   #
############################################################
Deploy()
{
   if [[ "$diff" == "true" ]]; then
      cmd="diff"
   else
      cmd="deploy"
   fi
   echo "$cmd'ing to env $env"
   if [[ "$env" == "staging" ]]; then
      npm run prep-deploy-staging
   else
      npm run prep-deploy
   fi
   cd ./infra
   cdk bootstrap -c env=$env
   cdk $cmd -c env=$env $stack
   cd ../
   echo "Done!"
}

############################################################
############################################################
# Main program                                             #
############################################################
############################################################


############################################################
# Process the input options.                               #
############################################################
# Get the options
while getopts ":he:s:d" option; do
   case $option in
      h) # display Help
         Help
         exit;;
      e) # the environment to deploy to
         env=$OPTARG;;
      s) # the stack to deploy
         stack=$OPTARG;;
      d) # run a diff instead of deploy
         diff=true;;
      \?) # Invalid option
          echo "Error: Invalid option"
          exit;;
   esac
done

if [[ -z "$stack" ]]; then
    echo "No stack specified! -s must be set to the stack you want to deploy"
    exit
fi

if [[ "$env" =~ ^production|sandbox|staging$ ]]; then
    Deploy
else
    echo "Invalid environment! -e must be one of production|sandbox|staging"
fi