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

// ==========================================
// ส่วนที่แก้ไขใหม่สำหรับ V2 (เชื่อมฐานข้อมูลจริง)
// ==========================================
let allDocuments = []; // ตัวแปรเก็บข้อมูลจาก Database ไว้ใช้กรองและแสดงผล

// 1. ฟังก์ชันดึงข้อมูลจาก API หลังบ้าน
async function fetchDocumentsFromAPI() {
  try {
    // 1. ดึงข้อมูลประเภทเอกสารจาก Database มาสร้างตัวเทียบ (Map) ก่อน
    let typeMap = {};
    try {
      const typeRes = await fetch('/api/documents/types');
      if (typeRes.ok) {
        const types = await typeRes.json();
        types.forEach(t => {
          typeMap[t.typeId || t.id] = t.typeName || t.name;
        });
      }
    } catch (e) {
      console.error('ดึงประเภทเอกสารไม่สำเร็จ:', e);
    }

    // 2. ดึงรายการเอกสารทั้งหมด
    const response = await fetch('/api/documents');
    const data = await response.json();

    // 3. แมปตัวแปรจาก Database ให้ตรงกับ Frontend
    allDocuments = data.map(dbDoc => {
      // ดึงชื่อประเภทจาก typeMap ตาม typeId จริงใน Database (ถ้าไม่เจอให้ขึ้น 'ไม่ระบุประเภท')
      let docTypeName = typeMap[dbDoc.typeId] || 'ไม่ระบุประเภท';

      return {
        id: dbDoc.documentId,
        ref: dbDoc.referenceNumber,
        subject: dbDoc.subject,
        sender: dbDoc.senderName,
        date: dbDoc.documentDate,
        status: dbDoc.currentStatus,
        rawStatus: dbDoc.status, // เก็บสถานะภาษาอังกฤษไว้เผื่อเช็ค
        isDeleted: dbDoc.isDeleted,
        typeId: dbDoc.typeId,
        type: docTypeName, 
        fileName: dbDoc.attachmentFile || '-'
      };
    });

    applyFilter(); // โหลดเสร็จแล้วสั่งให้ฟังก์ชันกรอง/แสดงผลทำงาน
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการดึงข้อมูล:', error);
  }
}


// ---------- File storage (IndexedDB) ปล่อยไว้ก่อนเผื่อใช้จัดการไฟล์ ----------
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
  const doc = allDocuments.find(d => d.ref === selectedRef);
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
  // หาข้อมูลเอกสารที่กำลังเปิดดูอยู่
  const doc = allDocuments.find(d => d.ref === selectedRef);
  if (!doc || doc.status === 'ยกเลิก') return;
  
  // ถามยืนยันก่อนยกเลิก
  if (!confirm(`ยืนยันการยกเลิกเอกสาร ${doc.ref} ใช่หรือไม่?`)) return;
  
  // ยิง API แบบ PUT ไปบอก Spring Boot ให้อัปเดตข้อมูล
  fetch(`/api/documents/${doc.id}/cancel`, {
    method: 'PUT'
  })
  .then(response => {
    if (response.ok) {
      alert("ยกเลิกเอกสารเรียบร้อยแล้ว");
      fetchDocumentsFromAPI(); // สั่งให้ดึงข้อมูลใหม่จากฐานข้อมูลทันที
      goView('inbox');         // เด้งกลับไปหน้ากล่องเอกสารหลัก
    }
  })
  .catch(error => console.error('เกิดข้อผิดพลาดในการยกเลิกเอกสาร:', error));
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

// 2. ฟังก์ชันวาดข้อมูลลงตาราง
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
    
    // 🌟 ดักจับทุกกรณี ไม่ว่าตัวแปรจะเก็บเป็น CANCELED หรือ ยกเลิกแล้ว
    const isCanceled = (
        doc.status === 'CANCELED' || 
        doc.status === 'ยกเลิกแล้ว' || 
        doc.status === 'ยกเลิก' || 
        doc.currentStatus === 'ยกเลิกแล้ว' || 
        doc.isDeleted === true
    );

    if (isCanceled) tr.classList.add('is-cancelled');
    
    tr.innerHTML = `
      <td class="mono">${escapeHtml(doc.referenceNumber || doc.ref || '-')}</td>
      <td><span style="color:var(--ink);font-weight:600;">${escapeHtml(doc.subject || '-')}</span><span class="cell-sub">${escapeHtml(doc.type || '')}</span></td>
      <td>${escapeHtml(doc.senderName || doc.sender || '-')}</td>
      <td class="mono">${escapeHtml(doc.documentDate || doc.date || '-')}</td>
      <td><span class="status-pill${isCanceled ? ' cancelled' : ''}">${escapeHtml(doc.currentStatus || doc.status)}</span></td>`;
    
    tr.addEventListener('click', () => goView('detail', doc.referenceNumber || doc.ref));
    tbody.appendChild(tr);
  });
}

