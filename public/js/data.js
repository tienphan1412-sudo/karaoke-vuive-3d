// Dữ liệu dùng chung cho client

export const STYLE_NAMES = { longlay: 'Lộng lẫy', goicam: 'Gợi cảm', ngoanhien: 'Ngoan hiền' };

// Model nhân vật (VRM từ VRoid Studio). Thêm model mới: bỏ file .vrm vào public/models rồi thêm 1 dòng ở đây.
export const BASES = [
  { id: 'base', name: 'Bé Xinh (mẫu pixiv)', file: '/models/base.vrm' },
];

export const OUTFITS = [
  { id: 'xetaa', name: 'Đầm dạ hội cúp ngực xẻ tà', style: 'longlay', finish: 'sequin' },
  { id: 'xoe', name: 'Đầm xòe trễ vai', style: 'longlay', finish: 'satin' },
  { id: 'mermaid', name: 'Đầm đuôi cá cúp ngực', style: 'longlay', finish: 'metal' },
  { id: 'body', name: 'Đầm body cúp ngực', style: 'goicam', finish: 'latex' },
  { id: 'crop', name: 'Áo ống + váy xếp ly ngắn', style: 'goicam', finish: 'satin' },
  { id: 'babydoll', name: 'Váy babydoll tay phồng', style: 'ngoanhien', finish: 'satin' },
  { id: 'blazer', name: 'Blazer + chân váy bút chì', style: 'ngoanhien', finish: 'velvet' },
  { id: 'casual', name: 'Áo phông + quần short (gốc)', style: 'ngoanhien' },
];
export const FINISHES = [
  { id: 'sequin', name: 'Kim sa lấp lánh ✨' }, { id: 'satin', name: 'Lụa satin' }, { id: 'metal', name: 'Nhũ kim loại' },
  { id: 'latex', name: 'Da bóng' }, { id: 'velvet', name: 'Nhung' },
];
export const STOCKINGS = [
  { id: 'none', name: 'Không' }, { id: 'sheer', name: 'Tất da đen' }, { id: 'fishnet', name: 'Tất lưới' }, { id: 'thigh', name: 'Tất đùi trắng' },
];
export const OUTFIT_COLORS = ['#c2185b', '#e53935', '#7b1fa2', '#283593', '#1e88e5', '#00897b', '#f8bbd0', '#ffe0b2', '#fafafa', '#1a1a1a', '#d4af37', '#c0c0c0', '#b3e5fc', '#ff7043'];
export const SHOE_COLORS = ['original', '#111111', '#fafafa', '#c62828', '#d4af37', '#c0c0c0', '#f8bbd0'];
export const SKIN = ['#ffffff', '#fff1e8', '#f6dcc8', '#e2b896', '#c9946c'];
export const HAIR_COLORS = ['original', '#fafafa', '#e8e0d8', '#f2d8a7', '#d8a35c', '#8e3b2f', '#1a1110', '#f48fb1', '#ff8a65', '#b39ddb', '#80cbc4', '#90caf9'];
export const EYE_COLORS = ['original', '#7a4a2a', '#c62828', '#ffb300', '#1e88e5', '#4dd0e1', '#43a047', '#8e24aa', '#f48fb1', '#90a4ae'];
export const SHADOW_COLORS = ['none', '#e57399', '#c58fdc', '#f3a76b', '#b07a5e', '#d4af37', '#e53935', '#5c6bc0', '#3a2a30'];
export const LIP_COLORS = ['#e05a6b', '#d81b60', '#b71c1c', '#ff6f91', '#ff8a65', '#a8545d', '#8e1d4f', '#f4a3a8'];
export const BLUSH_COLORS = ['none', '#f7a1b5', '#ff8a80', '#ffab91', '#e1a3e6'];
export const LINER = [{ id: 'none', name: 'Tự nhiên' }, { id: 'cat', name: 'Mắt mèo' }, { id: 'smoky', name: 'Khói (smoky)' }];
export const LINER_COLORS = ['#1a1012', '#4e2a1e', '#7b1fa2', '#c2185b'];
export const EARRINGS = [{ id: 'none', name: 'Không' }, { id: 'pearl', name: 'Ngọc trai' }, { id: 'hoop', name: 'Khoen vàng' }, { id: 'drop', name: 'Pha lê dài' }];
export const CLIPS = [{ id: 'none', name: 'Không' }, { id: 'bow', name: 'Nơ đỏ' }, { id: 'crown', name: 'Vương miện' }, { id: 'fox', name: 'Tai cáo' }, { id: 'cat', name: 'Tai mèo' }];
export const NECKLACES = [{ id: 'none', name: 'Không' }, { id: 'pearl', name: 'Chuỗi ngọc' }, { id: 'diamond', name: 'Kim cương' }, { id: 'choker', name: 'Choker' }];

