export const MAX_PRIZE_IMAGE_BYTES = 500 * 1024;

/** Keep the original image; verify browser decoding before accepting a local upload. */
export async function readPrizeImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('请选择 PNG、JPG 或 WebP 图片。');
  }
  if (file.size > MAX_PRIZE_IMAGE_BYTES) {
    throw new Error('图片不能超过 500 KB，请先压缩图片后再上传。');
  }
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('图片读取失败，请重新选择。'));
    reader.readAsDataURL(file);
  });
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 20000000) {
        reject(new Error('图片尺寸无效或过大，请选择不超过 2000 万像素的图片。'));
      } else resolve();
    };
    image.onerror = () => reject(new Error('无法识别图片内容，请换一张图片。'));
    image.src = data;
  });
  return data;
}
