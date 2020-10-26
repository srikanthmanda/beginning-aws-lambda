# Running Notes

## AWS CLI

- Configuring the CLI: `aws configure`
- Getting account details: `aws sts get-caller-identity`

## SAM CLI Limitation

Due to a [limitation](https://github.com/aws/aws-sam-cli/issues/1701), `sam deploy` requires either:

- `--s3-bucket` command line argument OR
- It needs to be run for the first time with `--guided` or `-g` flags. SAM creates a S3 bucket during guided run.

Once you have the S3 bucket to upload your code to, you may -

- Add it to samconfig TOML files as `s3_bucket = "<aws-sam-cli-managed-default-samclisourcebucket-...>"` OR
- Add a `--s3-bucket <aws-sam-cli-managed-default-samclisourcebucket-...>` argument to `sam deploy` commands in `1-deploy.sh` script.

### Workaround

S3 bucket creation can automated using AWS CLI using the following command:

```
aws s3 mb s3://<aws-sam-cli-managed-default-samclisourcebucket-...>
```

The created S3 bucket name can be passed as command line argument `--s3-bucket` to `sam deploy` command.

## Invoking Lambda functions from CLI

```
aws lambda invoke --function-name getAwsDocsRepo \
	getAwsDocsRepo-response.json
```

```
aws lambda invoke --function-name unzipRepoArchive \
	unzipRepoArchive-response.json \
	--cli-binary-format raw-in-base64-out \
	--payload "$(< test-events/unzip-repo-archive-test-event.json)"
```

### Note

- Above commands invoke Lambda synchronously. So any async destination will not get invocation record.
- Add `--invocation-type Event` clause to invoke Lambda asynchronously.

## Lambda, EFS, VPC, and S3

- Lambda functions can connect to EFS using Access Points, associated as `FileSystemConfigs`.
- EFS should have at least one Mount Target.
- Mount Target is associated with Security Groups and Subnet (only one, linked to an Availability Zone).
- Lambda function too should be associated with a VPC configuration (Security Groups and Subnets).

A Lambda function associated with private subnets needs either of the following to connect to S3:
- A route to internet via NAT Gateway (of a public subnet) and Internet Gateway (of the VPC) OR
- A S3 VPC (Gateway) End Point.

λ ==[pvt. subnet RT]==> NAT gateway ==[public subnet RT]==> IGW ==> Internet ==> S3

OR

λ ==[pvt. subnet RT]==> VPC (Gateway) End Point ==> S3

## Lambda Limits

- File descriptors: 1,024

Ref: https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html