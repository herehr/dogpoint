import AWS from 'aws-sdk';

const spaceEndpoint = new AWS.Endpoint(process.env.DO_SPACE_ENDPOINT || '');
const s3 = new AWS.S3({
  endpoint: spaceEndpoint,
  accessKeyId: process.env.DO_SPACE_KEY,
  secretAccessKey: process.env.DO_SPACE_SECRET,
  region: process.env.DO_SPACE_REGION,
});

export default async function doUpload(buffer: Buffer, key: string, contentType: string): Promise<string> {
  const bucket = process.env.DO_SPACE_BUCKET;

  if (!bucket) {
    throw new Error('Missing DO_SPACE_BUCKET env var');
  }

  const uploadParams = {
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ACL: 'public-read',
    ContentType: contentType,
  };

  await s3.putObject(uploadParams).promise();

  const url = `https://${bucket}.${process.env.DO_SPACE_REGION}.${process.env.DO_SPACE_ENDPOINT?.replace('https://', '')}/${key}`;
  return url;
}