export const DEFAULT_APP = {
  base: 'base', skin: '#ffffff', height: 1,
  outfit: 'xetaa', outfitColor: '#c2185b', finish: 'sequin', stockings: 'none', shoes: '#111111', skirtColor: '#1a1a1a',
  hairColor: 'original', eyeColor: 'original',
  shadow: '#e57399', shadowAmt: 0.6, liner: 'cat', linerColor: '#1a1012',
  blush: '#f7a1b5', blushAmt: 0.6, lip: '#d81b60', lipAmt: 0.85, gloss: true,
  earrings: 'drop', clip: 'none', necklace: 'diamond',
};

// Nhạc nền theo khu vực. Có file mp3 trong public/music thì phát file, không có thì game tự chơi nhạc tổng hợp theo "style".
// style có sẵn: remix, bolero, kpop, lofi
export const MUSIC = {
  // prefix: mọi file bắt đầu bằng chữ này trong public/music sẽ thành danh sách phát của khu đó
  // ví dụ vip.mp3, vip1.mp3, vip-2.mp3 ... đều thuộc phòng VIP
  lobby: { style: 'remix', prefix: 'sanh' },
  r0: { style: 'bolero', prefix: 'phong101' },
  r1: { style: 'kpop', prefix: 'phong102' },
  r2: { style: 'lofi', prefix: 'phong103' },
  r3: { style: 'remix', prefix: 'vip' },
};

export const CUSTOMER_TYPES = {
  daigia: { name: 'Anh Đại Gia', likes: 'longlay', shirt: '#f5f5f5', pants: '#212121', skin: '#e9b98f', hair: '#111' },
  bolero: { name: 'Chú Bolero', likes: 'ngoanhien', shirt: '#8d6e63', pants: '#3e2723', skin: '#d9a07a', hair: '#555' },
  sep:    { name: 'Sếp Nhậu', likes: 'goicam', shirt: '#90caf9', pants: '#263238', skin: '#e8a98a', hair: '#222' },
  keo:    { name: 'Thanh Niên Keo Kiệt', likes: 'any', shirt: '#9e9d24', pants: '#455a64', skin: '#d9a07a', hair: '#2b1b14' },
  oppa:   { name: 'Oppa Hàn Quốc', likes: 'ngoanhien', shirt: '#212121', pants: '#424242', skin: '#f7dcc8', hair: '#c49a6c' },
  genz:   { name: 'Cậu Ấm Gen Z', likes: 'goicam', shirt: '#ff7043', pants: '#5c6bc0', skin: '#efc3a0', hair: '#1a1110' },
};

export const REQ_TEXT = {
  song: (d) => `Mở bài ${d.genre} đi!`,
  beer: () => 'Rót bia cho anh!',
  cheers: () => 'Cụng ly cái nào!',
  duet: () => 'Song ca 1 bài nha!',
  chat: () => 'Ngồi nói chuyện chút đi',
  fruit: () => 'Gọi đĩa trái cây nha',
  water: () => 'Cho ly nước chanh, xỉn quá...',
  dance: () => 'Nhảy cho anh coi đi!',
};
export const REQ_ICON = { song: '🎵', beer: '🍺', cheers: '🥂', duet: '🎤', chat: '💬', fruit: '🍉', water: '🍋', dance: '💃' };

