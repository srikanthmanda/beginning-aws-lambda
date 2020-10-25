#!/bin/bash

set -eo pipefail

SAM_CLI_S3_BUCKET='aws-sam-cli-managed-default-samclisourcebucket-nasb5bg3gqu9'
aws s3 mb s3://${SAM_CLI_S3_BUCKET}

cd $(dirname $0) && cd ..

DIR_REPO_ROOT=$(pwd)
DIR_SAM_CONFIG="${DIR_REPO_ROOT}/sam-config"

echo "Creating AWS SDK layer ..."
sam deploy --s3-bucket ${SAM_CLI_S3_BUCKET} -t ${DIR_SAM_CONFIG}/template-lib-aws-sdk.yml --config-file ${DIR_SAM_CONFIG}/samconfig-lib-aws-sdk.toml
test $? -eq 0 || (echo "Layer deployment failed, exiting... " && exit 1)
echo "Layer created."

echo "Creating VPC & EFS ..."
sam deploy --s3-bucket ${SAM_CLI_S3_BUCKET} -t ${DIR_SAM_CONFIG}/template-efs-vpc.yml --config-file ${DIR_SAM_CONFIG}/samconfig-efs-vpc.toml
test $? -eq 0 || (echo "Layer deployment failed, exiting... " && exit 1)
echo "VPC & EFS created."

echo "Deploying stack ..."
sam deploy --s3-bucket ${SAM_CLI_S3_BUCKET} -t ${DIR_SAM_CONFIG}/template.yml --config-file ${DIR_SAM_CONFIG}/samconfig.toml
test $? -eq 0 || (echo "Deployment failed, exiting... " && exit 1)
echo "Stack deployed."