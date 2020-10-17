Due to a [limitation](https://github.com/aws/aws-sam-cli/issues/1701), `sam deploy` requires either:
- `--s3-bucket` command line argument OR
- It needs to be run for the first time with `--guided` or `-g` flags. SAM creates a S3 bucket during guided run.


Once you have the S3 bucket to upload your code to, you may -
- Add it to samconfig TOML files as `s3_bucket = "<aws-sam-cli-managed-default-samclisourcebucket-...>"` OR
- Add a `--s3-bucket <aws-sam-cli-managed-default-samclisourcebucket-...>` argument to `sam deploy` commands in `1-deploy.sh` script.