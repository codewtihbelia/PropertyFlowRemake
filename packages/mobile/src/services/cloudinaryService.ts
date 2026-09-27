/**
 * Cloudinary Upload Service for Mobile (Expo / React Native)
 */
export interface CloudinaryMobileUploadOptions {
  uri: string;
  base64?: string | null;
  mimeType?: string;
}

export async function uploadImageToCloudinaryMobile(
  options: CloudinaryMobileUploadOptions | string
): Promise<string> {
  const opt: CloudinaryMobileUploadOptions =
    typeof options === 'string' ? { uri: options } : options;

  const cloudName =
    process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'ri4xxxwk';
  const uploadPreset =
    process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'splitzy';

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary cloud name or upload preset is not configured.');
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const formData = new FormData();
  formData.append('upload_preset', uploadPreset);

  if (opt.base64) {
    const mime = opt.mimeType || 'image/jpeg';
    formData.append('file', `data:${mime};base64,${opt.base64}`);
  } else {
    const filename = opt.uri.split('/').pop() || 'profile.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    formData.append('file', {
      uri: opt.uri,
      name: filename,
      type,
    } as any);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Cloudinary Mobile] Upload error:', errorText);
    throw new Error(`Failed to upload to Cloudinary: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.secure_url) {
    throw new Error('Cloudinary did not return a secure_url.');
  }

  return data.secure_url;
}

export const uploadImageToCloudinary = uploadImageToCloudinaryMobile;
export default uploadImageToCloudinaryMobile;
