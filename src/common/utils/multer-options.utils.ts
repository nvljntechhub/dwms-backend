import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync, unlink } from 'fs';
import { promisify } from 'util';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import type { Request } from 'express';

const unlinkAsync = promisify(unlink);

export const PROFILE_UPLOAD_DIR = join(process.cwd(), 'public', 'profiles');
export const PROFILE_PUBLIC_PATH = '/public/profiles';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

export const profileImageMulterOptions = {
  storage: diskStorage({
    destination: (
      _req: Request,
      _file: Express.Multer.File,
      cb: (error: Error | null, destination: string) => void,
    ) => {
      if (!existsSync(PROFILE_UPLOAD_DIR)) {
        mkdirSync(PROFILE_UPLOAD_DIR, { recursive: true });
      }
      cb(null, PROFILE_UPLOAD_DIR);
    },
    filename: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void,
    ) => {
      const ext = extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(
        new BadRequestException(
          'Only JPG, JPEG, and PNG images are allowed',
        ),
        false,
      );
    }
    cb(null, true);
  },
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
  },
};

export function buildProfileImageUrl(
  filename: string,
  appUrl: string,
): string {
  return `${appUrl.replace(/\/$/, '')}${PROFILE_PUBLIC_PATH}/${filename}`;
}

/** Extracts the stored filename from a profile image URL, if it is a local upload. */
export function extractProfileImageFilename(
  profileURL?: string | null,
): string | null {
  if (!profileURL) return null;

  const marker = `${PROFILE_PUBLIC_PATH}/`;
  const index = profileURL.lastIndexOf(marker);
  if (index === -1) return null;

  const filename = profileURL.slice(index + marker.length).split('?')[0];
  return filename || null;
}

/** Removes an uploaded profile image from disk (no-op if missing). */
export async function removeProfileImage(
  file?: Express.Multer.File | string | null,
): Promise<void> {
  if (!file) return;

  const filePath =
    typeof file === 'string'
      ? join(PROFILE_UPLOAD_DIR, file)
      : file.path || join(PROFILE_UPLOAD_DIR, file.filename);

  if (!filePath || !existsSync(filePath)) return;

  try {
    await unlinkAsync(filePath);
  } catch {
    // Ignore cleanup failures so they don't mask the original error
  }
}
