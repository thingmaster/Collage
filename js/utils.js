// Coordinate conversion utilities

export function inchesToPx(inches, dpi) {
    return inches * dpi;
}

export function pxToInches(px, dpi) {
    return px / dpi;
}

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Distance between two points
export function dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}

// Check if point is inside rectangle {x, y, width, height}
export function pointInRect(px, py, rect) {
    return px >= rect.x && px <= rect.x + rect.width &&
           py >= rect.y && py <= rect.y + rect.height;
}

// Generate a random number in [min, max]
export function randRange(min, max) {
    return min + Math.random() * (max - min);
}
