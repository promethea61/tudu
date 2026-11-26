/* ============ SCRIPT UTAMA ============ */

load();
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ---------- Router / view switching ----------
$$('.nav__link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    setView(link.dataset.view);
  });
});

function setView(view) {
  state.currentView = view;
  $$('.nav__link').forEach(l => l.classList.toggle('active', l.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  if (view === 'tugas') renderTugas();
  if (view === 'pertemuan') renderPertemuan();
  if (view === 'kalender') renderKalender();
  if (view === 'beranda') renderBeranda();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- Render beranda ----------
function renderBeranda() {
  const total = state.tugas.length;
  const done = state.tugas.filter(t => t.selesai).length;
  const pend = total - done;

  $('#stat-total').textContent = total;
  $('#stat-done').textContent = done;
  $('#stat-pend').textContent = pend;

  // Mulai hari ini: tugas yang deadline-nya hari ini
  const today = todayStr();
  const todayTasks = state.tugas.filter(t => t.deadline && t.deadline.slice(0, 10) === today && !t.selesai);

  // Tugas terdekat: deadline terkecil (masih dalam 7 hari, ga selesai)
  const active = state.tugas.filter(t => !t.selesai);
  const soon = [...active]
    .map(t => ({ t, d: daysUntil(t.deadline) }))
    .filter(x => x.d >= 0 && x.d <= 7)
    .sort((a, b) => a.d - b.d || a.t.judul.localeCompare(b.t.judul))
    .slice(0, 5)
    .map(x => x.t);

  renderList('#today-list', todayTasks, 'today');
  renderList('#soon-list', soon, 'soon');
  renderJadwal();
}

// ---------- Render jadwal kuliah ----------
function renderJadwal() {
  const el = $('#jadwal-list');
  if (!el) return;

  const hariUrut = ['Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at"];
  const now = new Date();
  const hariIni = ['Minggu','Senin','Selasa','Rabu','Kamis',"Jum'at",'Sabtu'][now.getDay()];

  let html = '';
  hariUrut.forEach(hari => {
    const rows = JADWAL.filter(j => j[0] === hari);
    if (!rows.length) return;
    const isToday = hari === hariIni;
    html += `<div class="jadwal__day${isToday ? ' jadwal__day--now' : ''}">`;
    html += `<div class="jadwal__name">${esc(hari)}${isToday ? ' <span class="badge">hari ini</span>' : ''}</div>`;
    rows.forEach(([, jam, matkul, dosen]) => {
      const jamMulai = JAM_MULAI[parseInt(jam.split('-')[0], 10) - 1] || '';
      html += `<div class="jadwal__row">
        <span class="jadwal__jam">${esc(jamMulai)}</span>
        <span class="jadwal__mk">${esc(matkul)}<span class="jadwal__dosen">${esc(dosen)}</span></span>
      </div>`;
    });
    html += '</div>';
  });
  el.innerHTML = html;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ---------- Render list umum (untuk card kecil ---------- */
function renderList(containerSel, items, mode) {
  const el = $(containerSel);
  if (!items.length) {
    el.innerHTML = `<li class="empty"><div class="empty__icon">${mode === 'today' ? '📌' : '⏳'}</div><p>${mode === 'today' ? 'Tugas hari ini belum ada.' : 'Belum ada tugas yang dekat.'}</p></li>`;
    return;
  }
  el.innerHTML = items.map(t => {
    const per = state.pertemuan.find(p => p.id === t.pertemuanId);
    const label = per ? per.nama : 'Pertemuan tanpa nama';
    return `
      <li class="list__item">
        <div class="task-row task-row__main">
          <div class="task-row__title">${esc(t.judul)}</div>
          <div class="task-row__meta">${label} &middot; deadline ${fmtDate(t.deadline)}</div>
        </div>
        <span class="task-row__badge">${daysUntil(t.deadline) < 0 ? '<span style="color:var(--red)">▲ telat</span>' : (daysUntil(t.deadline) === 0 ? '<span style="color:var(--amber)">HARI INI</span>' : `◷ ${daysUntil(t.deadline)}d`)}</span>
      </li>`;
  }).join('');
}

// ---------- Render Pertemuan ----------
// ---------- Render Pertemuan (per matkul) ----------
const openMatkul = new Set();

function renderPertemuan() {
  const el = $('#pertemuan-list');
  if (!el) return;

  let html = '';
  for (const m of state.matkul) {
    const ps = state.pertemuan
      .filter(p => p.matkulId === m.id)
      .sort((a, b) => a.minggu - b.minggu);
    const tugasMk = state.tugas.filter(t => ps.some(p => p.id === t.pertemuanId));
    const done = tugasMk.filter(t => t.selesai).length;
    const isOpen = openMatkul.has(m.id);

    html += `
      <div class="card mk${isOpen ? ' mk--open' : ''}">
        <button class="mk__head" data-toggle="${m.id}" aria-expanded="${isOpen}">
          <span class="mk__main">
            <span class="mk__name">${esc(m.nama)}</span>
            <span class="mk__meta">${esc(m.hari)} &middot; jam ${esc(m.jam)} &middot; ${esc(m.dosen)}</span>
          </span>
          <span class="mk__side">
            ${tugasMk.length ? `<span class="badge">${done}/${tugasMk.length}</span>` : ''}
            <span class="mk__chev">${isOpen ? '−' : '+'}</span>
          </span>
        </button>
        ${isOpen ? `<div class="mk__weeks">${ps.map(p => weekRowHtml(p)).join('')}</div>` : ''}
      </div>`;
  }

  el.innerHTML = html;

  el.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggle;
      const wasOpen = openMatkul.has(id);
      if (wasOpen) openMatkul.delete(id); else openMatkul.add(id);
      renderPertemuan();
      if (!wasOpen) {
        const card = document.querySelector(`[data-toggle="${id}"]`);
        if (card) card.closest('.mk').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

function weekRowHtml(p) {
  const ts = state.tugas.filter(t => t.pertemuanId === p.id);
  const done = ts.filter(t => t.selesai).length;
  const isNow = p.tanggal === todayStr();
  return `
    <div class="wk${isNow ? ' wk--now' : ''}">
      <div class="wk__head">
        <span class="wk__no">Pertemuan ${p.minggu}</span>
        <span class="wk__date">${fmtDate(p.tanggal)}</span>
        <span class="badge">${done}/${ts.length}</span>
      </div>
      ${ts.length
        ? `<ul class="list list--tight">${ts.map(tr => taskRowHtml(tr)).join('')}</ul>`
        : '<p class="wk__empty">Belum ada tugas</p>'}
    </div>`;
}

// ---------- Render Kalender ----------
let calRef = null;

function renderKalender() {
  const el = $('#kalender-grid');
  if (!el) return;

  if (!calRef) {
    const n = new Date();
    calRef = new Date(n.getFullYear(), n.getMonth(), 1);
  }
  const y = calRef.getFullYear(), mo = calRef.getMonth();
  const first = new Date(y, mo, 1);
  const startOffset = (first.getDay() + 6) % 7;          // Senin = 0
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const today = todayStr();

  const tugasByDate = {};
  state.tugas.forEach(t => {
    if (!t.deadline) return;
    const dKey = t.deadline.slice(0, 10);
    (tugasByDate[dKey] = tugasByDate[dKey] || []).push(t);
  });

  const matkulByHari = {};
  state.matkul.forEach(m => (matkulByHari[m.hari] = matkulByHari[m.hari] || []).push(m));

  let html = '<div class="cal__dow">' +
    ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => `<span>${d}</span>`).join('') +
    '</div><div class="cal__cells">';

  for (let i = 0; i < startOffset; i++) html += '<span class="cal__cell cal__cell--pad"></span>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(y, mo, d);
    const iso = isoDate(dt);
    const kelas = matkulByHari[HARI_NAME[dt.getDay()]] || [];
    const tugas = tugasByDate[iso] || [];
    const pending = tugas.filter(t => !t.selesai).length;

    html += `<button class="cal__cell${iso === today ? ' cal__cell--today' : ''}${tugas.length ? ' cal__cell--has' : ''}" data-date="${iso}">
      <span class="cal__num">${d}</span>
      ${kelas.length ? `<span class="cal__dot" title="${esc(kelas.map(k => k.nama).join(', '))}"></span>` : ''}
      ${pending ? `<span class="cal__badge">${pending}</span>` : ''}
    </button>`;
  }
  html += '</div>';

  el.innerHTML = html;

  const label = $('#cal-label');
  if (label) label.textContent = first.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  el.querySelectorAll('.cal__cell[data-date]').forEach(c => {
    c.addEventListener('click', () => showDayDetail(c.dataset.date));
  });
}

const HARI_NAME = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];

function showDayDetail(iso) {
  const box = $('#cal-detail');
  if (!box) return;
  const d = new Date(iso + 'T00:00:00');
  const kelas = state.matkul.filter(m => m.hari === HARI_NAME[d.getDay()]);
  const tugas = state.tugas.filter(t => t.deadline && t.deadline.slice(0, 10) === iso);

  box.innerHTML = `
    <div class="card__head"><h2 class="card__title">${fmtDate(iso)}</h2></div>
    ${kelas.length ? `<div class="cal__sec">
      <h3 class="cal__h">Kuliah</h3>
      ${kelas.map(k => `<div class="cal__row">
        <span class="jadwal__jam">${esc(JAM_MULAI[parseInt(k.jam.split('-')[0], 10) - 1] || '')}</span>
        <span>${esc(k.nama)}</span>
      </div>`).join('')}
    </div>` : ''}
    ${tugas.length ? `<div class="cal__sec">
      <h3 class="cal__h">Deadline</h3>
      <ul class="list">${tugas.map(t => taskRowHtml(t)).join('')}</ul>
    </div>` : ''}
    ${!kelas.length && !tugas.length ? '<p class="muted small">Tidak ada kuliah atau deadline.</p>' : ''}
  `;
}

// ---------- Render Tugas ----------
function renderTugas() {
  const list = $('#tugas-list');
  const search = state.searchTerm.trim().toLowerCase();
  const filter = state.filter;

  let items = state.tugas.slice();
  if (search) {
    items = items.filter(t => t.judul.toLowerCase().includes(search) || (t.keterangan || '').toLowerCase().includes(search));
  }
  if (filter !== 'all') {
    items = items.filter(t => {
      const selesai = t.selesai;
      return filter === 'pending' ? !selesai : selesai;
    });
  }

  // Kelompokkan per pertemuan (matkul + minggu), lalu per kategori non-kuliah
  const groups = new Map();
  items.forEach(t => {
    const p = state.pertemuan.find(pp => pp.id === t.pertemuanId);
    let key, label, sortKey;
    if (p) {
      const mk = state.matkul.find(m => m.id === p.matkulId);
      key = 'p:' + p.id;
      label = `${mk ? mk.nama : 'Kuliah'} &middot; Pertemuan ${p.minggu} <span class="muted">&mdash; ${fmtDate(p.tanggal)}</span>`;
      sortKey = p.tanggal;
    } else {
      key = 'k:' + (t.kategori || 'lain');
      label = t.kategori === 'personal' ? 'Pribadi' : 'Lainnya';
      sortKey = '9999-99-99';
    }
    if (!groups.has(key)) groups.set(key, { label, sortKey, items: [] });
    groups.get(key).items.push(t);
  });

  const ordered = Array.from(groups.values())
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  let html = '';
  for (const g of ordered) {
    const listTim = g.items.slice().sort((a, b) =>
      (a.deadline === b.deadline ? a.judul.localeCompare(b.judul) : a.deadline.localeCompare(b.deadline))
    );
    const done = listTim.filter(t => t.selesai).length;
    html += `
      <div class="card">
        <div class="card__head">
          <h2 class="card__title">${g.label}</h2>
          <span class="badge">${done}/${listTim.length} selesai</span>
        </div>
        <ul class="list">
          ${listTim.map(tr => taskRowHtml(tr)).join('')}
        </ul>
      </div>`;
  }

  list.innerHTML = html || `<div class="empty"><div class="empty__icon">📋</div><p>${search ? 'Tidak ada hasil pencarian.' : 'Belum ada tugas. Tambahkan tugas di bawah.'}</p></div>`;
}

function taskRowHtml(t) {
  const per = state.pertemuan.find(p => p.id === t.pertemuanId);
  const meta = per ? per.nama : '';
  const overdue = daysUntil(t.deadline) < 0;
  const cls = t.selesai ? 'task-row task-row--done' : 'task-row';
  return `
    <li class="list__item">
      <div class="check check--${t.selesai ? 'done' : ''}" data-id="${t.id}" title="${t.selesai ? 'Cek ulang' : 'Tandai selesai'}"></div>
      <div class="task-row ${cls}">
        <div class="task-row__main">
          <div class="task-row__title">${esc(t.judul)}</div>
          <div class="task-row__meta">${meta ? esc(meta) + ' &middot; ' : ''}
            <span class="deadline" style="${overdue ? 'color:var(--red)' : 'color:var(--text-dim)'}">
              deadline ${fmtDate(t.deadline)}${overdue ? ' <span style="color:var(--red)">(telat)</span>' : ''}
            </span>
          </div>
        </div>
        ${t.keterangan ? `<span class="task-row__meta" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(t.keterangan)}</span>` : ''}
        <div class="task-row__actions">
          <button class="btn btn--small btn--edit" data-id="${t.id}" data-action="edit">Edit</button>
          <button class="btn btn--small btn--danger" data-id="${t.id}" data-action="hapus">Hapus</button>
        </div>
      </div>
    </li>`;
}

// ---------- Checkbox toggle ----------
// (handled by the single delegated handler below, which also fires Telegram notify)

// ---------- Modal tugas ----------
function fillPertemuanOptions(matkulId, selectedId) {
  const ps = state.pertemuan
    .filter(p => p.matkulId === matkulId)
    .sort((a, b) => a.minggu - b.minggu);
  $('#f-pertemuan').innerHTML =
    `<option value="">— pilih pertemuan —</option>` +
    ps.map(p => `<option value="${p.id}">Pertemuan ${p.minggu} — ${fmtDate(p.tanggal)}</option>`).join('');
  if (selectedId) $('#f-pertemuan').value = selectedId;
}

function syncKategoriFields() {
  const isKuliah = $('#f-kategori').value === 'kuliah';
  const box = $('#field-kuliah');
  if (box) box.style.display = isKuliah ? '' : 'none';
  if (!isKuliah) {
    $('#f-matkul').value = '';
    $('#f-pertemuan').innerHTML = '<option value="">—</option>';
  }
}

function openModalTugas(editId) {
  state.editingTugasId = editId;
  const isEdit = !!editId;
  $('#modal-title').textContent = isEdit ? 'Ubah Tugas' : 'Tambah Tugas';
  $('#form-error').textContent = '';
  $('#form-tugas').reset();

  $('#f-kategori').innerHTML =
    '<option value="kuliah">Kuliah</option>' +
    '<option value="personal">Pribadi</option>' +
    '<option value="lain">Lainnya</option>';

  $('#f-matkul').innerHTML =
    '<option value="">— pilih matkul —</option>' +
    state.matkul.map(m => `<option value="${m.id}">${esc(m.nama)}</option>`).join('');

  $('#f-pertemuan').innerHTML = '<option value="">— pilih pertemuan —</option>';

  if (isEdit) {
    const t = state.tugas.find(x => x.id === editId);
    if (!t) { closeModalTugas(); return; }
    $('#f-judul').value = t.judul;
    $('#f-kategori').value = t.kategori || 'kuliah';
    $('#f-deadline').value = t.deadline || '';
    $('#f-keterangan').value = t.keterangan || '';

    const per = state.pertemuan.find(p => p.id === t.pertemuanId);
    if (per) {
      $('#f-matkul').value = per.matkulId;
      fillPertemuanOptions(per.matkulId, per.id);
    }
  } else {
    $('#f-kategori').value = 'kuliah';
    if (state.matkul.length) {
      $('#f-matkul').value = state.matkul[0].id;
      fillPertemuanOptions(state.matkul[0].id, null);
    }
  }

  syncKategoriFields();
  $('#modal-tugas').classList.add('modal-backdrop--open');
}

function closeModalTugas() { $('#modal-tugas').classList.remove('modal-backdrop--open'); }

// ---------- Form tugas ----------
$('#form-tugas').addEventListener('submit', (e) => {
  e.preventDefault();
  const judul = $('#f-judul').value.trim();
  const kategori = $('#f-kategori').value;
  const pertemuanId = kategori === 'kuliah' ? $('#f-pertemuan').value : '';
  const deadline = $('#f-deadline').value;
  const keterangan = $('#f-keterangan').value.trim();

  if (!judul) { $('#form-error').textContent = 'Judul tugas wajib diisi.'; return; }
  if (!deadline) { $('#form-error').textContent = 'Tanggal deadline wajib diisi.'; return; }

  const isEdit = !!state.editingTugasId;
  let affected = null;
  if (isEdit) {
    const t = state.tugas.find(x => x.id === state.editingTugasId);
    if (t) {
      t.judul = judul;
      t.pertemuanId = pertemuanId || null;
      t.deadline = deadline;
      t.keterangan = keterangan;
      t.kategori = kategori;
      affected = t;
    }
  } else {
    affected = {
      id: uid(), pertemuanId: pertemuanId || null,
      judul, deadline, keterangan, selesai: false, kategori
    };
    state.tugas.push(affected);
  }

  save();
  closeModalTugas();
  renderTugas();
  renderBeranda();
  if (state.currentView === 'pertemuan') renderPertemuan();
  if (state.currentView === 'kalender') renderKalender();
  if (affected) {
    syncPush(affected, isEdit ? 'update' : 'add');
    const emoji = isEdit ? '✏️' : '➕';
    const aksi = isEdit ? 'Tugas diubah' : 'Tugas baru';
    syncNotify(`${emoji} *${aksi}* — *${judul}*
📅 Deadline: ${fmtDate(deadline)}
🏷 ${kategori}`);
  }
});

// Dropdown berantai: kategori -> matkul -> pertemuan
$('#f-kategori').addEventListener('change', syncKategoriFields);
$('#f-matkul').addEventListener('change', () => {
  fillPertemuanOptions($('#f-matkul').value, null);
});

// Navigasi bulan kalender
$('#cal-prev').addEventListener('click', () => {
  calRef = new Date(calRef.getFullYear(), calRef.getMonth() - 1, 1);
  renderKalender();
});
$('#cal-next').addEventListener('click', () => {
  calRef = new Date(calRef.getFullYear(), calRef.getMonth() + 1, 1);
  renderKalender();
});
$('#cal-today').addEventListener('click', () => {
  const n = new Date();
  calRef = new Date(n.getFullYear(), n.getMonth(), 1);
  renderKalender();
});

$('#btn-add-tugas').addEventListener('click', () => openModalTugas(null));
$('#btn-cancel-tugas').addEventListener('click', closeModalTugas);

// Filter + search
$('#filter-select').addEventListener('change', (e) => {
  state.filter = e.target.value;
  renderTugas();
});

$('#search-input').addEventListener('input', (e) => {
  state.searchTerm = e.target.value;
  renderTugas();
});

// Keyboard shortcut: / /c /t buka view
document.addEventListener('keydown', (e) => {
  if (e.key === '1') setView('beranda');
  else if (e.key === '2') setView('pertemuan');
  else if (e.key === '3') setView('tugas');
});

// Init: render halaman beranda saat pertama kali dibuka
renderBeranda();
setTimeout(() => { if (syncCfg()) syncPull(); }, 300);
setInterval(() => { if (!document.hidden && syncCfg()) syncPull(); }, 20000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && syncCfg()) syncPull();
});

// ---------- Telegram (notifikasi) ----------
const TELEGRAM_KEY = 'kelas_telegram';

function loadTelegram() {
  try {
    const raw = localStorage.getItem(TELEGRAM_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  // Default sinkron: supaya HP & PC langsung terhubung tanpa isi manual.
  // Catatan: kode ini publik di source website (untuk penggunaan pribadi).
  return { botToken: '', chatId: '1452161961', autoNotif: false, syncCode: 'SYNC-23AD3DC1' };
}

function saveTelegram() {
  const data = {
    botToken: $('#tg-bot-token').value.trim(),
    chatId: $('#tg-chat-id').value.trim(),
    autoNotif: $('#tg-auto-notif').checked,
    syncCode: $('#tg-sync-code') ? $('#tg-sync-code').value.trim() : '',
  };
  localStorage.setItem(TELEGRAM_KEY, JSON.stringify(data));
  return data;
}

function openTelegramModal() {
  const cfg = loadTelegram();
  $('#tg-bot-token').value = cfg.botToken;
  $('#tg-chat-id').value = cfg.chatId;
  $('#tg-auto-notif').checked = cfg.autoNotif;
  if ($('#tg-sync-code')) $('#tg-sync-code').value = cfg.syncCode || '';
  $('#modal-telegram').classList.add('modal-backdrop--open');
}

function closeTelegramModal() {
  $('#modal-telegram').classList.remove('modal-backdrop--open');
}

function sendTelegramMessage(text) {
  const cfg = loadTelegram();
  if (!cfg.botToken || !cfg.chatId) return Promise.resolve({ ok: false, error: 'Belum ada konfigurasi Telegram.' });
  const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: cfg.chatId, text })
  }).then(res => {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }).catch(err => {
    console.error('Telegram send error:', err);
    return { ok: false, error: err.message };
  });
}

