#!/bin/bash

set -eo pipefail

SAM_CLI_S3_BUCKET='aws-sam-cli-managed-default-samclisourcebucket-nasb5bg3gqu9'
aws s3 mb s3://${SAM_CLI_S3_BUCKET}

cd $(dirname $0) && cd ..

echo "Deploying layer ..."
sam deploy --s3-bucket ${SAM_CLI_S3_BUCKET} -t template-lib-aws-sdk.yml --config-file samconfig-lib-aws-sdk.toml
test $? -eq 0 || (echo "Layer deployment failed, exiting... " && exit 1)
echo "Layer deployed."

echo "Deploying stack ..."
sam deploy --s3-bucket ${SAM_CLI_S3_BUCKET} -t template.yml --config-file samconfig.toml
test $? -eq 0 || (echo "Deployment failed, exiting... " && exit 1)
echo "Stack deployed."