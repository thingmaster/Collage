// High-resolution JPEG export

import { renderCollage } from './renderer.js';

export async function exportCollage(collage, imageManager) {
    const outputW = Math.round(collage.paperWidth * collage.dpi);
    const outputH = Math.round(collage.paperHeight * collage.dpi);

    // Use OffscreenCanvas for export
    const canvas = new OffscreenCanvas(outputW, outputH);
    const ctx = canvas.getContext('2d');

    // Render at full resolution (scale = 1.0)
    renderCollage(ctx, collage, imageManager, 1.0, null, -1);

    // Export as JPEG at highest quality
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 1.0 });

    // Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collage_${collage.paperWidth}x${collage.paperHeight}_${collage.dpi}dpi.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { width: outputW, height: outputH, sizeMB: (blob.size / 1024 / 1024).toFixed(1) };
}