$('#btn-telegram').addEventListener('click', openTelegramModal);
$('#btn-sync-now').addEventListener('click', async () => {
  const btn = $('#btn-sync-now');
  const old = btn.textContent;
  btn.textContent = 'Sinkron…';
  btn.disabled = true;
  const r = await syncPull();
  btn.textContent = old;
  btn.disabled = false;
  if (r && !r.error) showToast(`Sinkron: ${r.pulled} diperbarui, ${r.pushed} dikirim, ${r.removed} dihapus`);
  else showToast('Gagal sinkron. Cek Chat ID & kode.');
});
$('#btn-cancel-telegram').addEventListener('click', closeTelegramModal);

$('#modal-telegram').addEventListener('click', (e) => {
  if (e.target === $('#modal-telegram')) closeTelegramModal();
});

$('#form-telegram').addEventListener('submit', (e) => {
  e.preventDefault();
  const errorEl = $('#form-telegram-error');
  errorEl.textContent = '';
  const botToken = $('#tg-bot-token').value.trim();
  const chatId = $('#tg-chat-id').value.trim();
  if (!chatId) { errorEl.textContent = 'Chat ID wajib diisi.'; return; }
  const cfg = saveTelegram();
  closeTelegramModal();
  if (cfg.syncCode && cfg.chatId) setTimeout(syncPull, 100);
  // Kirim test
  $('#btn-test-telegram').textContent = 'Mengirim…';
  $('#btn-test-telegram').disabled = true;
  sendTelegramMessage('*✅ Konfigurasi Telegram tersimpan*\nCobaan kirim ke chat kamu…')
    .then(res => {
      if (res.ok) {
        const link = $('#tg-open-botfather');
        link.textContent = '✅ Sudah terhubung';
        link.href = `https://t.me/${botToken.split(':')[0]}`;
        link.style.color = 'var(--green)';
      } else {
        errorEl.textContent = 'Gagal mengirim test. Cek token & Chat ID.';
      }
    })
    .catch(() => {
      errorEl.textContent = 'Gagal mengirim test (mungkin offline / CORS).';
    })
    .finally(() => {
      $('#btn-test-telegram').textContent = 'Kirim Test';
      $('#btn-test-telegram').disabled = false;
    });
});

