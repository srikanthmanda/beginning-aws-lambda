#!/bin/bash

set -eo pipefail

cd $(dirname $0) && cd ..

DIR_REPO_ROOT=$(pwd)
DIR_SCRIPTs="${DIR_REPO_ROOT}/scripts"
DIR_TEST_EVENTS="${DIR_REPO_ROOT}/test-events"
DIR_SAM_CONFIG="${DIR_REPO_ROOT}/sam-config"

declare -A lambdaFns

function prepareLambdaFnsList {
  templateFile=$1
  numFunctions=0
  numHandlers=0
  #grep -E "FunctionName|Handler" ${templateFile} | while IFS= read -r line
  ## http://mywiki.wooledge.org/BashFAQ/024
  while IFS= read -r line
  do
    if [[ ${line} =~ "FunctionName" ]]
    then
      lastFunction=$(echo ${line} | cut -d ' ' -f 2)
      (( numFunctions+=1 ))
    else
      lastHandler=$(echo ${line} | cut -d '/' -f 2 | cut -d '.' -f 1)
      (( numHandlers+=1 ))
    fi
    
    if [[ numFunctions -eq numHandlers ]]
    then
      lambdaFns["${lastFunction}"]="${lastHandler}"
    fi
  done <<< $(grep -E "FunctionName|Handler" ${templateFile})
}

function testLambda {
  fnSource=${lambdaFns[$1]}
  responseFile="${DIR_TEST_EVENTS}/${fnSource}-response.json"
  payload=$(< ${DIR_TEST_EVENTS}/${fnSource}-test-event.json)
  aws lambda invoke --function-name $1 \
    ${responseFile} \
    --cli-binary-format raw-in-base64-out \
    --payload "${payload}"
}

prepareLambdaFnsList ${DIR_SAM_CONFIG}/template.yml

while true
do
  echo "Lambda functions: ${!lambdaFns[@]}"
  read -p "Choose a lambda function: " lambdaFn
  testLambda ${lambdaFn}
done
