// Cấu hình chế độ "ẩn" vui nhộn.
// Giai đoạn 1: một chú mèo rơi xuống giữa màn hình và quay tại chỗ.
// Sau discoDelayMs: đèn disco bật, giao diện loạn, gấu ở 4 góc và nhân vật bay khắp nơi.
export const PARTY_CONFIG = {
  enabled: true,
  chaos: 3,
  discoDelayMs: 3200,

  // File mèo nằm trong FE/public/video.
  catVideo: "/video/cat-spin.webm",

  // Video gấu (đã cắt viền đen) xuất hiện ở bốn góc khi đèn disco bật.
  bearVideo: "/video/bear-dance-cropped.mp4",

  // Bộ ảnh nhân vật nằm trong FE/public/icon.
  characterCount: 10,
  characters: [
    "/icon/1-removebg-preview.png",
    "/icon/3-removebg-preview.png",
    "/icon/33ce112e-84ba-4ac3-9f59-48fb6b8a7fbc-removebg-preview.png",
    "/icon/4-removebg-preview.png",
    "/icon/6-removebg-preview.png",
    "/icon/8-removebg-preview.png",
    "/icon/ggg-removebg-preview.png",
  ],
};