// ---------- Telegram command handler ----------
// Expected format: /tambah <judul> [kategori] [pertemuan_id] [deadline]
// Example: /tambah Mengerjakan PPKN Bab 3 kuliah 2 2026-12-03
//
// NOTE: Full Telegram bot integration requires a backend/webhook.
// This app reads task data via URL parameters (e.g., from a Telegram bot link).
document.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'TUGAS_FROM_TELEGRAM') {
    const { judul, kategori = 'kuliah', pertemuanId, deadline } = e.data.payload || {};
    if (!judul) return;
    state.tugas.push({
      id: uid(),
      pertemuanId: pertemuanId || null,
      judul,
      deadline: deadline || '',
      keterangan: '',
      selesai: false,
      kategori: kategori || 'kuliah',
    });
    save();
    renderTugas();
    renderBeranda();
    renderPertemuan();
  }
});


// ---------- Load tasks from URL parameters (Telegram bot link) ----------
(function() {
  const params = new URLSearchParams(window.location.search);
  const tugasParam = params.get('tugas');
  const kategori = params.get('kategori') || 'kuliah';
  const pertemuanId = params.get('pertemuan') || null;
  const deadline = params.get('deadline') || '';

  if (tugasParam) {
    // Wait for state to be initialized
    function checkAndAdd() {
      if (typeof state === 'undefined' || state === null) {
        setTimeout(checkAndAdd, 100);
        return;
      }
      addTaskFromUrl(tugasParam, kategori, pertemuanId, deadline);
    }
    checkAndAdd();

    function addTaskFromUrl(judul, kategori, pertemuanId, deadline) {
      // Clean URL first so refresh/reload doesn't duplicate the task
      try { window.history.replaceState(null, '', window.location.pathname); } catch (e) {}

      const validKategori = ['kuliah', 'personal', 'lain'];
      const kategoriFinal = validKategori.includes(kategori) ? kategori : 'kuliah';

      state.tugas.push({
        id: uid(),
        pertemuanId: pertemuanId || null,
        judul: judul,
        deadline: deadline || '',
        keterangan: '',
        selesai: false,
        kategori: kategoriFinal,
      });
      save();
      renderTugas();
      renderBeranda();
      renderPertemuan();
      const msg = document.createElement('div');
      msg.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1db954;color:#070908;padding:12px 20px;border-radius:8px;font-size:14px;z-index:100;';
      msg.textContent = '✓ Tugas "' + judul + '" ditambahkan dari Telegram.';
      document.body.appendChild(msg);
      setTimeout(() => { msg.remove(); }, 2000);
    }
    return;
  }
})();

