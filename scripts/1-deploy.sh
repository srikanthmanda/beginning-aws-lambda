#!/bin/bash

set -eo pipefail

cd $(dirname $0) && cd ..

echo "Deploying layer ..."
sam deploy -t template-lib-aws-sdk.yml --config-file samconfig-lib-aws-sdk.toml
test $? -eq 0 || (echo "Layer deployment failed, exiting... " && exit 1)
echo "Layer deployed."

echo "Deploying stack ..."
sam deploy -t template.yml --config-file samconfig.toml
test $? -eq 0 || (echo "Deployment failed, exiting... " && exit 1)
echo "Stack deployed."