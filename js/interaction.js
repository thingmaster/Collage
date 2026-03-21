// Mouse/touch interaction handling: corner dragging, cell selection, image panning

import { clamp, dist, pointInRect } from './utils.js';
import { computeDefaultFit } from './collage.js';

const CORNER_HIT_RADIUS = 10; // pixels in display space
const MIN_CELL_INCHES = 0.5;

// States
const IDLE = 'idle';
const DRAGGING_CORNER = 'dragging_corner';
const PANNING_IMAGE = 'panning_image';

export class InteractionManager {
    constructor(collage, imageManager, onChange) {
        this.collage = collage;
        this.imageManager = imageManager;
        this.onChange = onChange; // callback when layout changes
        this.state = IDLE;
        this.selectedCellId = null;
        this.hoveredCornerIdx = -1;

        // Drag state
        this.dragCorner = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragEdges = null;
        this.originalCells = null;

        // Pan state
        this.panStartX = 0;
        this.panStartY = 0;
        this.panOrigOffsetX = 0;
        this.panOrigOffsetY = 0;

        // Display scale info
        this.displayScale = 1;
        this.dpi = 300;
    }

    setDisplayInfo(displayScale, dpi) {
        this.displayScale = displayScale;
        this.dpi = dpi;
    }

    // Convert display pixels to inches
    displayToInches(px) {
        return px / (this.dpi * this.displayScale);
    }

    // Convert inches to display pixels
    inchesToDisplay(inches) {
        return inches * this.dpi * this.displayScale;
    }

    // Find all internal corners (where cell corners coincide)
    findCorners() {
        const cells = this.collage.cells;
        const cornerMap = new Map(); // "x,y" -> { x, y, cellIds: Set }

        const round = (v) => Math.round(v * 10000) / 10000;

        for (const cell of cells) {
            const corners = [
                [cell.x, cell.y],
                [cell.x + cell.width, cell.y],
                [cell.x, cell.y + cell.height],
                [cell.x + cell.width, cell.y + cell.height],
            ];
            for (const [cx, cy] of corners) {
                const key = `${round(cx)},${round(cy)}`;
                if (!cornerMap.has(key)) {
                    cornerMap.set(key, { x: cx, y: cy, cellIds: new Set() });
                }
                cornerMap.get(key).cellIds.add(cell.id);
            }
        }

        // Internal corners are shared by 2+ cells and not on the paper boundary
        const pm = this.collage.perimeterMargin;
        const pw = this.collage.paperWidth;
        const ph = this.collage.paperHeight;

        return Array.from(cornerMap.values()).filter(c => {
            if (c.cellIds.size < 2) return false;
            // Exclude corners on the paper perimeter boundary
            const onLeft = Math.abs(c.x - pm) < 0.001;
            const onRight = Math.abs(c.x - (pw - pm)) < 0.001;
            const onTop = Math.abs(c.y - pm) < 0.001;
            const onBottom = Math.abs(c.y - (ph - pm)) < 0.001;
            // A corner is on the boundary if it's on any two perimeter edges
            // Actually, exclude if on ANY perimeter edge (corners on edges can't be moved in that axis)
            // We'll include all internal corners and handle axis constraints during drag
            return !(onLeft && onTop) && !(onRight && onTop) &&
                   !(onLeft && onBottom) && !(onRight && onBottom);
        });
    }

    // Find edges affected by moving a corner
    findAffectedEdges(corner) {
        const cells = this.collage.cells;
        const cx = corner.x;
        const cy = corner.y;
        const eps = 0.001;

        const pm = this.collage.perimeterMargin;
        const pw = this.collage.paperWidth;
        const ph = this.collage.paperHeight;

        // Check if corner is on paper boundary in x or y
        const onBoundaryX = Math.abs(cx - pm) < eps || Math.abs(cx - (pw - pm)) < eps;
        const onBoundaryY = Math.abs(cy - pm) < eps || Math.abs(cy - (ph - pm)) < eps;

        // Find vertical edge at cx (cells whose left or right edge == cx)
        const verticalEdge = { position: cx, orientation: 'vertical', locked: onBoundaryX, cells: [] };
        // Find horizontal edge at cy
        const horizontalEdge = { position: cy, orientation: 'horizontal', locked: onBoundaryY, cells: [] };

        for (const cell of cells) {
            // Vertical edge: cell's left or right matches cx
            if (Math.abs(cell.x - cx) < eps || Math.abs(cell.x + cell.width - cx) < eps) {
                // Cell must also span the corner's y position
                if (cell.y <= cy + eps && cell.y + cell.height >= cy - eps) {
                    verticalEdge.cells.push({ cell, side: Math.abs(cell.x + cell.width - cx) < eps ? 'right' : 'left' });
                }
            }
            // Horizontal edge
            if (Math.abs(cell.y - cy) < eps || Math.abs(cell.y + cell.height - cy) < eps) {
                if (cell.x <= cx + eps && cell.x + cell.width >= cx - eps) {
                    horizontalEdge.cells.push({ cell, side: Math.abs(cell.y + cell.height - cy) < eps ? 'bottom' : 'top' });
                }
            }
        }

        return { verticalEdge, horizontalEdge };
    }

