const fs = require("fs");
const readline = require("readline");

const AWS = require("aws-sdk");
const sqs = new AWS.SQS();

const successNotificationSqs = process.env.SUCC_NOTIFY_SQS;
const rootDir = process.env.EFS_PATH ? process.env.EFS_PATH : "/tmp";
const cfnAttrFilesDir = process.env.CFN_ATTR_FILES_PATH
  ? process.env.CFN_ATTR_FILES_PATH
  : "aws-cloudformation-attributes";
const batchSize = process.env.FILE_BATCH_SIZE
  ? process.env.FILE_BATCH_SIZE
  : 50;

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
  return sqs
    .sendMessage({
      MessageBody: dataDir,
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
    resolve();
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
    await Promise.all(
      docFiles.slice(batchStart, batchEnd).map(async (docFile) => {
        try {
          await createAttributesFile(
            inputDir + "/" + docFile,
            outputDir,
            indexFile
          );
        } catch (error) {
          console.error("Error processing " + docFile);
          throw error;
        }
      })
    );
    batchStart = batchEnd;
  }
}
