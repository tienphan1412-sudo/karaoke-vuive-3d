// Dữ liệu dùng chung cho client

export const STYLE_NAMES = { longlay: 'Lộng lẫy', goicam: 'Gợi cảm', ngoanhien: 'Ngoan hiền' };

export const OUTFITS = [
  { id: 'duoica', name: 'Đầm dạ hội đuôi cá', style: 'longlay', sparkle: true, cover: { torso: 1, chest: 1, shoulder: 0, upper: 0, fore: 0 }, skirt: 'mermaid' },
  { id: 'congchua', name: 'Đầm công chúa', style: 'longlay', sparkle: true, cover: { torso: 1, chest: 1, shoulder: 1, upper: 0, fore: 0 }, skirt: 'ball' },
  { id: 'bodycon', name: 'Váy ôm body', style: 'goicam', cover: { torso: 1, chest: 1, shoulder: 0, upper: 0, fore: 0 }, skirt: 'tight' },
  { id: 'haiday', name: 'Đầm hai dây xòe', style: 'goicam', cover: { torso: 1, chest: 1, shoulder: 0, upper: 0, fore: 0 }, skirt: 'aline' },
  { id: 'aodai', name: 'Áo dài', style: 'ngoanhien', cover: { torso: 1, chest: 1, shoulder: 1, upper: 1, fore: 1 }, pants: '#fafafa', flaps: true, collar: true },
  { id: 'cardigan', name: 'Cardigan + váy xếp ly', style: 'ngoanhien', cover: { torso: 1, chest: 1, shoulder: 1, upper: 1, fore: 1 }, skirt: 'pleat' },
];

export const OUTFIT_COLORS = ['#c2185b', '#e53935', '#8e24aa', '#3949ab', '#1e88e5', '#00897b', '#f8bbd0', '#fff59d', '#f5f5f5', '#212121', '#d4af37', '#b3e5fc'];
export const SHOE_COLORS = ['#212121', '#f5f5f5', '#c62828', '#d4af37', '#f8bbd0', '#6d4c41'];
export const SKIN = ['#ffe3d3', '#f8d5bd', '#eebd9a', '#d9a07a', '#b97e57'];
export const HAIR_COLORS = ['#1a1110', '#3b2219', '#6b3e26', '#a0522d', '#d8b26e', '#f2d8a7', '#8e44ad', '#e91e63', '#cfd8dc'];
export const HAIR_STYLES = [
  { id: 'long', name: 'Xõa dài' }, { id: 'wave', name: 'Xoăn sóng' }, { id: 'pony', name: 'Đuôi ngựa' },
  { id: 'twin', name: 'Hai bím' }, { id: 'bob', name: 'Tóc bob' }, { id: 'bun', name: 'Búi cao' },
];
export const EYE_COLORS = ['#3e2723', '#6d4c41', '#1565c0', '#2e7d32', '#6a1b9a', '#c62828', '#546e7a'];
export const SHADOW_COLORS = ['none', '#f48fb1', '#ce93d8', '#ffcc80', '#a1887f', '#90caf9', '#d4af37', '#ef5350'];
export const LIP_COLORS = ['#e57373', '#d81b60', '#b71c1c', '#f06292', '#ff8a65', '#8d6e63', '#ad1457', '#ffab91'];
export const BLUSH_COLORS = ['none', '#f8a5b8', '#ff8a80', '#ffab91', '#e1bee7'];
export const LINER = [{ id: 'none', name: 'Không' }, { id: 'thin', name: 'Mảnh' }, { id: 'cat', name: 'Mắt mèo' }, { id: 'bold', name: 'Đậm' }];
export const LASHES = [{ id: 'natural', name: 'Tự nhiên' }, { id: 'doll', name: 'Búp bê' }, { id: 'drama', name: 'Dày cong' }];
export const BROWS = [{ id: 'thin', name: 'Mảnh' }, { id: 'natural', name: 'Tự nhiên' }, { id: 'straight', name: 'Ngang Hàn' }, { id: 'arched', name: 'Cong sắc' }];
export const EARRINGS = [{ id: 'none', name: 'Không' }, { id: 'pearl', name: 'Ngọc trai' }, { id: 'hoop', name: 'Khoen tròn' }, { id: 'drop', name: 'Dài lấp lánh' }];
export const CLIPS = [{ id: 'none', name: 'Không' }, { id: 'bow', name: 'Nơ' }, { id: 'flower', name: 'Kẹp hoa' }, { id: 'crown', name: 'Vương miện' }];
export const GLASSES = [{ id: 'none', name: 'Không' }, { id: 'round', name: 'Kính tròn' }, { id: 'cat', name: 'Kính mắt mèo' }];
export const NECKLACES = [{ id: 'none', name: 'Không' }, { id: 'pearl', name: 'Chuỗi ngọc' }, { id: 'choker', name: 'Choker' }];

export const DEFAULT_APP = {
  skin: SKIN[0], height: 1, outfit: 'duoica', outfitColor: '#c2185b', shoes: '#212121',
  hair: 'long', hairColor: '#1a1110',
  eyeColor: '#6d4c41', shadow: '#f48fb1', shadowAmt: 0.6, liner: 'thin', lashes: 'doll', brows: 'natural',
  blush: '#f8a5b8', lip: '#d81b60', gloss: true,
  earrings: 'pearl', clip: 'none', glasses: 'none', necklace: 'none',
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
