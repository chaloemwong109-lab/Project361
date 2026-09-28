function toggleFaq(btn) {
  const item = btn.parentElement;
  document.querySelectorAll('.faq-item').forEach(i => { if (i !== item) i.classList.remove('open'); });
  item.classList.toggle('open');
}
// active nav link on scroll (public info page)
const links = document.querySelectorAll('.nav-links a');
const sections = [...links].map(l => document.querySelector(l.getAttribute('href')));
window.addEventListener('scroll', () => {
  let idx = 0;
  sections.forEach((s, i) => { if (s && window.scrollY >= s.offsetTop - 120) idx = i; });
  links.forEach((l, i) => l.classList.toggle('active', i === idx));
  const backTop = document.getElementById('backTop');
  if (backTop) backTop.classList.toggle('show', window.scrollY > 500);
});

// ---------- Document registration, browse & search ----------
const STORAGE_KEY = 'edocflow_documents';

function loadDocs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveDocs(docs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}


// ---------- File storage (IndexedDB) ----------
function openFileDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('edocflow_files', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putFile(ref, file) {
  const db = await openFileDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(file, ref);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getFile(ref) {
  const db = await openFileDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('files').objectStore('files').get(ref);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function downloadFile() {
  const doc = loadDocs().find(d => d.ref === selectedRef);
  const file = doc && await getFile(doc.ref);
  if (!file) return;
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function cancelDoc() {
  const docs = loadDocs();
  const doc = docs.find(d => d.ref === selectedRef);
  if (!doc || doc.status === 'ยกเลิก') return;
  if (!confirm(`ยกเลิกเอกสาร ${doc.ref} ใช่หรือไม่?`)) return;
  doc.status = 'ยกเลิก';
  doc.cancelledAt = new Date().toISOString();
  saveDocs(docs);
  renderDetail();
}

function refPrefix(type) {
  switch (type) {
    case 'หนังสือราชการ': return 'อว';
    case 'บันทึกข้อความ': return 'บก';
    case 'เอกสารจากคณะ': return 'คณ';
    case 'เอกสารภายใน': return 'ภน';
    default: return 'อว';
  }
}

function nextRef(docs, type) {
  const buddhistYear = new Date().getFullYear() + 543;
  const seq = String(docs.length + 1).padStart(3, '0');
  return `${refPrefix(type)} 6801/${buddhistYear}-${seq}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- View switching (staff workspace) ----------
const VIEW_META = {
  inbox: { title: 'กล่องเอกสาร', sub: 'เอกสารทั้งหมดที่ลงทะเบียนในระบบ' },
  register: { title: 'ลงทะเบียนเอกสารใหม่', sub: 'บันทึกข้อมูลเอกสารที่ได้รับเข้าสู่ระบบ ระบบจะออกเลขที่อ้างอิงให้อัตโนมัติ' },
  detail: { title: 'รายละเอียดเอกสาร', sub: '' },
};
let selectedRef = null;

function goView(view, ref) {
  if (ref) selectedRef = ref;
  ['inbox', 'register', 'detail'].forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = (v === view) ? '' : 'none';
  });
  document.querySelectorAll('.app-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view || (view === 'detail' && el.dataset.view === 'inbox'));
  });
  const meta = VIEW_META[view];
  document.getElementById('appTitle').textContent = meta.title;
  document.getElementById('appSub').textContent = view === 'detail' ? (selectedRef || '') : meta.sub;
  if (view === 'inbox') applyFilter();
  if (view === 'detail') renderDetail();
  window.scrollTo(0, 0);
}

function renderDocs(list) {
  const tbody = document.getElementById('docTableBody');
  const empty = document.getElementById('docEmpty');
  const wrap = document.getElementById('docTableWrap');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (list.length === 0) {
    wrap.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  wrap.style.display = 'block';
  empty.style.display = 'none';

  list.slice().reverse().forEach(doc => {
    const tr = document.createElement('tr');
    if (doc.status === 'ยกเลิก') tr.classList.add('is-cancelled');
    tr.innerHTML = `
      <td class="mono">${escapeHtml(doc.ref)}</td>
      <td><span style="color:var(--ink);font-weight:600;">${escapeHtml(doc.subject)}</span><span class="cell-sub">${escapeHtml(doc.type)}</span></td>
      <td>${escapeHtml(doc.sender)}</td>
      <td class="mono">${escapeHtml(doc.date)}</td>
      <td><span class="status-pill${doc.status === 'ยกเลิก' ? ' cancelled' : ''}">${escapeHtml(doc.status)}</span></td>`;
    tr.addEventListener('click', () => goView('detail', doc.ref));
    tbody.appendChild(tr);
  });
}

function applyFilter() {
  const docs = loadDocs();
  const searchEl = document.getElementById('docSearch');
  const typeEl = document.getElementById('docTypeFilter');
  const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
  const type = typeEl ? typeEl.value : '';

  const filtered = docs.filter(d => {
    const matchesQ = !q || [d.ref, d.subject, d.sender, d.type].some(v => v.toLowerCase().includes(q));
    const matchesType = !type || d.type === type;
    return matchesQ && matchesType;
  });
  renderDocs(filtered);
}

function renderDetail() {
  const doc = loadDocs().find(d => d.ref === selectedRef);
  if (!doc) { goView('inbox'); return; }
  document.getElementById('detailRef').textContent = doc.ref;
  document.getElementById('detailSubject').textContent = doc.subject;
  document.getElementById('detailMeta').textContent = `${doc.type} · จาก ${doc.sender}`;
  const st = document.getElementById('detailStatus');
  st.textContent = doc.status;
  st.classList.toggle('cancelled', doc.status === 'ยกเลิก');
  const hasFile = doc.fileName && doc.fileName !== '-';
  document.getElementById('btnDownload').style.display = hasFile ? '' : 'none';
  document.getElementById('btnCancel').style.display = doc.status === 'ยกเลิก' ? 'none' : '';
  document.getElementById('detailSender').textContent = doc.sender;
  document.getElementById('detailType').textContent = doc.type;
  document.getElementById('detailDate').textContent = doc.date;
  document.getElementById('detailFile').textContent = doc.fileName && doc.fileName !== '-' ? doc.fileName : 'ไม่มีไฟล์แนบ';
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('view-inbox')) return; // public page: nothing more to wire

  applyFilter();

  const form = document.getElementById('registerForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const sender = document.getElementById('fSender').value.trim();
      const subject = document.getElementById('fSubject').value.trim();
      const type = document.getElementById('fType').value;
      const dateInput = document.getElementById('fDate').value;
      const fileInput = document.getElementById('fFile');

      if (!sender || !subject || !type) return;

      const docs = loadDocs();
      const date = dateInput || new Date().toISOString().slice(0, 10);
      const ref = nextRef(docs, type);
      docs.push({
        ref,
        sender,
        subject,
        type,
        date,
        fileName: (fileInput && fileInput.files[0]) ? fileInput.files[0].name : '-',
        status: 'ลงทะเบียนแล้ว',
      });
      saveDocs(docs);
      if (fileInput && fileInput.files[0]) await putFile(ref, fileInput.files[0]);
      form.reset();
      goView('detail', ref);
    });
  }

  const searchEl = document.getElementById('docSearch');
  const typeEl = document.getElementById('docTypeFilter');
  if (searchEl) searchEl.addEventListener('input', applyFilter);
  if (typeEl) typeEl.addEventListener('change', applyFilter);
});