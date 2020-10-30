#!/bin/bash

set -eo pipefail

cd $(dirname $0) && cd ..

DIR_REPO_ROOT=$(pwd)
DIR_CORE_LIB="${DIR_REPO_ROOT}/lib-aws-sdk/nodejs"
DIR_SAM_BUILD="${DIR_REPO_ROOT}/sam-build"

function installProdDependencies {
  test -d $1 || (echo "Directory $1 does not exist" && exit 1)
  cd $1 && echo "In directory: $(pwd)"
  (test -f package.json || -f package-lock.json) || (echo "package.json or package-lock.json do not exist" && exit 1)
  # test -d node_modules && echo "Pruning node_modules for production ..." && npm prune --production
  npm ci --production && echo "Installed production node_modules."
  cd ${DIR_REPO_ROOT} && echo "Back in root directory $(pwd)"
}

# echo ${DIR_CORE_LIB}
installProdDependencies ${DIR_CORE_LIB}
# echo ${DIR_REPO_ROOT} 
installProdDependencies ${DIR_REPO_ROOT}

rm ${DIR_SAM_BUILD}/*.zip || echo "No build files to delete"

npm run sampkg-aws-sdk-layer
npm run sampkg

echo "Layer and function build successfully."