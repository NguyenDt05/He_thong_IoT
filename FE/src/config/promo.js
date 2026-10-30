// Cấu hình quảng cáo hiển thị sau lần đăng nhập đầu tiên.
// Đổi "enabled" thành false để tắt nhanh; thay "images" bằng ảnh trong FE/public.
export const PROMO_CONFIG = {
  enabled: true,
  showOnce: true,
  storageKey: "iot-promo-seen-v1",
  autoPlayMs: 6000,

  images: [
    {
      src: "/add1.png",
      alt: "Giới thiệu hệ thống IoT",
    },
    {
      src: "/1793263791489_2140762297025083066_7121174342546403292_6be5da864fb2deef991e1d9ea2930b12.jpg",
      alt: "Ứng dụng điều khiển thiết bị IoT",
    },
  ],
};
