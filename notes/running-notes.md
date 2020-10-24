# Running Notes

## SAM CLI Limitation

Due to a [limitation](https://github.com/aws/aws-sam-cli/issues/1701), `sam deploy` requires either:
- `--s3-bucket` command line argument OR
- It needs to be run for the first time with `--guided` or `-g` flags. SAM creates a S3 bucket during guided run.

Once you have the S3 bucket to upload your code to, you may -
- Add it to samconfig TOML files as `s3_bucket = "<aws-sam-cli-managed-default-samclisourcebucket-...>"` OR
- Add a `--s3-bucket <aws-sam-cli-managed-default-samclisourcebucket-...>` argument to `sam deploy` commands in `1-deploy.sh` script.

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
