import { UploadApiResponse } from 'cloudinary';
import { cloudinary } from '../configs/cloudinary';

export function uploadToCloudinary(buffer: Buffer): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'auto' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result!);
      }
    );
    stream.end(buffer);
  });
}
