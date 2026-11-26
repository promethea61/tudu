/* ============ DATA ============ */
// Semua perubahan disimpan otomatis di localStorage (key: kelas_data_v1).

// Jadwal kuliah tetap. Format: [hari, jam ke, matkul, dosen]
const JADWAL = [
  ['Senin',  '3-4',   'Workshop Pengukuran Listrik', 'Dewi Mutiara Sari, S.ST., M.Sc'],
  ['Senin',  '7-8',   'Praktikum Pemrograman',        'Dr. Ir. Sigit Wasista, M.Kom'],
  ['Selasa', '1-2',   'Matematika 1',                 'Prof. Tri Harsono, S.Si, M.Kom, Ph.D'],
  ['Selasa', '5-6',   'Konsep Teknologi',             'Prof. Ir. Dadet Pramadihanto, M.Eng, Ph.D'],
  ['Selasa', '9-10',  'Agama',                        'Imamul Arifin, S.Sy, M.HI'],
  ['Rabu',   '7-8',   'Logika Digital 1',             'Reni Soelistijorini, B.Eng, MT'],
  ['Rabu',   '9-10',  'Pemrograman',                  'Dr. Ir. Sigit Wasista, M.Kom'],
  ['Kamis',  '9-10',  'Fisika 1: Mekanika',           'Ir. Wahjoe Sesulihien, MT., Ph.D'],
  ["Jum'at", '1-2',   'Pancasila',                    'Fony Revindasari, S.Pd., M.Kom'],
  ["Jum'at", '3-4',   'Praktikum Logika Digital 1',   'Reni Soelistijorini, B.Eng, MT'],
];

// Jam mulai tiap jam ke (10 jam kuliah, 50 menit)
const JAM_MULAI = ['08:00','08:50','09:40','10:30','11:20','12:10','13:00','13:50','14:40','15:30'];

// Matkul diturunkan dari JADWAL — satu sumber, tidak dobel
const MATKUL = JADWAL.map(([hari, jam, nama, dosen]) => ({ nama, dosen, hari, jam }));

const HARI_IDX = { Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, "Jum'at": 5 };
const TOTAL_MINGGU = 16;
const DATA_KEY = 'kelas_data_v1';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function isoDate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Senin di minggu yang sama dengan tanggal d
function mondayOf(d) {
  const x = new Date(d);
  const day = x.getDay();               // 0 = Minggu
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  x.setHours(0, 0, 0, 0);
  return x;
}

function createDefaultData() {
  const start = mondayOf(new Date());
  const matkul = MATKUL.map(m => ({ id: uid(), ...m }));

  // 16 pertemuan per matkul, tanggal mengikuti hari kuliahnya
  const pertemuan = [];
  for (const m of matkul) {
    for (let w = 1; w <= TOTAL_MINGGU; w++) {
      const t = new Date(start);
      t.setDate(t.getDate() + (w - 1) * 7 + (HARI_IDX[m.hari] - 1));
      pertemuan.push({
        id: uid(),
        matkulId: m.id,
        minggu: w,
        tanggal: isoDate(t),
        nama: `${m.nama} — Pertemuan ${w}`,
        topik: ''
      });
    }
  }

  const per = (nama, minggu) => {
    const mk = matkul.find(m => m.nama === nama);
    return pertemuan.find(p => p.matkulId === mk.id && p.minggu === minggu);
  };

  const tugas = [
    {
      id: uid(), pertemuanId: per('Matematika 1', 2).id,
      judul: 'Latihan soal limit', deadline: per('Matematika 1', 2).tanggal,
      keterangan: 'Bab 2 no. 1-15', selesai: false, kategori: 'kuliah'
    },
    {
      id: uid(), pertemuanId: per('Logika Digital 1', 2).id,
      judul: 'Laporan praktikum gerbang logika', deadline: per('Logika Digital 1', 2).tanggal,
      keterangan: 'Format PDF, kumpul di Classroom', selesai: false, kategori: 'kuliah'
    },
    {
      id: uid(), pertemuanId: null,
      judul: 'Beli buku tulis', deadline: isoDate(start),
      keterangan: '', selesai: false, kategori: 'personal'
    }
  ];

  return {
    semesterStart: isoDate(start),
    matkul,
    pertemuan,
    tugas,
    currentView: 'beranda',
    searchTerm: '',
    filter: 'all',
    editingTugasId: null,
    editingPertemuanId: null
  };
}

// Data lama (belum punya matkul) di-upgrade, tugas lama tetap dibawa
function migrate(d) {
  const fresh = createDefaultData();
  if (Array.isArray(d.tugas) && d.tugas.length) {
    fresh.tugas = d.tugas.map(t => ({ ...t, pertemuanId: null }));
  }
  return fresh;
}

let state = {
  semesterStart: '',
  matkul: [],
  pertemuan: [],
  tugas: [],
  currentView: 'beranda',
  searchTerm: '',
  filter: 'all',
  editingTugasId: null,
  editingPertemuanId: null
};

function load() {
  let data = null;
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) data = JSON.parse(raw);
  } catch (e) {
    data = null;
  }

  if (!data || !Array.isArray(data.matkul) || !data.matkul.length) {
    data = data ? migrate(data) : createDefaultData();
    Object.assign(state, data);
    save();
    return state;
  }

  Object.assign(state, data);
  return state;
}

function save() {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify({
      semesterStart: state.semesterStart,
      matkul: state.matkul,
      pertemuan: state.pertemuan,
      tugas: state.tugas,
      currentView: state.currentView,
      searchTerm: state.searchTerm,
      filter: state.filter
    }));
  } catch (e) {
    console.warn('Gagal menyimpan:', e);
  }
}

// ---------- Helpers format ----------
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const daysUntil = (iso) => {
  if (!iso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(iso + 'T00:00:00');
  return Math.ceil((target - today) / 86400000);
};

const CLASS = {
  all: () => true,
  pending: (t) => !t.selesai,
  done: (t) => t.selesai,
};

const STATUS = {
  all: s => 'semua',
  pending: s => s.selesai ? 'selesai' : 'belum selesai',
  done: s => s.selesai ? 'selesai' : 'belum selesai',
};