export const GENRES = ['Bolero', 'Nhạc trẻ', 'K-pop', 'Rap', 'Remix'];
// Tên bài hát đều là tên bịa cho vui
export const SONGS = [
  { genre: 'Bolero', title: 'Chiều Mưa Bên Hiên Quán' }, { genre: 'Bolero', title: 'Thương Về Xóm Nhỏ' },
  { genre: 'Nhạc trẻ', title: 'Thả Thính Không Trượt Phát Nào' }, { genre: 'Nhạc trẻ', title: 'Crush Đã Seen' },
  { genre: 'K-pop', title: 'Oppa Saranghae Remix' }, { genre: 'K-pop', title: 'Kimchi Love Bomb' },
  { genre: 'Rap', title: 'Đời Là Bể Khổ Flow' }, { genre: 'Rap', title: 'Rap Cuối Tháng Hết Tiền' },
  { genre: 'Remix', title: 'Dzô Dzô Dzô 2026' }, { genre: 'Remix', title: 'Bay Phòng Nhạc Sập Sình' },
];

export const CHATS = {
  daigia: [
    { q: 'Em thấy anh có giống CEO không?', a: [['Anh còn hơn CEO, anh là chủ tịch luôn!', 1], ['Giống... chú bán vé số', 0], ['Dạ cũng hơi hơi', 0.5]] },
    { q: 'Anh mới tậu xe mới, em đoán xe gì?', a: [['Chắc siêu xe vàng chói giống ví anh!', 1], ['Xe đạp điện hả anh?', 0], ['Dạ xe máy ạ', 0.4]] },
  ],
  bolero: [
    { q: 'Con biết bài "Chiều Mưa Bên Hiên Quán" hông?', a: [['Dạ thuộc lòng, chú hát con bắt nhịp!', 1], ['Bài gì cổ vậy chú?', 0], ['Dạ con nghe qua rồi', 0.5]] },
    { q: 'Hồi xưa chú hát hay lắm đó nha', a: [['Giờ chú vẫn hát mùi nhất quán luôn!', 1], ['Còn giờ thì sao chú?', 0.1], ['Dạ con tin mà', 0.5]] },
  ],
  sep: [
    { q: 'Nay anh chốt deal 5 tỷ, em nói gì đi!', a: [['Sếp đỉnh nóc kịch trần bay phấp phới!', 1], ['5 tỷ tiền âm phủ hả sếp?', 0.1], ['Chúc mừng sếp ạ', 0.6]] },
    { q: 'Vợ anh gọi kìa, em tính sao?', a: [['Thôi sếp về sớm đi, kẻo chị giận!', 1], ['Để em bắt máy giùm', 0], ['Dạ em không biết đâu', 0.4]] },
  ],
  keo: [
    { q: 'Phòng này có giảm giá sinh viên không em?', a: [['Có nè, hát hay được giảm... 0%!', 1], ['Không anh ơi', 0.3], ['Anh nhìn đâu giống sinh viên', 0]] },
    { q: 'Bia ở đây sao mắc vậy?', a: [['Mắc mà uống với em thì đáng mà!', 1], ['Ra tạp hóa mua đi anh', 0], ['Dạ giá niêm yết rồi ạ', 0.5]] },
  ],
  oppa: [
    { q: 'Em biết nói tiếng Hàn không?', a: [['Saranghae! Kamsahamnida!', 1], ['Không anh', 0.2], ['Annyeong... hết vốn rồi', 0.7]] },
    { q: 'Món Việt Nam nào ngon nhất?', a: [['Bún bò, cơm tấm, bánh xèo nha anh!', 1], ['Mì gói anh ạ', 0.2], ['Phở thôi anh', 0.6]] },
  ],
  genz: [
    { q: 'Chị ơi chị có TikTok không?', a: [['Có nè, follow chéo nha em!', 1], ['TikTok là gì em?', 0.1], ['Chị không xài', 0.4]] },
    { q: 'Bài này có trend không chị?', a: [['Top 1 trend luôn, quay đi em!', 1], ['Chị không biết', 0.3], ['Trend năm ngoái rồi', 0.5]] },
  ],
};

export const fmtMoney = (k) => (k >= 1000 ? (k / 1000).toFixed(k % 1000 === 0 ? 0 : 1).replace('.', ',') + ' triệu' : k + 'k');
