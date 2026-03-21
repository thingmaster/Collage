// Canvas rendering for display and export

export function renderCollage(ctx, collage, imageManager, scale, selectedCellId, hoveredCornerId) {
    const w = collage.paperWidth * collage.dpi * scale;
    const h = collage.paperHeight * collage.dpi * scale;

    // White paper background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Draw each cell
    for (const cell of collage.cells) {
        renderCell(ctx, cell, collage.dpi, scale, imageManager, cell.id === selectedCellId);
    }
}

function renderCell(ctx, cell, dpi, scale, imageManager, isSelected) {
    const x = cell.x * dpi * scale;
    const y = cell.y * dpi * scale;
    const w = cell.width * dpi * scale;
    const h = cell.height * dpi * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    if (cell.imageId && imageManager) {
        const imgData = imageManager.get(cell.imageId);
        if (imgData) {
            // Use thumbnail for display (scale < 1), full bitmap for export
            const bitmap = scale < 0.5 ? imgData.thumbnail : imgData.fullBitmap;

            // Source rectangle in image pixels
            const bitmapScale = bitmap === imgData.thumbnail
                ? bitmap.width / imgData.naturalWidth
                : 1;

            const sx = cell.imageOffsetX * bitmapScale;
            const sy = cell.imageOffsetY * bitmapScale;
            const sw = (cell.width * dpi / cell.imageScale) * bitmapScale;
            const sh = (cell.height * dpi / cell.imageScale) * bitmapScale;

            ctx.drawImage(bitmap, sx, sy, sw, sh, x, y, w, h);
        }
    } else {
        // Empty cell placeholder
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#999';
        ctx.font = `${14 * scale * dpi / 10}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No Image', x + w / 2, y + h / 2);
    }

    ctx.restore();

    // Selection highlight
    if (isSelected) {
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = Math.max(2, 3 * scale * dpi / 72);
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }
}

export function renderCornerHandles(ctx, corners, dpi, scale, hoveredCornerIdx) {
    const handleSize = 6;
    for (let i = 0; i < corners.length; i++) {
        const c = corners[i];
        const cx = c.x * dpi * scale;
        const cy = c.y * dpi * scale;

        ctx.fillStyle = i === hoveredCornerIdx ? '#FF5722' : '#2196F3';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.arc(cx, cy, handleSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}
