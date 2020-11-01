# Deployment Notes

While I coded this application on a Windows 10 machine, I used Bash shell for scripting various activities. I used Windows Subsystem for Linux (WSL) extensively for deployment and testing.

However, the main code and templates should work in either Windows or Linux environments, using AWS and SAM CLIs.

## Prerequisites

### AWS CLI

AWS CLI is needed for configuring AWS credentials and creating S3 bucket for code deployment. Occassionally, I used it to delete CloudFormation stacks in rollback state. Below are the details of AWS CLI versions I used.

On Windows:

```
PS beginning-aws-lambda> aws --version
aws-cli/1.18.113 Python/3.8.2 Windows/10 botocore/1.17.36
```

On WSL:

```
$ beginning-aws-lambda > aws --version
aws-cli/2.0.57 Python/3.9.0 Linux/4.4.0-18362-Microsoft source/x86_64.ubuntu.18
```

### SAM CLI

SAM CLI is needed to deploy the stacks and invoke Lambda functions.

I used the same version of SAM CLI on both Windows and WSL — v1.6.2.

```
sam --version
SAM CLI, version 1.6.2
```

### WSL

Ubuntu version:

```
$ ~ > uname -a
Linux pc 4.4.0-18362-Microsoft #1049-Microsoft Thu Aug 14 12:01:00 PST 2020 x86_64 x86_64 x86_64 GNU/Linux
```

Bash version:

```
$ ~ > bash --version
GNU bash, version 4.4.20(1)-release (x86_64-pc-linux-gnu)
```

## Scripts

The activities of building, deploying and running this application in Linux environment are all scripted.

The Bash shell scripts are located in `scripts` folder.

### Build

- File: [0-build.sh](../scripts/0-build.sh)
- Syntax: `./scripts/0-build.sh`

This script packages the application code in the following steps:

1. Installs `aws-sdk` NPM module in `lib-aws-sdk/nodejs/node_modules` folder.
2. Installs non-dev dependencies of main `package.json` in `node_modules` folder at the root of repo.
3. Deletes `zip` files from `sam-build` folder.
4. Copies `aws-sdk` module to `sam-build/aws-sdk.zip`.
5. Copies `node_modules` to `sam-build/beginning-lambda.zip`.

### Deploy

- File: [1-deploy.sh](../scripts/1-deploy.sh)
- Syntax: `./scripts/1-deploy.sh`

This script creates a S3 bucket to upload the code packaged in previous stage.

It then deploys all three stacks in the following order:

1. `lib-aws-sdk`
2. `lambda-efs-vpc`
3. `beginning-lambda`

This script seeks user inputs. It prompts for deployment confirmation once after each of the three CloudFormation stacks' changesets are ready.

### Run

The script [2-test.sh](../scripts/2-test.sh) is built to test individual Lambda functions by invoking them synchronously using their corresponding payloads in `test-events` folder. However, testing the `getAwsDocsRepo` Lambda function also serves the purpose of invoking this application.

Steps:

```
$ beginning-aws-lambda > ./scripts/2-test.sh
Lambda functions: unzipRepoArchive createAttributeFiles getAwsDocsRepo generateCheatSheet
Choose a lambda function:
```

Enter `getAwsDocsRepo` at above prompt.

Once the test completes, abort the script using `Ctrl`+`C` keyboard command.

A few minutes later, the cheatsheet should be available at `http://aws-cloudformation-attributes-cheatsheet.s3-website.us-east-1.amazonaws.com/`.

Note that in the URL:

- `aws-cloudformation-attributes-cheatsheet` is the name of the cheatsheet static website S3 bucket
- `us-east-1` is the AWS region the application is deployed in.

## Caveats

- S3 bucket names are global. So the deployment script will fail if the S3 bucket names used in the repo already exist. If that happens, simply changing the S3 bucket names in following two locations should fix the issue:
  1.  `SAM_CLI_S3_BUCKET` variable value in [1-deploy.sh](../scripts/1-deploy.sh) file.
  2.  `awsCfnAttrsCheatSheetSiteName` parameter's `Default` attribute in [template.yml](../sam-config/template.yml) file.
- I once had trouble running the files in WSL due to line endings being different in Windows and Unix. I solved the problem using `dos2unix` utility on WSL. Alternatively, you may also configure Git and other Windows tools to retain Unix line endings.
