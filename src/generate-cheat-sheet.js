const fs = require("fs");

const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const dynoDb = new AWS.DynamoDB();

const rootDir = process.env.EFS_PATH ? process.env.EFS_PATH : "/tmp";
const cfnAttrFilesDir = process.env.CFN_ATTR_FILES_PATH
  ? process.env.CFN_ATTR_FILES_PATH
  : "aws-cloudformation-attributes";
const cfnAttrCheatSheet = process.env.AWS_CFN_ATTRS_CHEATSHEET
  ? process.env.AWS_CFN_ATTRS_CHEATSHEET
  : "aws-cloudformation-attributes.md";
const cfnAttrCheatSheetSite = process.env.AWS_CFN_ATTRS_CHEATSHEET_SITE
  ? process.env.AWS_CFN_ATTRS_CHEATSHEET_SITE
  : "aws-cloudformation-attributes-cheatsheet";
const dataDir = rootDir + "/" + cfnAttrFilesDir;

exports.handler = async function (event) {
  const indexTable = event.Records[0].body;
  const cheatSheet = dataDir + "/" + cfnAttrCheatSheet;
  await generateCheatsheet(indexTable, cheatSheet);
  const s3Params = {
    Bucket: cfnAttrCheatSheetSite,
    Key: "index.md",
    Body: fs.createReadStream(cheatSheet),
    ACL: "public-read",
    ContentType: "text/plain",
  };
  return s3
    .putObject(s3Params, function (err, data) {
      console.log(err, data);
    })
    .promise();
};

async function generateCheatsheet(indexTable, cheatSheet) {
  const FOOTER =
    "- - -\n" +
    "This document was generated from [AWS CloudFormation User Guide]" +
    "(https://github.com/awsdocs/aws-cloudformation-user-guide) " +
    "using [`aws-cloudformation-attributes`]" +
    "(https://github.com/srikanthmanda/aws-cloudformation-attributes).";
  const dataMap = {};

  const filesIndex = await dynoDb.scan({ TableName: indexTable }).promise();
  console.log(JSON.stringify(filesIndex));
  filesIndex.Items.forEach((e) => {
    const api = e.api.S;

    if (!dataMap[api]) {
      dataMap[api] = {};
    }
    dataMap[api][e.resource.S] = e.file.S;
  });

  const cheatSheetBody = cheatSheet.replace(/\.md$/, "_body.md");
  fs.writeFileSync(
    cheatSheet,
    "# AWS CloudFormation Attributes\n\n## Table of Contents\n"
  );

  for (const api of Object.keys(dataMap).sort()) {
    fs.appendFileSync(cheatSheet, "\n### AWS::" + api + "\n");
    for (const entity of Object.keys(dataMap[api]).sort()) {
      fs.appendFileSync(
        cheatSheetBody,
        "\n#" + fs.readFileSync(dataDir + "/" + dataMap[api][entity])
      );
      fs.appendFileSync(
        cheatSheet,
        "* [AWS::" +
          api +
          "::" +
          entity +
          "](#aws" +
          (api + entity).toLowerCase() +
          ")\n"
      );
    }
  }

  fs.appendFileSync(cheatSheet, fs.readFileSync(cheatSheetBody));
  fs.appendFileSync(cheatSheet, FOOTER);
  console.log("cheatSheet created: " + cheatSheet);
  fs.unlink(cheatSheetBody, (error) => {
    if (error) {
      console.error("Failed to delete cheatSheet body: " + cheatSheetBody);
      console.error("Error: " + JSON.stringify(error));
    } else {
      console.debug("Deleted cheatSheet body: " + cheatSheetBody);
    }
  });
}
