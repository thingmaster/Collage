// Binary Space Partitioning layout algorithm

import { createCell } from './collage.js';
import { clamp, randRange } from './utils.js';

const MIN_CELL_SIZE = 0.75; // inches

export function generateLayout(paperWidth, paperHeight, perimeterMargin, gutterMargin, numPhotos) {
    const usable = {
        x: perimeterMargin,
        y: perimeterMargin,
        width: paperWidth - 2 * perimeterMargin,
        height: paperHeight - 2 * perimeterMargin,
    };
    const rects = bspSplit(usable, numPhotos, gutterMargin);
    return rects.map(r => createCell(r.x, r.y, r.width, r.height));
}

function bspSplit(bounds, n, gutter) {
    if (n <= 0) return [];
    if (n === 1) {
        return [{ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }];
    }

    // Choose split direction - prefer splitting the longer axis
    const splitHorizontally = bounds.width > bounds.height
        ? Math.random() < 0.8
        : Math.random() < 0.2;

    // How many cells go to the first partition
    const nLeft = clamp(Math.round(randRange(0.3, 0.7) * n), 1, n - 1);
    const nRight = n - nLeft;

    // Split position with jitter
    let ratio = (nLeft / n) + randRange(-0.1, 0.1);
    ratio = clamp(ratio, 0.25, 0.75);

    const halfGutter = gutter / 2;

    if (splitHorizontally) {
        const splitX = bounds.x + bounds.width * ratio;
        const leftW = splitX - bounds.x - halfGutter;
        const rightW = (bounds.x + bounds.width) - splitX - halfGutter;

        if (leftW < MIN_CELL_SIZE || rightW < MIN_CELL_SIZE) {
            // Fall back to equal split
            const eqSplit = bounds.x + bounds.width / 2;
            const lw = eqSplit - bounds.x - halfGutter;
            const rw = (bounds.x + bounds.width) - eqSplit - halfGutter;
            return [
                ...bspSplit({ x: bounds.x, y: bounds.y, width: lw, height: bounds.height }, nLeft, gutter),
                ...bspSplit({ x: eqSplit + halfGutter, y: bounds.y, width: rw, height: bounds.height }, nRight, gutter),
            ];
        }

        return [
            ...bspSplit({ x: bounds.x, y: bounds.y, width: leftW, height: bounds.height }, nLeft, gutter),
            ...bspSplit({ x: splitX + halfGutter, y: bounds.y, width: rightW, height: bounds.height }, nRight, gutter),
        ];
    } else {
        const splitY = bounds.y + bounds.height * ratio;
        const topH = splitY - bounds.y - halfGutter;
        const bottomH = (bounds.y + bounds.height) - splitY - halfGutter;

        if (topH < MIN_CELL_SIZE || bottomH < MIN_CELL_SIZE) {
            const eqSplit = bounds.y + bounds.height / 2;
            const th = eqSplit - bounds.y - halfGutter;
            const bh = (bounds.y + bounds.height) - eqSplit - halfGutter;
            return [
                ...bspSplit({ x: bounds.x, y: bounds.y, width: bounds.width, height: th }, nLeft, gutter),
                ...bspSplit({ x: bounds.x, y: eqSplit + halfGutter, width: bounds.width, height: bh }, nRight, gutter),
            ];
        }

        return [
            ...bspSplit({ x: bounds.x, y: bounds.y, width: bounds.width, height: topH }, nLeft, gutter),
            ...bspSplit({ x: bounds.x, y: splitY + halfGutter, width: bounds.width, height: bottomH }, nRight, gutter),
        ];
    }
}