// 3. ฟังก์ชันค้นหาและกรองข้อมูล
let staffStatusFilter = '';

function filterStaffByStatus(status, evt) {
  document.querySelectorAll('.doc-filter').forEach(btn => btn.classList.remove('active'));
  if (evt && evt.target) evt.target.classList.add('active');
  staffStatusFilter = status;
  applyFilter();
}

function applyFilter() {
  const searchEl = document.getElementById('docSearch');
  const typeEl = document.getElementById('docTypeFilter');
  
  const q = searchEl ? searchEl.value.toLowerCase().trim() : '';
  const selectedType = typeEl ? typeEl.value : '';

  const filtered = allDocuments.filter(doc => {
    // 1. กรองตามคำค้นหา
    const matchQuery = !q ||
      (doc.ref && doc.ref.toLowerCase().includes(q)) ||
      (doc.subject && doc.subject.toLowerCase().includes(q)) ||
      (doc.sender && doc.sender.toLowerCase().includes(q)) ||
      (doc.type && doc.type.toLowerCase().includes(q));

    // 2. กรองตาม Dropdown ประเภทเอกสาร (เช็กได้ทั้งเลข typeId และชื่อประเภท)
    const matchType = !selectedType || 
      String(doc.typeId) === String(selectedType) || 
      doc.type === selectedType;

    // 3. กรองตามปุ่มสถานะด้านบน
    let matchStatus = true;
    if (staffStatusFilter) {
      if (staffStatusFilter === 'ยกเลิกแล้ว') {
        matchStatus = (doc.status === 'ยกเลิกแล้ว' || doc.status === 'ยกเลิก' || doc.rawStatus === 'CANCELED' || doc.isDeleted === true);
      } else {
        matchStatus = (doc.status === staffStatusFilter);
      }
    }

    return matchQuery && matchType && matchStatus;
  });

  renderTable(filtered);
}

// 4. ฟังก์ชันแสดงรายละเอียดเมื่อกดดูเอกสาร
function renderDetail() {
  const doc = allDocuments.find(d => d.ref === selectedRef);
  if (!doc) { goView('inbox'); return; }
  document.getElementById('detailRef').textContent = doc.ref;
  document.getElementById('detailSubject').textContent = doc.subject;
  document.getElementById('detailMeta').textContent = `${doc.type} · จาก ${doc.sender}`;
  const st = document.getElementById('detailStatus');
  st.textContent = doc.status;
  st.classList.toggle('cancelled', doc.status === 'ยกเลิก');
  const hasFile = doc.fileName && doc.fileName !== '-';
  const isReadOnly = document.body.dataset.readOnly === 'true';
  const downloadBtn = document.getElementById('btnDownload');
  if (downloadBtn) downloadBtn.style.display = hasFile ? '' : 'none';
  const cancelBtn = document.getElementById('btnCancel');
  if (cancelBtn) cancelBtn.style.display = isReadOnly || doc.status === 'ยกเลิก' ? 'none' : '';
  document.getElementById('detailSender').textContent = doc.sender;
  document.getElementById('detailType').textContent = doc.type;
  document.getElementById('detailDate').textContent = doc.date;
  document.getElementById('detailFile').textContent = doc.fileName && doc.fileName !== '-' ? doc.fileName : 'ไม่มีไฟล์แนบ';
}

