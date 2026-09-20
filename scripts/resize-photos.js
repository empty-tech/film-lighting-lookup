// Resizes photos/*.{jpg,jpeg,png,webp} to ~1000px wide (never upscales) and
// writes them into pwa/photos/, which is what actually ships with the PWA.
// Re-run after adding/changing source photos; existing output is overwritten.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { PHOTOS_DIR, PWA_PHOTOS_DIR } from './lib/db.js';

const TARGET_WIDTH = 1000;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function resizeOne(file) {
    const src = path.join(PHOTOS_DIR, file);
    const dest = path.join(PWA_PHOTOS_DIR, file);
    const ext = path.extname(file).toLowerCase();

    const image = sharp(src);
    const meta = await image.metadata();

    let pipeline = image;
    if (meta.width && meta.width > TARGET_WIDTH) {
        pipeline = pipeline.resize({ width: TARGET_WIDTH });
    }

    if (ext === '.jpg' || ext === '.jpeg') {
        pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
    } else if (ext === '.png') {
        pipeline = pipeline.png({ compressionLevel: 9 });
    } else if (ext === '.webp') {
        pipeline = pipeline.webp({ quality: 82 });
    }

    await pipeline.toFile(dest);
    return { file, srcWidth: meta.width, resized: meta.width > TARGET_WIDTH };
}

async function main() {
    if (!fs.existsSync(PHOTOS_DIR)) {
        console.error(`Photos directory not found: ${PHOTOS_DIR}`);
        process.exit(1);
    }
    fs.mkdirSync(PWA_PHOTOS_DIR, { recursive: true });

    const files = fs
        .readdirSync(PHOTOS_DIR)
        .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()));
    const fileSet = new Set(files);

    let resizedCount = 0;
    let copiedCount = 0;
    for (const file of files) {
        const result = await resizeOne(file);
        if (result.resized) resizedCount++;
        else copiedCount++;
    }

    // Remove stale output for source photos that were deleted or renamed.
    const existingOutput = fs.readdirSync(PWA_PHOTOS_DIR);
    let prunedCount = 0;
    for (const file of existingOutput) {
        if (!fileSet.has(file)) {
            fs.unlinkSync(path.join(PWA_PHOTOS_DIR, file));
            prunedCount++;
        }
    }

    console.log(
        `Processed ${files.length} photo(s) into pwa/photos/ (${resizedCount} resized to ${TARGET_WIDTH}px, ${copiedCount} already narrower${prunedCount ? `, ${prunedCount} stale file(s) pruned` : ''}).`
    );
}

main();
