const fs = require("fs");
const readline = require("readline");

const AWS = require("aws-sdk");
const sqs = new AWS.SQS();
const dynoDb = new AWS.DynamoDB();

const successNotificationSqs = process.env.SUCC_NOTIFY_SQS;
const rootDir = process.env.EFS_PATH ? process.env.EFS_PATH : "/tmp";
const cfnAttrFilesDir = process.env.CFN_ATTR_FILES_PATH
  ? process.env.CFN_ATTR_FILES_PATH
  : "aws-cloudformation-attributes";
const batchSize = process.env.FILE_BATCH_SIZE
  ? process.env.FILE_BATCH_SIZE
  : 25;
const indexTable = process.env.ATTR_FILES_INDEX_TABLE
  ? process.env.ATTR_FILES_INDEX_TABLE
  : "cfnAttributeFilesIndex";

const dataDir = rootDir + "/" + cfnAttrFilesDir;

exports.handler = async function (event) {
  const repoDir = JSON.parse(event.Records[0].Sns.Message).responsePayload;
  const inputDir = rootDir + "/" + repoDir;

  if (fs.existsSync(dataDir)) {
    fs.rmdirSync(dataDir, { recursive: true });
    console.info(`Deleted directory: ${dataDir}.`);
  }
  fs.mkdirSync(dataDir);
  console.info(`Created directory ${dataDir}.`);

  await createAttributeFiles(inputDir, dataDir);
  console.log("Attribute files created. Sending message to SQS ...");
  return sqs
    .sendMessage({
      MessageBody: indexTable,
      QueueUrl: successNotificationSqs,
    })
    .promise();
};

function createAttributesFile(input, outputDir, indexFile) {
  return new Promise(async (resolve) => {
    const PAGE_START = "# ";
    const SECTION_START = "## ";
    const RETURN_VALUES_SECTION_START = "## Return values";

    const LINE_FILTER_REGEX = /For more information about using |The following are the available attributes and sample return values|####/;
    const NAME_ANCHOR_REGEX = /<a name="[\w+:-]*"><\/a>$/;

    const output =
      outputDir +
      "/" +
      input.split("/").reverse()[0].replace(/\.md$/, "_attributes.md");
    const attributesFile = fs.createWriteStream(output);

    const rl = readline.createInterface({
      input: fs.createReadStream(input),
      crlfDelay: Infinity,
    });

    console.info("Input: " + input);

    let inReturnValuesSection = false;
    let hasReturnValues = false;
    let linesRead = 0;
    let entity;
    let entityDetails;

    for await (const line of rl) {
      linesRead++;
      if (!inReturnValuesSection && line.startsWith(PAGE_START)) {
        entity = line.split("<", 1)[0];
      } else if (line.startsWith(RETURN_VALUES_SECTION_START)) {
        inReturnValuesSection = true;
        hasReturnValues = true;
        attributesFile.write(entity + "\n");
        console.debug(
          "Return Values section of " + input + " is at line " + linesRead
        );
      } else if (inReturnValuesSection && line.startsWith(SECTION_START)) {
        break;
      } else if (inReturnValuesSection && !LINE_FILTER_REGEX.test(line)) {
        attributesFile.write(line.replace(NAME_ANCHOR_REGEX, "") + "\n");
      }
    }

    attributesFile.end();

    if (hasReturnValues) {
      entityDetails = {
        entity: entity.split("::").slice(1),
        file: output.split("/").reverse()[0],
      };
      fs.appendFileSync(indexFile, entity + "," + output + "\n");
      console.debug("Index updated for " + input);
      console.debug("Lines read in " + input + ": " + linesRead);
    } else {
      fs.unlink(output, (error) => {
        if (error) {
          console.error("Failed to delete empty output: " + output);
          console.error("Error: " + JSON.stringify(error));
        } else {
          console.debug("Deleted empty output: " + output);
        }
      });
    }
    console.log(`Processed file: ${input}`);
    resolve(entityDetails);
  });
}

async function createAttributeFiles(inputDir, outputDir) {
  const INDEX_FILE = "aws_cloudformation_attributes_index.csv";
  const indexFile = outputDir + "/" + INDEX_FILE;
  const RESOURCE_FILE_NAME_REGEX = /^aws-resource-.*\.md$/;
  const PROPERTIES_FILE_NAME_REGEX = /^aws-properties-.*\.md$/;

  let docFiles;
  let batchStart = 0;

  try {
    docFiles = fs
      .readdirSync(inputDir)
      .filter(
        (file) =>
          RESOURCE_FILE_NAME_REGEX.test(file) ||
          PROPERTIES_FILE_NAME_REGEX.test(file)
      );
  } catch (error) {
    console.error("Failed to read directory: " + inputDir);
    throw error;
  }

  const lastBatchEnd = docFiles.length - 1;
  console.debug(`Entity files found: ${lastBatchEnd + 1}`);

  if (fs.existsSync(indexFile)) fs.unlinkSync(indexFile);

  while (batchStart < lastBatchEnd) {
    let batchEnd = batchStart + batchSize;
    batchEnd = batchEnd < lastBatchEnd ? batchEnd : lastBatchEnd;
    console.log(`Batch: ${batchStart} - ${batchEnd - 1}`);
    const attributeFiles = await Promise.all(
      docFiles
        .slice(batchStart, batchEnd)
        .map((docFile) =>
          createAttributesFile(inputDir + "/" + docFile, outputDir, indexFile)
        )
    );
    if (attributeFiles.filter(Boolean).length) {
      await storeRecords(attributeFiles.filter((e) => e));
    }
    batchStart = batchEnd;
  }
  return INDEX_FILE;
}

async function storeRecords(indexBatch) {
  const itemsBatch = {
    RequestItems: {
      cfnAttributeFilesIndex: indexBatch.map((e) => ({
        PutRequest: {
          Item: {
            api: { S: e.entity[0] },
            resource: { S: e.entity[1] },
            file: { S: e.file },
          },
        },
      })),
    },
  };
  await dynoDb.batchWriteItem(itemsBatch).promise();
}