// 5. เมื่อหน้าเว็บโหลดเสร็จ
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('view-inbox')) return;

  // โหลดข้อมูลจาก Database ทันที
  fetchDocumentsFromAPI();

  // ----- โค้ดที่เพิ่มใหม่: ดึงประเภทเอกสารมาใส่ Dropdown -----
  
    fetch('/api/documents/types')
      .then(response => response.json())
      .then(types => {
        const typeSelect = document.getElementById('fType');
        const filterSelect = document.getElementById('docTypeFilter');

        types.forEach(t => {
          // 1. ใส่ในฟอร์มลงทะเบียน (ใช้ value เป็นเลข ID เพื่อส่งกลับไปบันทึกใน MySQL)
          if (typeSelect) {
            const opt1 = document.createElement('option');
            opt1.value = t.typeId; 
            opt1.textContent = t.typeName;
            typeSelect.appendChild(opt1);
          }

          // 2. ใส่ในช่องค้นหา (ใช้ value เป็นชื่อข้อความ เพื่อให้ฟังก์ชัน applyFilter กรองคำได้ง่ายๆ)
          if (filterSelect) {
            const opt2 = document.createElement('option');
            opt2.value = t.typeName; 
            opt2.textContent = t.typeName;
            filterSelect.appendChild(opt2);
          }
        });
      })
      .catch(error => console.error('Error fetching types:', error));
    // --------------------------------------------------------
  
	// จัดการฟอร์มบันทึกเอกสารใหม่
	  const form = document.getElementById('registerForm');
	  if (form) {
	    form.addEventListener('submit', (e) => {
	      e.preventDefault();
	      
	      const sender = document.getElementById('fSender').value.trim();
	      const subject = document.getElementById('fSubject').value.trim();
	      
	      // ตัวแปรนี้จะดึงเลข ID จาก Dropdown ที่เราสร้างมาจาก DB (เช่น 1, 2, 3) โดยตรงเลย
	      const typeIdStr = document.getElementById('fType').value; 
	      const dateInput = document.getElementById('fDate').value;

	      // ตรวจสอบว่ากรอกข้อมูลครบไหม และเลือกประเภทหรือยัง (ค่าต้องไม่ว่าง)
	      if (!sender || !subject || !typeIdStr) {
	          alert("กรุณากรอกข้อมูลให้ครบและเลือกประเภทเอกสาร");
	          return;
	      }

	      // แปลงค่า typeIdStr (ที่เป็นข้อความตัวเลข) ให้เป็นตัวเลขจริง (Integer)
	      const typeId = parseInt(typeIdStr, 10);

	      // แพ็กข้อมูลเป็นก้อน JSON
	      const newDoc = {
	        referenceNumber: "อว 6801/2569-" + Math.floor(100 + Math.random() * 900), 
	        subject: subject,
	        senderName: sender,
	        documentDate: dateInput || new Date().toISOString().slice(0, 10),
	        typeId: typeId, // ส่งตัวเลข ID เข้าไปตรงๆ ได้เลย
	        submissionChannel: "ระบบสารบรรณอิเล็กทรอนิกส์",
	        createdBy: 1
	      };

	      // ยิง API POST เพื่อบันทึกข้อมูล
		  // 1. นำข้อมูล newDoc มาแปลงเป็นข้อความแล้วใส่ใน FormData
		  	      const formData = new FormData();
		  	      formData.append('documentData', JSON.stringify(newDoc));

		  	      // 2. ดึงไฟล์จากช่องอัปโหลด (สมมติว่าใน HTML ใช้ id="fFile")
		  	      const fileInput = document.getElementById('fFile'); 
		  	      if (fileInput && fileInput.files.length > 0) {
		  	          formData.append('file', fileInput.files[0]);
		  	      }

		  	      // 3. ยิง API POST เพื่อบันทึกข้อมูลพร้อมไฟล์ (ห้ามใส่ headers Content-Type)
		  	      fetch('/api/documents', {
		  	        method: 'POST',
		  	        body: formData
		  	      })
		  	      .then(response => response.json())
		  	      .then(data => {
		  	        alert('บันทึกเอกสารและอัปโหลดไฟล์สำเร็จ!');
		  	        form.reset();             
		  	        fetchDocumentsFromAPI();  
		  	        goView('inbox');          
		  	      })
		  	      .catch(error => console.error('เกิดข้อผิดพลาด:', error));
		  	    });
		  	  }

  const searchEl = document.getElementById('docSearch');
  const typeEl = document.getElementById('docTypeFilter');
  if (searchEl) searchEl.addEventListener('input', applyFilter);
  if (typeEl) typeEl.addEventListener('change', applyFilter);
});