// Auto-notifikasi saat tugas di-check / uncheck
document.addEventListener('click', (e) => {
  // Hapus tugas
  const hapusBtn = e.target.closest('[data-action="hapus"]');
  if (hapusBtn) {
    const id = hapusBtn.dataset.id;
    const removed = state.tugas.find(t => t.id === id);
    state.tugas = state.tugas.filter(t => t.id !== id);
    if (removed) {
      syncPush(removed, 'delete');
      syncNotify(`🗑 *Tugas dihapus* — *${removed.judul}*`);
    }
    save();
    renderTugas();
    renderBeranda();
    if (state.currentView === 'pertemuan') renderPertemuan();
    if (state.currentView === 'kalender') renderKalender();
    showToast('Tugas dihapus');
    return;
  }

  // Edit tugas
  const editBtn = e.target.closest('[data-action="edit"]');
  if (editBtn) {
    openModalTugas(editBtn.dataset.id);
    return;
  }

  // Checkbox toggle
  const check = e.target.closest('.check');
  if (!check) return;
  const id = check.dataset.id;
  const tugas = state.tugas.find(t => t.id === id);
  if (!tugas) return;
  tugas.selesai = !tugas.selesai;
  syncPush(tugas, 'update');
  syncNotify(`${tugas.selesai ? '✅' : '↩️'} *${tugas.selesai ? 'SELESAI' : 'BELUM selesai'}* — *${tugas.judul}*`);
  save();
  renderTugas();
  renderBeranda();
  if (loadTelegram().autoNotif) {
    const updatedCheck = document.querySelector(`.check[data-id="${id}"]`);
    if (updatedCheck) {
      const status = tugas.selesai ? 'SELESAI ✅' : 'BELUM Selesai ⏳';
      const per = state.pertemuan.find(p => p.id === tugas.pertemuanId);
      const perNama = per ? per.nama : 'Pertemuan tanpa nama';
      sendTelegramMessage(
        `*${status}* — *${tugas.judul}*\n` +
        `📌 ${perNama}\n` +
        (tugas.keterangan ? `*${tugas.keterangan}*` : '')
      );
    }
  }
});


