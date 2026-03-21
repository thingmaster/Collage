// Main application - wires UI to engine

import { createCollage, computeDefaultFit } from './collage.js';
import { generateLayout } from './layout.js';
import { ImageManager } from './image-manager.js';
import { renderCollage, renderCornerHandles } from './renderer.js';
import { InteractionManager } from './interaction.js';
import { exportCollage } from './export.js';

let collage = null;
let imageManager = new ImageManager();
let interaction = null;
let canvas, ctx;
let displayScale = 1;
let animFrameId = null;
let dirty = true;

// DOM elements
let fileInput, paperSelect, customDims, paperWidthInput, paperHeightInput;
let dpiInput, perimeterInput, gutterInput;
let generateBtn, randomizeBtn, exportBtn;
let statusBar, cellInfo, scaleSlider, scaleValue, resetCropBtn;

function init() {
    canvas = document.getElementById('collage-canvas');
    ctx = canvas.getContext('2d');

    fileInput = document.getElementById('file-input');
    paperSelect = document.getElementById('paper-size');
    customDims = document.getElementById('custom-dims');
    paperWidthInput = document.getElementById('paper-width');
    paperHeightInput = document.getElementById('paper-height');
    dpiInput = document.getElementById('dpi');
    perimeterInput = document.getElementById('perimeter-margin');
    gutterInput = document.getElementById('gutter-margin');
    generateBtn = document.getElementById('generate-btn');
    randomizeBtn = document.getElementById('randomize-btn');
    exportBtn = document.getElementById('export-btn');
    statusBar = document.getElementById('status-bar');
    cellInfo = document.getElementById('cell-info');
    scaleSlider = document.getElementById('scale-slider');
    scaleValue = document.getElementById('scale-value');
    resetCropBtn = document.getElementById('reset-crop-btn');

    // Event listeners
    fileInput.addEventListener('change', onFilesSelected);
    paperSelect.addEventListener('change', onPaperChange);
    generateBtn.addEventListener('click', onGenerate);
    randomizeBtn.addEventListener('click', onRandomize);
    exportBtn.addEventListener('click', onExport);
    scaleSlider.addEventListener('input', onScaleSlider);
    resetCropBtn.addEventListener('click', onResetCrop);

    // Canvas events
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseup', onCanvasMouseUp);
    canvas.addEventListener('mouseleave', onCanvasMouseUp);
    canvas.addEventListener('wheel', onCanvasWheel, { passive: false });

    // Resize handling
    const resizeObserver = new ResizeObserver(() => { dirty = true; });
    resizeObserver.observe(canvas.parentElement);
    window.addEventListener('resize', () => { dirty = true; });

    onPaperChange();
    updateStatus('Load photos and click Generate Layout to begin.');
    requestAnimationFrame(renderLoop);
}

function getPaperDimensions() {
    const val = paperSelect.value;
    if (val === 'custom') {
        return [parseFloat(paperWidthInput.value) || 11, parseFloat(paperHeightInput.value) || 14];
    }
    const [w, h] = val.split('x').map(Number);
    return [w, h];
}

function onPaperChange() {
    customDims.style.display = paperSelect.value === 'custom' ? 'flex' : 'none';
}

async function onFilesSelected(e) {
    const files = e.target.files;
    if (!files.length) return;

    updateStatus(`Loading ${files.length} photo(s)...`);
    try {
        await imageManager.loadFiles(files);
        updateStatus(`${imageManager.count()} photo(s) loaded. Click Generate Layout.`);
        generateBtn.disabled = false;
    } catch (err) {
        updateStatus(`Error loading photos: ${err.message}`);
    }
}

function onGenerate() {
    if (imageManager.count() === 0) {
        updateStatus('Please load photos first.');
        return;
    }
    buildCollage();
}

function onRandomize() {
    if (!collage || imageManager.count() === 0) return;
    buildCollage();
}

function buildCollage() {
    const [pw, ph] = getPaperDimensions();
    const dpi = parseInt(dpiInput.value) || 300;
    const pm = parseFloat(perimeterInput.value) || 0.25;
    const gm = parseFloat(gutterInput.value) || 0.125;
    const numPhotos = imageManager.count();

    collage = createCollage(pw, ph, dpi, pm, gm);
    collage.cells = generateLayout(pw, ph, pm, gm, numPhotos);

    // Assign images to cells with aspect-ratio matching
    assignImages();

    // Create interaction manager
    interaction = new InteractionManager(collage, imageManager, () => { dirty = true; });

    randomizeBtn.disabled = false;
    exportBtn.disabled = false;
    dirty = true;
    updateStatus(`Layout: ${numPhotos} photos on ${pw}"×${ph}" at ${dpi} DPI`);
}

function assignImages() {
    const ids = imageManager.getIds();
    const cells = collage.cells;

    // Sort both by aspect ratio for better fit
    const cellAspects = cells.map((c, i) => ({ idx: i, aspect: c.width / c.height }));
    const imgAspects = ids.map(id => {
        const img = imageManager.get(id);
        return { id, aspect: img.naturalWidth / img.naturalHeight };
    });

    cellAspects.sort((a, b) => a.aspect - b.aspect);
    imgAspects.sort((a, b) => a.aspect - b.aspect);

    for (let i = 0; i < cells.length && i < imgAspects.length; i++) {
        const cell = cells[cellAspects[i].idx];
        const imgId = imgAspects[i].id;
        const imgData = imageManager.get(imgId);

        cell.imageId = imgId;
        const fit = computeDefaultFit(cell, imgData.naturalWidth, imgData.naturalHeight, collage.dpi);
        cell.imageScale = fit.imageScale;
        cell.imageOffsetX = fit.imageOffsetX;
        cell.imageOffsetY = fit.imageOffsetY;
    }
}

