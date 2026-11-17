let allDocuments = [];
let selectedDoc = null;
let statusFilter = '';
let docTypeMap = {};
let userMap = {};

function formatDateTime(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  const pad = value => String(value).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isCancelled(doc) {
  return doc.isDeleted === true || doc.rawStatus === 'CANCELED';
}

function escapeHtml(value) {
  return String(value ?? '-').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

async function initManagerPage() {
  try {
    const response = await fetch('/api/current-user');
    if (!response.ok) return window.location.replace('login.html');
    const user = await response.json();
    if (user.role !== 'MANAGER') return window.location.replace('login.html');
    document.getElementById('userNameDisplay').textContent = user.fullName;
    await Promise.all([loadDocumentTypes(), loadUsers()]);
    await Promise.all([fetchDocuments(), loadDashboard()]);
  } catch (error) {
    console.error(error);
    window.location.replace('login.html');
  }
}

async function loadDocumentTypes() {
  const response = await fetch('/api/documents/types');
  if (!response.ok) throw new Error('โหลดประเภทเอกสารไม่สำเร็จ');
  const types = await response.json();
  const select = document.getElementById('docTypeFilter');
  select.innerHTML = '<option value="">ทุกประเภท</option>';
  types.forEach(type => {
    const id = type.typeId ?? type.id;
    const name = type.typeName ?? type.name;
    docTypeMap[id] = name;
    select.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`);
  });
}

async function loadUsers() {
  // API เดิมคืนเฉพาะ LECTURER ซึ่งเพียงพอกับ assignedTo ในระบบปัจจุบัน
  const response = await fetch('/api/lecturers');
  if (!response.ok) return;
  (await response.json()).forEach(user => { userMap[user.id] = user.fullName; });
}

async function fetchDocuments() {
  const response = await fetch('/api/documents');
  if (!response.ok) throw new Error('โหลดรายการเอกสารไม่สำเร็จ');
  const data = await response.json();
  allDocuments = data.map(doc => ({
    id: doc.documentId ?? doc.id,
    ref: doc.referenceNumber || '-',
    subject: doc.subject || '-',
    sender: doc.senderName || '-',
    typeId: doc.typeId,
    type: docTypeMap[doc.typeId] || 'ไม่ระบุประเภท',
    createdAt: doc.createdAt ? formatDateTime(doc.createdAt) : '-',
    deadline: doc.deadline || '-',
    description: doc.description || '-',
    rawStatus: doc.status,
    status: doc.currentStatus || 'รอรับเรื่อง',
    isDeleted: doc.isDeleted,
    isOverdue: isDocumentOverdue(doc.deadline, doc.status, doc.currentStatus, doc.isDeleted),
    assigneeName: doc.assignedTo ? (userMap[doc.assignedTo] || `รหัสผู้ใช้ ${doc.assignedTo}`) : 'ยังไม่ระบุผู้รับผิดชอบ',
    fileName: doc.attachmentFile || ''
  }));
  applyFilter();
}

function filterByStatus(status, event) {
  statusFilter = status;
  document.querySelectorAll('.doc-filter').forEach(button => button.classList.remove('active'));
  event.currentTarget.classList.add('active');
  applyFilter();
}

function applyFilter() {
  const query = document.getElementById('docSearch').value.trim().toLowerCase();
  const typeId = document.getElementById('docTypeFilter').value;
  const result = allDocuments.filter(doc => {
    const matchesQuery = !query || [doc.ref, doc.subject, doc.sender, doc.type, doc.assigneeName]
      .some(value => String(value).toLowerCase().includes(query));
    const matchesType = !typeId || String(doc.typeId) === typeId;
    const matchesStatus = !statusFilter
      || (statusFilter === 'เกินกำหนด' && doc.isOverdue)
      || (statusFilter === 'ยกเลิกแล้ว' && isCancelled(doc))
      || (statusFilter === doc.status && !isCancelled(doc));
    return matchesQuery && matchesType && matchesStatus;
  });
  renderTable(result);
}

function renderTable(documents) {
  const tbody = document.getElementById('docTableBody');
  const empty = document.getElementById('docEmpty');
  const wrapper = document.getElementById('docTableWrap');
  if (!documents.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    wrapper.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  wrapper.style.display = 'block';
  tbody.innerHTML = documents.slice().reverse().map(doc => {
    const badge = isCancelled(doc)
      ? '<span class="status-pill cancelled">ยกเลิกแล้ว</span>'
      : doc.isOverdue
        ? '<span class="status-pill status-overdue">เกินกำหนด</span>'
        : `<span class="status-pill ${getStatusPillClass(doc.status)}">${escapeHtml(doc.status)}</span>`;
    const deadline = doc.deadline !== '-' ? `<span class="cell-sub">กำหนดเสร็จ: ${escapeHtml(doc.deadline)}</span>` : '';
    return `<tr data-id="${doc.id}">
      <td class="mono">${escapeHtml(doc.ref)}</td>
      <td><strong>${escapeHtml(doc.subject)}</strong><span class="cell-sub">${escapeHtml(doc.type)}</span></td>
      <td>${escapeHtml(doc.sender)}</td>
      <td class="mono">${escapeHtml(doc.createdAt)}${deadline}</td>
      <td>${badge}</td><td>${escapeHtml(doc.assigneeName)}</td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', () => showDetail(allDocuments.find(doc => String(doc.id) === row.dataset.id)));
  });
}

async function showDetail(doc) {
  if (!doc) return;
  selectedDoc = doc;
  document.getElementById('detailRef').textContent = doc.ref;
  document.getElementById('detailSubject').textContent = doc.subject;
  document.getElementById('detailMeta').textContent = `${doc.type} · จาก ${doc.sender}`;
  document.getElementById('detailSender').textContent = doc.sender;
  document.getElementById('detailType').textContent = doc.type;
  document.getElementById('detailCreatedAt').textContent = doc.createdAt;
  document.getElementById('detailDeadline').textContent = doc.deadline;
  document.getElementById('detailAssignee').textContent = doc.assigneeName;
  document.getElementById('detailDescription').textContent = doc.description;
  document.getElementById('detailFile').textContent = doc.fileName ? 'มีไฟล์แนบพร้อมดาวน์โหลด' : 'ไม่มีไฟล์แนบ';
  document.getElementById('btnDownload').style.display = doc.fileName ? 'inline-block' : 'none';

  const status = document.getElementById('detailStatus');
  status.textContent = isCancelled(doc) ? 'ยกเลิกแล้ว' : doc.isOverdue ? 'เกินกำหนด' : doc.status;
  status.className = `status-pill ${isCancelled(doc) ? 'cancelled' : doc.isOverdue ? 'status-overdue' : getStatusPillClass(doc.status)}`;
  goView('detail');
  await loadHistory(doc.id);
}

async function loadHistory(documentId) {
  const list = document.getElementById('managerHistoryList');
  const response = await fetch(`/api/documents/${documentId}/history`);
  if (!response.ok) {
    list.innerHTML = '<li class="timeline-item"><div class="timeline-by">ไม่สามารถโหลดประวัติได้</div></li>';
    return;
  }
  const items = await response.json();
  list.innerHTML = items.length ? items.map((item, index) => `<li class="timeline-item${index === 0 ? ' is-current' : ''}">
    <div class="timeline-time">${escapeHtml(formatDateTime(item.actionTime))}</div>
    <div class="timeline-action">${escapeHtml(item.action)}</div>
    <div class="timeline-by">โดย ${escapeHtml(item.actionBy)}</div>
    ${item.comment ? `<div class="timeline-comment">${escapeHtml(item.comment)}</div>` : ''}
  </li>`).join('') : '<li class="timeline-item"><div class="timeline-by">ยังไม่มีประวัติการดำเนินการ</div></li>';
}

async function loadDashboard() {
  const response = await fetch('/api/manager/dashboard');
  if (!response.ok) throw new Error('โหลดข้อมูลแดชบอร์ดไม่สำเร็จ');
  const data = await response.json();
  document.getElementById('metricTotal').textContent = data.totalDocuments;
  document.getElementById('metricOpen').textContent = data.openDocuments;
  document.getElementById('metricOverdue').textContent = data.overdueDocuments;
  document.getElementById('metricTat').textContent = `${data.averageTurnaroundDays} วัน`;

  const max = Math.max(1, ...data.documentsByType.map(item => item.count));
  document.getElementById('typeBreakdown').innerHTML = data.documentsByType.length
    ? data.documentsByType.map(item => `<div class="type-row"><span class="type-name">${escapeHtml(item.name)}</span><div class="type-track"><div class="type-bar" style="width:${(item.count / max) * 100}%"></div></div><span class="type-count">${item.count}</span></div>`).join('')
    : '<p class="dashboard-empty">ยังไม่มีข้อมูลประเภทเอกสาร</p>';

  document.getElementById('overdueList').innerHTML = data.overdueItems.length
    ? data.overdueItems.map(item => `<div class="overdue-item"><div><span class="overdue-ref">${escapeHtml(item.referenceNumber)}</span><span class="overdue-subject">${escapeHtml(item.subject)}</span><span class="overdue-meta">กำหนด ${escapeHtml(item.deadline)} · ${escapeHtml(item.assigneeName)}</span></div><span class="overdue-days">เกิน ${item.daysOverdue} วัน</span></div>`).join('')
    : '<p class="dashboard-empty">ไม่มีรายการเกินกำหนด</p>';
}

function goView(view) {
  ['inbox', 'dashboard', 'detail'].forEach(name => {
    document.getElementById(`view-${name}`).style.display = name === view ? 'block' : 'none';
  });
  document.querySelectorAll('.app-nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  const title = document.getElementById('appTitle');
  const sub = document.getElementById('appSub');
  if (view === 'dashboard') { title.textContent = 'แดชบอร์ดสรุป'; sub.textContent = 'ภาพรวมสถานะเอกสาร งานค้าง และระยะเวลาดำเนินการ'; }
  else if (view === 'detail') { title.textContent = 'รายละเอียดเอกสาร'; sub.textContent = selectedDoc?.ref || ''; }
  else { title.textContent = 'กล่องเอกสาร'; sub.textContent = 'เอกสารทั้งหมดในระบบ (ดูอย่างเดียว)'; }
}

function downloadFile() {
  if (selectedDoc?.fileName) window.location.href = `/api/documents/${selectedDoc.id}/download`;
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  sessionStorage.clear();
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  initManagerPage();
  document.getElementById('docSearch').addEventListener('input', applyFilter);
  document.getElementById('docTypeFilter').addEventListener('change', applyFilter);
});