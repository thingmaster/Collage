// Image loading and full-resolution storage

const THUMBNAIL_MAX = 2000; // max dimension for display thumbnails

export class ImageManager {
    constructor() {
        this.images = new Map(); // id -> { id, file, fullBitmap, thumbnail, naturalWidth, naturalHeight }
    }

    async loadFiles(fileList) {
        const promises = Array.from(fileList).map(async (file) => {
            const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const fullBitmap = await createImageBitmap(file);
            const { width: nw, height: nh } = fullBitmap;

            // Create thumbnail
            let thumbnail;
            if (Math.max(nw, nh) > THUMBNAIL_MAX) {
                const scale = THUMBNAIL_MAX / Math.max(nw, nh);
                thumbnail = await createImageBitmap(file, {
                    resizeWidth: Math.round(nw * scale),
                    resizeHeight: Math.round(nh * scale),
                    resizeQuality: 'medium',
                });
            } else {
                thumbnail = fullBitmap;
            }

            this.images.set(id, {
                id,
                file,
                fullBitmap,
                thumbnail,
                naturalWidth: nw,
                naturalHeight: nh,
            });
            return id;
        });
        return Promise.all(promises);
    }

    get(id) {
        return this.images.get(id);
    }

    getIds() {
        return Array.from(this.images.keys());
    }

    count() {
        return this.images.size;
    }

    clear() {
        for (const img of this.images.values()) {
            img.fullBitmap.close();
            if (img.thumbnail !== img.fullBitmap) img.thumbnail.close();
        }
        this.images.clear();
    }
}
