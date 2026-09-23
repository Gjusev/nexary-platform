type MinioClient = any;

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for MinIO integration`);
  return v;
}

export async function getMinioClient(): Promise<MinioClient | null> {
  try {
    // Dynamic import to avoid hard dependency when not configured
    const Minio = (await import('minio')).default;
    const endPoint = process.env.MINIO_ENDPOINT;
    const accessKey = process.env.MINIO_ACCESS_KEY;
    const secretKey = process.env.MINIO_SECRET_KEY;
    if (!endPoint || !accessKey || !secretKey) return null;
    const port = process.env.MINIO_PORT ? Number(process.env.MINIO_PORT) : 9000;
    const useSSL = String(process.env.MINIO_USE_SSL || 'false').toLowerCase() === 'true';
    const client = new Minio.Client({ endPoint, port, useSSL, accessKey, secretKey });
    return client;
  } catch {
    return null;
  }
}

export async function ensureBucket(bucket: string): Promise<void> {
  const client = await getMinioClient();
  if (!client) throw new Error('MinIO client not configured');
  const exists = await client.bucketExists(bucket).catch(() => false);
  if (!exists) {
    await client.makeBucket(bucket, 'us-east-1');
  }
}

export async function presignedPutObject(bucket: string, objectKey: string, expirySeconds = 900): Promise<string> {
  const client = await getMinioClient();
  if (!client) throw new Error('MinIO client not configured');
  await ensureBucket(bucket);
  return await client.presignedPutObject(bucket, objectKey, expirySeconds);
}

export async function getObjectAsString(bucket: string, objectKey: string): Promise<string> {
  const client = await getMinioClient();
  if (!client) throw new Error('MinIO client not configured');
  const stream = await client.getObject(bucket, objectKey);
  const chunks: any[] = [];
  return await new Promise<string>((resolve, reject) => {
    stream.on('data', (d: any) => chunks.push(d));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}

export async function getObjectBuffer(bucket: string, objectKey: string): Promise<Buffer> {
  const client = await getMinioClient();
  if (!client) throw new Error('MinIO client not configured');
  const stream = await client.getObject(bucket, objectKey);
  const chunks: any[] = [];
  return await new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (d: any) => chunks.push(d));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export async function putObjectBuffer(bucket: string, objectKey: string, buf: Buffer, contentType = 'application/octet-stream'): Promise<void> {
  const client = await getMinioClient();
  if (!client) throw new Error('MinIO client not configured');
  await ensureBucket(bucket);
  await client.putObject(bucket, objectKey, buf, { 'Content-Type': contentType });
}

export async function removePrefix(bucket: string, prefix: string): Promise<void> {
  const client = await getMinioClient();
  if (!client) return; // silently ignore if not configured
  const objectsStream = await client.listObjectsV2(bucket, prefix, true);
  // listObjectsV2 returns a stream in minio SDK
  await new Promise<void>((resolve, reject) => {
    const toDelete: string[] = [];
    objectsStream.on('data', (obj: { name: string }) => { if (obj?.name) toDelete.push(obj.name); });
    objectsStream.on('end', async () => {
      try {
        for (const name of toDelete) {
          await client.removeObject(bucket, name);
        }
        resolve();
      } catch (e) { reject(e); }
    });
    objectsStream.on('error', reject);
  });
}