async function onExport() {
    if (!collage) return;
    updateStatus('Exporting high-resolution JPEG...');
    exportBtn.disabled = true;
    try {
        const info = await exportCollage(collage, imageManager);
        updateStatus(`Exported: ${info.width}×${info.height}px (${info.sizeMB} MB)`);
    } catch (err) {
        updateStatus(`Export error: ${err.message}`);
    }
    exportBtn.disabled = false;
}

function onScaleSlider() {
    if (!interaction || interaction.selectedCellId === null) return;
    const cell = collage.cells.find(c => c.id === interaction.selectedCellId);
    if (!cell || !cell.imageId) return;

    const imgData = imageManager.get(cell.imageId);
    if (!imgData) return;

    const cellPxW = cell.width * collage.dpi;
    const cellPxH = cell.height * collage.dpi;
    const minScale = Math.max(cellPxW / imgData.naturalWidth, cellPxH / imgData.naturalHeight);
    const maxScale = minScale * 5;

    const t = scaleSlider.value / 100;
    cell.imageScale = minScale + t * (maxScale - minScale);
    interaction.clampImageOffset(cell);
    dirty = true;
}

function onResetCrop() {
    if (!interaction || interaction.selectedCellId === null) return;
    const cell = collage.cells.find(c => c.id === interaction.selectedCellId);
    if (!cell || !cell.imageId) return;

    const imgData = imageManager.get(cell.imageId);
    if (!imgData) return;

    const fit = computeDefaultFit(cell, imgData.naturalWidth, imgData.naturalHeight, collage.dpi);
    cell.imageScale = fit.imageScale;
    cell.imageOffsetX = fit.imageOffsetX;
    cell.imageOffsetY = fit.imageOffsetY;
    dirty = true;
}

// Canvas event handlers
function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
}

function onCanvasMouseDown(e) {
    if (!interaction) return;
    const [x, y] = getCanvasCoords(e);
    interaction.onMouseDown(x, y);
}

function onCanvasMouseMove(e) {
    if (!interaction) return;
    const [x, y] = getCanvasCoords(e);
    interaction.onMouseMove(x, y);
    canvas.style.cursor = interaction.getCursorStyle(x, y);
    updateCellInfo();
}

function onCanvasMouseUp(e) {
    if (!interaction) return;
    interaction.onMouseUp();
    updateCellInfo();
}

function onCanvasWheel(e) {
    if (!interaction) return;
    e.preventDefault();
    const [x, y] = getCanvasCoords(e);
    interaction.onWheel(x, y, e.deltaY);
}

function updateCellInfo() {
    if (!interaction || interaction.selectedCellId === null) {
        cellInfo.innerHTML = '<p class="hint">Click a cell to select it. Drag corners to resize.</p>';
        scaleSlider.disabled = true;
        resetCropBtn.disabled = true;
        return;
    }

    const cell = collage.cells.find(c => c.id === interaction.selectedCellId);
    if (!cell) return;

    const w = cell.width.toFixed(2);
    const h = cell.height.toFixed(2);
    let html = `<p><strong>Cell ${cell.id}</strong>: ${w}" × ${h}"</p>`;

    if (cell.imageId) {
        const img = imageManager.get(cell.imageId);
        html += `<p>Image: ${img.naturalWidth}×${img.naturalHeight}px</p>`;
        html += `<p>Scale: ${(cell.imageScale * 100).toFixed(0)}%</p>`;
        html += `<p class="hint">Drag to pan, scroll to zoom</p>`;
        scaleSlider.disabled = false;
        resetCropBtn.disabled = false;

        // Update slider position
        const cellPxW = cell.width * collage.dpi;
        const cellPxH = cell.height * collage.dpi;
        const minScale = Math.max(cellPxW / img.naturalWidth, cellPxH / img.naturalHeight);
        const maxScale = minScale * 5;
        const t = (cell.imageScale - minScale) / (maxScale - minScale);
        scaleSlider.value = Math.round(t * 100);
    } else {
        html += '<p class="hint">No image assigned</p>';
        scaleSlider.disabled = true;
        resetCropBtn.disabled = true;
    }

    cellInfo.innerHTML = html;
}

function renderLoop() {
    if (dirty && collage) {
        dirty = false;
        resizeCanvas();
        renderCollage(ctx, collage, imageManager, displayScale,
            interaction?.selectedCellId ?? null, interaction?.hoveredCornerIdx ?? -1);

        if (interaction) {
            const corners = interaction.findCorners();
            renderCornerHandles(ctx, corners, collage.dpi, displayScale, interaction.hoveredCornerIdx);
            interaction.setDisplayInfo(displayScale, collage.dpi);
        }
    }
    animFrameId = requestAnimationFrame(renderLoop);
}

function resizeCanvas() {
    const container = canvas.parentElement;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    const paperPxW = collage.paperWidth * collage.dpi;
    const paperPxH = collage.paperHeight * collage.dpi;

    // Fit paper into container
    displayScale = Math.min(cw / paperPxW, ch / paperPxH);

    const displayW = paperPxW * displayScale;
    const displayH = paperPxH * displayScale;

    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    canvas.style.width = displayW + 'px';
    canvas.style.height = displayH + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function updateStatus(msg) {
    statusBar.textContent = msg;
}

document.addEventListener('DOMContentLoaded', init);
