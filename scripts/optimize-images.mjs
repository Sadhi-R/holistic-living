import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = 'E:/10x Wealth Creator/Projects/holistic_living';
const outDir = path.resolve('public/images');
fs.mkdirSync(outDir, { recursive: true });

const jobs = [
  ['offline-posters/assets/photo-inner-peace.jpg', 'peace.webp', 1400],
  ['offline-posters/assets/photo-inner-life.jpg', 'inner-life.webp', 1200],
  ['offline-posters/assets/photo-mindset.jpg', 'mindset.webp', 1200],
  ['offline-posters/assets/photo-growth-journey.jpg', 'path.webp', 1200],
  ['reminders/assets/garden.jpg', 'garden.webp', 1400],
  ['reminders/assets/yoga-hall.jpg', 'hall.webp', 1400],
  ['reminders/assets/zoom-evening.jpg', 'evening.webp', 1400],
  ['reminders/assets/still-flowers.jpg', 'flowers.webp', 1200],
  ['Mentor_Images/Sampath_Kumar_image 1.jpeg', 'sampath.webp', 900],
  ['Ads/cutouts/mentor-blazer.png', 'sampath-blazer.webp', 900],
];

for (const [src, name, width] of jobs) {
  const input = path.join(root, src);
  const image = sharp(input).rotate();
  const meta = await image.metadata();
  const file = path.join(outDir, name);
  await sharp(input)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(file);
  const after = await sharp(file).metadata();
  console.log(`${name} ${after.width}x${after.height} from ${meta.width}x${meta.height} alpha=${meta.hasAlpha}`);
}
