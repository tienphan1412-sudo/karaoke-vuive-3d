// Công tắc tính năng: đổi true/false rồi upload file này lên là bật/tắt tính năng trong game.
module.exports = {
  // --- Đợt 1 + 2 + 3 + 4 (đang mở) ---
  shop: true,          // 🛍 Shop mua quần áo, phụ kiện, trang điểm bằng tiền bo
  levels: true,        // 👑 Cấp bậc: Tập sự → Nhân viên → Hoa khôi → Má mì
  quests: true,        // 📋 3 nhiệm vụ mỗi ngày
  ghen: true,          // 😱 Vợ khách tới đánh ghen
  // --- Đợt 3 (mở 9/11) ---
  flee: true,          // 🏃 Khách quỵt tiền, chạy theo nắm áo
  newCustomers: true,  // 🧑‍🤝‍🧑 Bác Bảo Vệ, Chàng Thất Tình, Nhóm liên hoan công ty
  // --- Đợt 4 (mở 9/11) ---
  police: true,        // 🚔 Công an phường kiểm tra
  blackout: true,      // ⚡ Cúp điện
  karaoke: true,       // 🎤 Máy chấm điểm karaoke
  // --- Đợt 5 ---
  duet: false,         // 🎤 Song ca giữa 2 người chơi
  gift: false,         // 🎁 Tặng quà cho nhau
  shift: false,        // 🏁 Ca làm 10 phút + tổng kết danh hiệu
};