// ---------- Sinkronisasi Telegram (Supabase) ----------
const SYNC_URL = 'https://tpsefuzwbtgkorrrndxl.supabase.co/functions/v1/tugas-sync';
const SYNC_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwc2VmdXp3YnRna29ycnJuZHhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0NDU1NjYsImV4cCI6MjExMTAyMTU2Nn0.RWLn5MHBAMlOstzRa-cgs6xosWcqDabTcS2cXnA0K5I';

function syncCfg() {
  const c = loadTelegram();
  return (c.chatId && c.syncCode) ? c : null;
}

async function syncApi(action, payload = {}) {
  const c = syncCfg();
  if (!c) return null;
  try {
    const url = action === 'list'
      ? `${SYNC_URL}?action=list&chat_id=${encodeURIComponent(c.chatId)}`
      : SYNC_URL;
    const res = await fetch(url, {
      method: action === 'list' ? 'GET' : 'POST',
      headers: {
        'Authorization': `Bearer ${SYNC_ANON}`,
        'x-sync-code': c.syncCode,
        'Content-Type': 'application/json',
      },
      body: action === 'list' ? undefined : JSON.stringify({ action, chat_id: c.chatId, ...payload }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal sinkron');
    return data;
  } catch (e) {
    console.warn('[sync]', e.message);
    return null;
  }
}

function normDeadline(v) {
  if (!v) return '';
  if (v.length === 10) return v;
  // "2026-12-01T09:40:00+00:00" -> "2026-12-01T09:40"
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]}T${m[2]}` : String(v).slice(0, 16);
}

function taskToRemote(t) {
  const per = state.pertemuan.find(p => p.id === t.pertemuanId);
  return {
    judul: t.judul,
    deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
    kategori: t.kategori || 'kuliah',
    matkul_id: per ? per.matkulId : null,
    pertemuan_ke: per ? per.minggu : null,
    selesai: !!t.selesai,
  };
}

async function syncNotify(message) {
  if (!syncCfg()) return;
  await syncApi('notify', { message });
}

async function syncPush(t, action) {
  if (!syncCfg()) return;
  t._pushing = true;
  if (action === 'add') {
    const res = await syncApi('add', { task: taskToRemote(t) });
    if (res && res.id) { t.syncId = res.id; save(); }
  } else if (action === 'update' && t.syncId) {
    await syncApi('update', { id: t.syncId, task: taskToRemote(t) });
  } else if (action === 'delete' && t.syncId) {
    await syncApi('delete', { id: t.syncId });
  }
  t._pushing = false;
}

let syncBusy = false;
async function syncPull() {
  if (syncBusy) return { pulled: 0, added: 0, updated: 0, pushed: 0 };
  syncBusy = true;
  const res = await syncApi('list');
  if (!res || !Array.isArray(res.tasks)) {
    syncBusy = false;
    return { pulled: 0, error: true };
  }

  const remote = res.tasks;
  let added = 0, updated = 0;

  for (const r of remote) {
    let local = state.tugas.find(t => t.syncId === r.id);
    if (!local) {
      local = state.tugas.find(t => t.judul === r.judul && t.deadline === normDeadline(r.deadline));
    }
    if (local) {
      local.syncId = r.id;
      const changed = local.judul !== r.judul || (local.deadline || '') !== (r.deadline || '') ||
        !!local.selesai !== !!r.selesai || (local.kategori || '') !== (r.kategori || '');
      local.judul = r.judul;
      local.deadline = normDeadline(r.deadline);
      local.selesai = !!r.selesai;
      local.kategori = r.kategori || 'kuliah';
      if (r.pertemuan_ke != null) {
        const per = state.pertemuan.find(p =>
          p.minggu === r.pertemuan_ke && (!r.matkul_id || p.matkulId === r.matkul_id));
        if (per) local.pertemuanId = per.id;
      }
      if (changed) updated++;
    } else {
      const per = state.pertemuan.find(p =>
        p.minggu === r.pertemuan_ke && (!r.matkul_id || p.matkulId === r.matkul_id)) || null;
      state.tugas.push({
        id: uid(), syncId: r.id, pertemuanId: per ? per.id : null,
        judul: r.judul, deadline: normDeadline(r.deadline), keterangan: '',
        selesai: !!r.selesai, kategori: r.kategori || 'kuliah'
      });
      added++;
    }
  }

  // Kalau remote KOSONG, jangan hapus tugas lokal (mencegah data hilang)
  const remoteIds = new Set(remote.map(r => r.id));
  let removed = 0;
  if (remote.length > 0) {
    const before = state.tugas.length;
    state.tugas = state.tugas.filter(t => !t.syncId || remoteIds.has(t.syncId) || t._pushing);
    removed = before - state.tugas.length;
  }

  // Tugas lokal yang belum punya syncId -> kirim ke bot
  const unsynced = state.tugas.filter(t => !t.syncId && !t._pushing);
  for (const t of unsynced) {
    const res2 = await syncApi('add', { task: taskToRemote(t) });
    if (res2 && res2.id) { t.syncId = res2.id; save(); }
  }

  save();
  if (added || updated) {
    renderTugas();
    renderBeranda();
    if (state.currentView === 'pertemuan') renderPertemuan();
    if (state.currentView === 'kalender') renderKalender();
  }
  syncBusy = false;
  return { pulled: added + updated, added, updated, pushed: unsynced.length, removed };
}

// ---------- Toast ----------
function showToast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--green);color:#070908;padding:10px 18px;border-radius:8px;font-size:13px;z-index:1000;box-shadow:0 4px 16px rgba(0,0,0,.3);';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
