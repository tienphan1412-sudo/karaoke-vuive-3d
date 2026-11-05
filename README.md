# KTV Lung Linh 3D

Game 3D online chơi trên trình duyệt (máy tính + điện thoại). Người chơi hóa thân thành bé xinh của quán karaoke, phục vụ khách theo yêu cầu, gom tiền bo và nâng cấp quán.

## Có gì trong game
- **Nhân vật 3D chuẩn anime** (model VRM của VRoid): tóc và váy có vật lý đung đưa, mặt có biểu cảm (chớp mắt, cười khi nhảy, há miệng khi hát).
- **8 bộ đồ hiện đại**, tự may theo dáng người:
  - Lộng lẫy: đầm dạ hội cúp ngực xẻ tà, đầm xòe trễ vai, đầm đuôi cá
  - Gợi cảm: đầm body cúp ngực, áo ống + váy xếp ly ngắn
  - Ngoan hiền: váy babydoll tay phồng, blazer cổ V + chân váy bút chì, đồ thường ngày (gốc)
- **Chất vải:** kim sa lấp lánh, lụa satin, nhũ kim loại, da bóng, nhung. 14 màu.
- **Tất:** tất da đen, tất lưới, tất đùi trắng. Giày bóng 6 màu.
- **Makeup vẽ thẳng lên da mặt:** phấn mắt (màu + độ đậm), kẻ mắt mèo / smoky, màu lens, son (màu, độ đậm, bóng/lì), má hồng.
- **Tóc:** nhuộm 11 màu (trắng bạch kim, vàng, hồng, tím...).
- **Phụ kiện:** bông tai pha lê/ngọc trai/khoen, dây chuyền kim cương/ngọc trai/choker, vương miện, tai cáo, tai mèo, nơ.
- **6 kiểu khách** (giữ phong cách hài hước), mỗi khách có gu riêng. Mặc đúng gu được bo x1.5.
- **8 yêu cầu:** chọn bài, rót bia, cụng ly Dzô, song ca, nhảy, nói chuyện, mang trái cây, mang nước chanh.
- **Quỹ quán:** 30% tiền bo dồn vào quỹ chung để mua đèn disco, loa xịn, sofa da, mở phòng VIP.
- Chat, bảng xếp hạng, emote, joystick trên điện thoại.

## Thêm gương mặt / kiểu tóc mới bằng VRoid Studio (miễn phí)
1. Tải VRoid Studio (vroid.com/studio), tạo nhân vật: chỉnh mặt, mắt, kiểu tóc, dáng người.
2. Bấm **Xuất ra VRM** (Export → VRM). Nên chọn giảm texture xuống 1024 để file nhẹ.
3. Đặt file vào thư mục `public/models/`, ví dụ `public/models/be-hong.vrm`.
4. Mở `public/js/data.js`, thêm 1 dòng vào `BASES`:
   `{ id: 'behong', name: 'Bé Hồng', file: '/models/be-hong.vrm' },`
5. Trong game, vào **Tủ đồ → Dáng người → Gương mặt & kiểu tóc** để chọn.

Trang phục, makeup và phụ kiện tự áp dụng lên model mới. Model mẫu đi kèm là "VRM1 Constraint Twist Sample" của pixiv Inc. (giấy phép VRM Public License 1.0: cho phép dùng thương mại và chỉnh sửa).

## Nhạc nền (không lo bản quyền)
Game có sẵn nhạc **tự tạo bằng code** cho từng khu: sảnh (remix), Phòng 101 (bolero), Phòng 102 (K-pop), Phòng 103 (lofi), VIP (remix). Đi vào phòng nào nghe nhạc phòng đó. Nút 🔊 trên góc phải để bật/tắt.

Muốn nhạc hay hơn thì thay bằng file mp3 **miễn phí bản quyền**:
1. Vào **pixabay.com/music** (không cần ghi nguồn, được dùng trong game và video). Tìm theo từ khóa: `edm party`, `club house`, `kpop`, `lofi chill`, `acoustic guitar slow`, `latin romantic`.
   Nguồn khác: **YouTube Studio → Thư viện âm thanh** (lọc "Không cần ghi công").
2. Tải về, đổi tên đúng như sau rồi bỏ vào thư mục `public/music/`:
   - `sanh.mp3`: sảnh
   - `phong101.mp3`, `phong102.mp3`, `phong103.mp3`: 3 phòng thường
   - `vip.mp3`: phòng VIP
3. Upload lên GitHub (vào thư mục `public/music`, bấm Add file → Upload files). Render tự cập nhật sau vài phút.

Thiếu file nào thì khu đó vẫn phát nhạc tự tạo. Mỗi file nên dưới 5MB.

**Không dùng bài hát của ca sĩ** (tải từ YouTube, Zing, Spotify…): game đưa lên mạng công khai nên vi phạm bản quyền, và clip quay game đăng TikTok/YouTube dễ bị tắt tiếng hoặc gỡ.

## Đưa lên mạng (giống game đi chùa)
1. Vào GitHub → **New repository** → đặt tên `ktv-lung-linh-3d` → Create.
2. Bấm **uploading an existing file** → kéo thả **toàn bộ file và thư mục** trong file zip (không có `node_modules`) → Commit.
3. Vào Render → **New + → Web Service** → chọn repo `ktv-lung-linh-3d`.
4. Điền: Runtime **Node**, Build Command `npm install`, Start Command `npm start`, Instance Type **Free**, Region **Singapore**.
5. Bấm **Deploy**, đợi vài phút → mở link `https://ktv-lung-linh-3d.onrender.com` (tên có thể khác) → gửi link cho bạn bè vào chơi chung.

Lưu ý: Render free sẽ "ngủ" khi không ai chơi, lần đầu mở mất khoảng 30-60 giây. Tiền bo và quỹ quán chỉ lưu trong lúc server đang chạy. Server ngủ dậy thì quỹ quán về 0. Ngoại hình nhân vật được lưu trên máy của từng người.

## Chạy thử trên máy
```
npm install
npm start
```
Mở http://localhost:3000

## Cấu trúc
- `server.js`: server online (khách, yêu cầu, tiền bo, quỹ quán, chat)
- `public/js/avatar.js`: tải model VRM, may trang phục theo dáng người, vẽ makeup, phụ kiện, hoạt ảnh
- `public/js/character.js`: dựng khách hàng nam (phong cách hài)
- `public/models/`: các file model .vrm
- `public/js/world.js`: quán karaoke (sảnh, 4 phòng, quầy bar, phòng thay đồ)
- `public/js/minigames.js`: các mini-game phục vụ khách
- `public/js/data.js`: danh sách đồ, màu, khách, câu thoại (sửa ở đây để thêm nội dung)
- `public/js/main.js`: điều khiển, camera, giao diện, kết nối mạng
