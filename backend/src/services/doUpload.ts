import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

function createS3Client(): S3Client {
  const {
    DO_SPACE_ACCESS_KEY,
    DO_SPACE_SECRET_KEY,
    DO_SPACE_REGION,
  } = process.env;

  if (!DO_SPACE_ACCESS_KEY || !DO_SPACE_SECRET_KEY || !DO_SPACE_REGION) {
    throw new Error('Missing DigitalOcean Spaces configuration');
  }

  return new S3Client({
    region: DO_SPACE_REGION,
    endpoint: `https://${DO_SPACE_REGION}.digitaloceanspaces.com`,
    credentials: {
      accessKeyId: DO_SPACE_ACCESS_KEY,
      secretAccessKey: DO_SPACE_SECRET_KEY,
    },
  });
}

export async function uploadToSpace(file: Express.Multer.File): Promise<string> {
  const {
    DO_SPACE_BUCKET,
    DO_SPACE_URL,
  } = process.env;

  if (!DO_SPACE_BUCKET || !DO_SPACE_URL) {
    throw new Error('Missing DigitalOcean Spaces configuration (bucket or URL)');
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Unsupported file type');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File is too large');
  }

  const key = `uploads/${uuidv4()}-${file.originalname}`;

  const s3 = createS3Client();

  const command = new PutObjectCommand({
    Bucket: DO_SPACE_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read',
  });

  await s3.send(command);

  return `${DO_SPACE_URL}/${key}`;
}