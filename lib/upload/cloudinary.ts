import { v2 as cloudinary } from 'cloudinary';

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { isCloudinaryConfigured };

/**
 * Uploads an image buffer or base64 data string to Cloudinary.
 * If Cloudinary credentials are not configured, returns the data URL directly as a safe fallback.
 */
export async function uploadMedicalImage(
  imageInput: Buffer | string,
  folder = 'fundus-scans',
  filename?: string
): Promise<string> {
  // If Cloudinary is not configured in .env, gracefully fallback to data URL
  if (!isCloudinaryConfigured) {
    if (typeof imageInput === 'string' && imageInput.startsWith('data:')) {
      return imageInput;
    }
    if (Buffer.isBuffer(imageInput)) {
      const base64 = imageInput.toString('base64');
      const isPng = imageInput.length > 8 && imageInput[0] === 0x89 && imageInput[1] === 0x50;
      const mime = isPng ? 'image/png' : 'image/jpeg';
      return `data:${mime};base64,${base64}`;
    }
    return typeof imageInput === 'string' ? imageInput : '';
  }

  // Upload to Cloudinary using upload_stream or base64 upload
  try {
    return await new Promise<string>((resolve, reject) => {
      const uploadOptions: Record<string, any> = {
        folder: `netrika/${folder}`,
        resource_type: 'image',
        overwrite: true,
      };

      if (filename) {
        uploadOptions.public_id = filename.replace(/\.[^/.]+$/, '');
      }

      if (typeof imageInput === 'string') {
        cloudinary.uploader.upload(imageInput, uploadOptions, (error, result) => {
          if (error) {
            console.error('Cloudinary upload error (string):', error);
            // Fallback to input string if upload fails
            resolve(imageInput);
          } else if (result?.secure_url) {
            resolve(result.secure_url);
          } else {
            resolve(imageInput);
          }
        });
      } else {
        const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
          if (error) {
            console.error('Cloudinary upload stream error:', error);
            const base64 = imageInput.toString('base64');
            resolve(`data:image/jpeg;base64,${base64}`);
          } else if (result?.secure_url) {
            resolve(result.secure_url);
          } else {
            const base64 = imageInput.toString('base64');
            resolve(`data:image/jpeg;base64,${base64}`);
          }
        });

        stream.end(imageInput);
      }
    });
  } catch (error) {
    console.error('Failed to upload image to Cloudinary, using fallback:', error);
    if (Buffer.isBuffer(imageInput)) {
      return `data:image/jpeg;base64,${imageInput.toString('base64')}`;
    }
    return typeof imageInput === 'string' ? imageInput : '';
  }
}
