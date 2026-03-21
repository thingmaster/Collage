// Core data model

let nextCellId = 0;

export function createCell(x, y, width, height) {
    return {
        id: nextCellId++,
        x, y, width, height,       // in inches
        imageId: null,
        imageOffsetX: 0,            // in image pixels
        imageOffsetY: 0,
        imageScale: 1,
    };
}

export function createCollage(paperWidth, paperHeight, dpi, perimeterMargin, gutterMargin) {
    return {
        paperWidth,
        paperHeight,
        dpi,
        perimeterMargin,
        gutterMargin,
        cells: [],
    };
}

// Compute default "cover" fit for an image in a cell
export function computeDefaultFit(cell, naturalWidth, naturalHeight, dpi) {
    const cellPxW = cell.width * dpi;
    const cellPxH = cell.height * dpi;
    const scale = Math.max(cellPxW / naturalWidth, cellPxH / naturalHeight);
    const offsetX = (naturalWidth * scale - cellPxW) / 2 / scale;
    const offsetY = (naturalHeight * scale - cellPxH) / 2 / scale;
    return { imageScale: scale, imageOffsetX: offsetX, imageOffsetY: offsetY };
}