    onMouseDown(displayX, displayY) {
        const inchX = this.displayToInches(displayX);
        const inchY = this.displayToInches(displayY);

        // Check corners first
        const corners = this.findCorners();
        for (let i = 0; i < corners.length; i++) {
            const c = corners[i];
            const cdx = this.inchesToDisplay(c.x) - displayX;
            const cdy = this.inchesToDisplay(c.y) - displayY;
            if (Math.hypot(cdx, cdy) < CORNER_HIT_RADIUS) {
                this.state = DRAGGING_CORNER;
                this.dragCorner = c;
                this.dragStartX = inchX;
                this.dragStartY = inchY;
                this.dragEdges = this.findAffectedEdges(c);
                // Deep copy cell states for undo/constraint checking
                this.originalCells = this.collage.cells.map(c => ({ ...c }));
                return;
            }
        }

        // Check cell hit
        for (const cell of this.collage.cells) {
            if (pointInRect(inchX, inchY, cell)) {
                if (this.selectedCellId === cell.id) {
                    // Start panning if cell has an image
                    if (cell.imageId) {
                        this.state = PANNING_IMAGE;
                        this.panStartX = displayX;
                        this.panStartY = displayY;
                        this.panOrigOffsetX = cell.imageOffsetX;
                        this.panOrigOffsetY = cell.imageOffsetY;
                    }
                } else {
                    this.selectedCellId = cell.id;
                    this.onChange();
                }
                return;
            }
        }

        // Clicked on empty space
        this.selectedCellId = null;
        this.onChange();
    }

    onMouseMove(displayX, displayY) {
        if (this.state === DRAGGING_CORNER) {
            const inchX = this.displayToInches(displayX);
            const inchY = this.displayToInches(displayY);
            const dx = inchX - this.dragStartX;
            const dy = inchY - this.dragStartY;

            this.applyCornerDrag(dx, dy);
            this.onChange();
            return;
        }

        if (this.state === PANNING_IMAGE) {
            const cell = this.collage.cells.find(c => c.id === this.selectedCellId);
            if (!cell || !cell.imageId) return;

            const ddx = displayX - this.panStartX;
            const ddy = displayY - this.panStartY;

            // Convert display pixel delta to image pixel delta
            const imgPxPerDisplayPx = 1 / (cell.imageScale * this.displayScale);
            cell.imageOffsetX = this.panOrigOffsetX - ddx * imgPxPerDisplayPx;
            cell.imageOffsetY = this.panOrigOffsetY - ddy * imgPxPerDisplayPx;

            // Clamp offset so image covers the cell
            this.clampImageOffset(cell);
            this.onChange();
            return;
        }

        // Update hovered corner
        const corners = this.findCorners();
        let newHovered = -1;
        for (let i = 0; i < corners.length; i++) {
            const c = corners[i];
            const cdx = this.inchesToDisplay(c.x) - displayX;
            const cdy = this.inchesToDisplay(c.y) - displayY;
            if (Math.hypot(cdx, cdy) < CORNER_HIT_RADIUS) {
                newHovered = i;
                break;
            }
        }
        if (newHovered !== this.hoveredCornerIdx) {
            this.hoveredCornerIdx = newHovered;
            this.onChange();
        }
    }

    onMouseUp() {
        if (this.state === DRAGGING_CORNER) {
            // Refit images in affected cells
            this.refitAffectedImages();
        }
        this.state = IDLE;
        this.dragCorner = null;
        this.dragEdges = null;
        this.originalCells = null;
        this.onChange();
    }

    onWheel(displayX, displayY, deltaY) {
        if (!this.selectedCellId) return;
        const cell = this.collage.cells.find(c => c.id === this.selectedCellId);
        if (!cell || !cell.imageId) return;

        const imgData = this.imageManager.get(cell.imageId);
        if (!imgData) return;

        // Scale factor
        const factor = deltaY > 0 ? 0.95 : 1.05;
        const newScale = cell.imageScale * factor;

        // Minimum scale: image must cover the cell
        const cellPxW = cell.width * this.dpi;
        const cellPxH = cell.height * this.dpi;
        const minScale = Math.max(cellPxW / imgData.naturalWidth, cellPxH / imgData.naturalHeight);

        cell.imageScale = Math.max(newScale, minScale);
        this.clampImageOffset(cell);
        this.onChange();
    }

