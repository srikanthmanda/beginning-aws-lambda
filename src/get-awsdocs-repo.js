const AWS = require("aws-sdk");
const { request } = require("@octokit/request");

const s3 = new AWS.S3();

exports.handler = async function () {
  const repoArchive = await request(
    "GET /repos/:owner/:repo/:archive_format/:ref",
    {
      owner: "awsdocs",
      repo: "aws-cloudformation-user-guide",
      archive_format: "zipball",
      ref: "main",
    }
  );
  console.debug("repoArchiveURL: " + JSON.stringify(repoArchive));

  const s3Params = {
    Bucket: process.env.AWS_DOCS_REPO_BUCKET,
    Key: "aws-cloudformation-user-guide.zip",
    Body: Buffer.from(repoArchive.data),
  };
  return s3
    .upload(s3Params, function (err, data) {
      console.log(err, data);
    })
    .promise();
};
