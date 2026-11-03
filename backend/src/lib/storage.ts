import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppError } from '../middleware/error.js';
import crypto from 'crypto';
import path from 'path';

export interface GenerateUploadUrlParams {
  workspaceId: string;
  brandId: string;
  filename: string;
  contentType: string;
  byteSize: number;
}

export interface UploadUrlResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresInSeconds: number;
}

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
};

const MAX_IMAGE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB

export class StorageService {
  private static s3Client: S3Client | null = null;

  private static getS3Client(): S3Client | null {
    if (this.s3Client) return this.s3Client;

    const endpoint = process.env.STORAGE_ENDPOINT; // e.g. https://<account_id>.r2.cloudflarestorage.com
    const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
    const region = process.env.STORAGE_REGION || 'auto';

    if (endpoint && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      return this.s3Client;
    }

    return null;
  }

  /**
   * Sanitizes a filename, preventing directory traversal and null-byte injection.
   */
  public static sanitizeFilename(rawFilename: string): string {
    // Strip null-bytes and path separators
    let clean = rawFilename.replace(/\0/g, '').replace(/\\/g, '/');
    // Extract base name only
    clean = path.posix.basename(clean);
    // Replace any remaining path traversal attempts
    clean = clean.replace(/\.\.+/g, '');
    // Allow only alphanumeric, dots, hyphens, underscores
    clean = clean.replace(/[^a-zA-Z0-9._-]/g, '_');

    if (!clean || clean === '.' || clean === '..') {
      clean = 'upload_' + Date.now();
    }

    return clean;
  }

  /**
   * Validates MIME type, file extension, and size limits.
   */
  public static validateFile(filename: string, contentType: string, byteSize: number) {
    const ext = path.extname(filename).toLowerCase();
    const allowedExtensions = ALLOWED_MIME_TYPES[contentType.toLowerCase()];

    if (!allowedExtensions || !allowedExtensions.includes(ext)) {
      throw new AppError(
        'INVALID_MEDIA_TYPE',
        `Unsupported media type: ${contentType} with extension ${ext}. Allowed: JPEG, PNG, WEBP, GIF, MP4, MOV.`,
        400
      );
    }

    const isVideo = contentType.startsWith('video/');
    const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

    if (byteSize > limit) {
      throw new AppError(
        'FILE_TOO_LARGE',
        `File size (${(byteSize / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowable limit (${limit / (1024 * 1024)}MB).`,
        400
      );
    }
  }

  /**
   * Generates an S3/R2 direct presigned PUT upload URL and the permanent public CDN URL.
   */
  public static async generatePresignedUploadUrl(
    params: GenerateUploadUrlParams
  ): Promise<UploadUrlResult> {
    const { workspaceId, brandId, filename, contentType, byteSize } = params;

    // 1. Validation & Traversal Shield
    const safeFilename = this.sanitizeFilename(filename);
    this.validateFile(safeFilename, contentType, byteSize);

    // 2. Structured Storage Key: media/{workspaceId}/{brandId}/{uuid}_{filename}
    const uniqueId = crypto.randomUUID();
    const key = `media/${workspaceId}/${brandId}/${uniqueId}_${safeFilename}`;

    const bucketName = process.env.STORAGE_BUCKET_NAME || 'murmura-media';
    const publicDomain = (
      process.env.STORAGE_PUBLIC_DOMAIN ||
      process.env.R2_PUBLIC_DOMAIN ||
      'https://cdn.murmura.io'
    ).replace(/\/$/, '');

    const publicUrl = `${publicDomain}/${key}`;
    const expiresInSeconds = 900; // 15 minutes

    const s3 = this.getS3Client();

    if (s3) {
      // Live Cloudflare R2 / AWS S3 presigned URL
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: contentType,
        ContentLength: byteSize,
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
      return { uploadUrl, publicUrl, key, expiresInSeconds };
    }

    // Local Test / Development Provider Fallback (with HMAC signature)
    const apiUrl = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
    const expires = Date.now() + expiresInSeconds * 1000;
    const signingKey = process.env.COOKIE_SECRET || process.env.JWT_ACCESS_SECRET || 'local-storage-secret';
    const sig = crypto.createHmac('sha256', signingKey).update(`${key}:${expires}`).digest('hex');
    const uploadUrl = `${apiUrl}/api/v1/library/upload-local?key=${encodeURIComponent(key)}&expires=${expires}&sig=${sig}`;
    const localPublicUrl = `${apiUrl}/uploads/${key}`;
    return { uploadUrl, publicUrl: localPublicUrl, key, expiresInSeconds };
  }
}