    clampImageOffset(cell) {
        if (!cell.imageId) return;
        const imgData = this.imageManager.get(cell.imageId);
        if (!imgData) return;

        const cellPxW = cell.width * this.dpi;
        const cellPxH = cell.height * this.dpi;
        const visibleW = cellPxW / cell.imageScale;
        const visibleH = cellPxH / cell.imageScale;

        cell.imageOffsetX = clamp(cell.imageOffsetX, 0, imgData.naturalWidth - visibleW);
        cell.imageOffsetY = clamp(cell.imageOffsetY, 0, imgData.naturalHeight - visibleH);
    }

    applyCornerDrag(dx, dy) {
        const { verticalEdge, horizontalEdge } = this.dragEdges;

        // Restore from originals first
        for (const orig of this.originalCells) {
            const cell = this.collage.cells.find(c => c.id === orig.id);
            if (cell) {
                cell.x = orig.x;
                cell.y = orig.y;
                cell.width = orig.width;
                cell.height = orig.height;
            }
        }

        // Apply vertical edge movement (dx)
        if (!verticalEdge.locked && verticalEdge.cells.length > 0) {
            // Clamp dx so no cell gets too small
            let clampedDx = dx;
            for (const { cell, side } of verticalEdge.cells) {
                const orig = this.originalCells.find(c => c.id === cell.id);
                if (side === 'right') {
                    clampedDx = Math.max(clampedDx, MIN_CELL_INCHES - orig.width);
                    clampedDx = Math.min(clampedDx, this.collage.paperWidth - this.collage.perimeterMargin - orig.x - MIN_CELL_INCHES);
                } else {
                    clampedDx = Math.min(clampedDx, orig.width - MIN_CELL_INCHES);
                    clampedDx = Math.max(clampedDx, -(orig.x - this.collage.perimeterMargin - MIN_CELL_INCHES));
                }
            }

            for (const { cell, side } of verticalEdge.cells) {
                const orig = this.originalCells.find(c => c.id === cell.id);
                if (side === 'right') {
                    cell.width = orig.width + clampedDx;
                } else {
                    cell.x = orig.x + clampedDx;
                    cell.width = orig.width - clampedDx;
                }
            }
        }

        // Apply horizontal edge movement (dy)
        if (!horizontalEdge.locked && horizontalEdge.cells.length > 0) {
            let clampedDy = dy;
            for (const { cell, side } of horizontalEdge.cells) {
                const orig = this.originalCells.find(c => c.id === cell.id);
                if (side === 'bottom') {
                    clampedDy = Math.max(clampedDy, MIN_CELL_INCHES - orig.height);
                    clampedDy = Math.min(clampedDy, this.collage.paperHeight - this.collage.perimeterMargin - orig.y - MIN_CELL_INCHES);
                } else {
                    clampedDy = Math.min(clampedDy, orig.height - MIN_CELL_INCHES);
                    clampedDy = Math.max(clampedDy, -(orig.y - this.collage.perimeterMargin - MIN_CELL_INCHES));
                }
            }

            for (const { cell, side } of horizontalEdge.cells) {
                const orig = this.originalCells.find(c => c.id === cell.id);
                if (side === 'bottom') {
                    cell.height = orig.height + clampedDy;
                } else {
                    cell.y = orig.y + clampedDy;
                    cell.height = orig.height - clampedDy;
                }
            }
        }
    }

    refitAffectedImages() {
        if (!this.dragEdges) return;
        const affectedIds = new Set();
        for (const { cell } of this.dragEdges.verticalEdge.cells) affectedIds.add(cell.id);
        for (const { cell } of this.dragEdges.horizontalEdge.cells) affectedIds.add(cell.id);

        for (const cell of this.collage.cells) {
            if (!affectedIds.has(cell.id) || !cell.imageId) continue;
            const imgData = this.imageManager.get(cell.imageId);
            if (!imgData) continue;

            // Ensure image still covers the cell after resize
            const cellPxW = cell.width * this.dpi;
            const cellPxH = cell.height * this.dpi;
            const minScale = Math.max(cellPxW / imgData.naturalWidth, cellPxH / imgData.naturalHeight);
            if (cell.imageScale < minScale) {
                cell.imageScale = minScale;
            }
            this.clampImageOffset(cell);
        }
    }

    getCursorStyle(displayX, displayY) {
        if (this.state === DRAGGING_CORNER) return 'grabbing';
        if (this.state === PANNING_IMAGE) return 'grabbing';

        const corners = this.findCorners();
        for (const c of corners) {
            const cdx = this.inchesToDisplay(c.x) - displayX;
            const cdy = this.inchesToDisplay(c.y) - displayY;
            if (Math.hypot(cdx, cdy) < CORNER_HIT_RADIUS) {
                return 'move';
            }
        }

        const inchX = this.displayToInches(displayX);
        const inchY = this.displayToInches(displayY);
        for (const cell of this.collage.cells) {
            if (pointInRect(inchX, inchY, cell)) {
                if (this.selectedCellId === cell.id && cell.imageId) return 'grab';
                return 'pointer';
            }
        }
        return 'default';
    }
}
