const fs = require("fs");
const AWS = require("aws-sdk");
const unzip = require("yauzl");

const s3 = new AWS.S3();

const rootDir = process.env.EFS_PATH ? process.env.EFS_PATH : "/tmp";
const repoDir = "aws-cloudformation-user-guide";
const unzipDir = rootDir + "/" + repoDir;

if (!fs.existsSync(unzipDir)) {
  fs.mkdirSync(unzipDir);
}

exports.handler = async function (event) {
  const repoObject = await s3
    .getObject({
      Bucket: event.Records[0].s3.bucket.name,
      Key: event.Records[0].s3.object.key,
    })
    .promise();
  console.log("Repo object retrieved.");
  console.log(`ContentType: ${repoObject.ContentType}`);
  console.log(`StorageClass: ${repoObject.StorageClass}`);
  return extractEntityFiles(repoObject.Body, unzipDir);
};

function extractEntityFiles(objBuffer, unzipDir) {
  console.log("Extracting files from buffer ...");
  return new Promise((resolve, reject) => {
    const entityFilesNamePatterns = /^aws-resource-.*\.md$|^aws-properties-.*\.md$/;

    unzip.fromBuffer(objBuffer, { lazyEntries: true }, function (err, zipFile) {
      if (err) reject(err);
      let numOfEntityFiles = 0;
      zipFile.readEntry();
      zipFile.on("entry", function (entry) {
        if (/\/$/.test(entry.fileName)) {
          // Diretory entry - read another entry
          console.log(`Directory: ${entry.fileName}`);
          zipFile.readEntry();
        } else {
          const entryName = entry.fileName.split("/").reverse()[0];
          // Extract if entity file OR read another entry
          if (entityFilesNamePatterns.test(entryName)) {
            numOfEntityFiles++;
            const entityFile = fs.createWriteStream(`${unzipDir}/${entryName}`);
            zipFile.openReadStream(entry, function (err, readStream) {
              if (err) throw err;
              readStream.on("end", function () {
                // On to the next entry
                zipFile.readEntry();
              });
              readStream.pipe(entityFile);
            });
          } else {
            zipFile.readEntry();
          }
        }
      });
      zipFile.on("end", function () {
        console.info(`Entity files extracted: ${numOfEntityFiles}`);
        resolve(repoDir);
      });
    });
  });
}
