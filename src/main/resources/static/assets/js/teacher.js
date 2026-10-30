let currentUser = null;
    let allDocuments = [];
    let selectedDoc = null;
    let currentStatusFilter = '';
    let docTypeMap = {};
    let lecturerMap = {};
    let currentScopeTab = 'ALL';

    function formatDateTime(isoStr) {
      if (!isoStr) return '-';
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    }

    function formatDateOnly(isoStr) {
      if (!isoStr) return '-';
      return String(isoStr).substring(0, 10);
    }

    // 1. ตรวจสอบสิทธิ์และเริ่มต้นระบบของอาจารย์
    async function initTeacherPage() {
      try {
        const res = await fetch('/api/current-user');
        if (!res.ok) {
          window.location.href = 'login.html';
          return;
        }
        currentUser = await res.json();

        if (currentUser.role === 'STAFF') {
          window.location.href = 'staff.html';
          return;
        }

        const nameEl = document.getElementById('teacherNameDisplay');
        if (nameEl) nameEl.textContent = currentUser.fullName;

        await loadDocumentTypesForTeacher();
        await loadLecturersForForwarding();
        await loadDocuments();
      } catch (err) {
        console.error('Init error:', err);
      }
    }

    // 2. ดึงประเภทเอกสารมาใส่ Dropdown ตัวกรอง
    async function loadDocumentTypesForTeacher() {
      try {
        let res = await fetch('/api/documents/types');
        if (!res.ok) res = await fetch('/api/document-types');
        if (res.ok) {
          const types = await res.json();
          const selectEl = document.getElementById('docTypeFilter');
          if (selectEl) selectEl.innerHTML = '<option value="">ทุกประเภท</option>';

          types.forEach(t => {
            const id = t.typeId || t.id;
            const name = t.typeName || t.name;
            docTypeMap[id] = name;
            if (selectEl) {
              const opt = document.createElement('option');
              opt.value = id;
              opt.textContent = name;
              selectEl.appendChild(opt);
            }
          });
        }
      } catch (err) {
        console.error('โหลดประเภทเอกสารไม่สำเร็จ:', err);
      }
    }

    // 3. ดึงรายการเอกสารจาก Backend
    async function loadDocuments() {
      try {
        const res = await fetch('/api/documents');
        if (res.ok) {
          allDocuments = await res.json();
          applyFilter();
        } else {
          console.error('ไม่สามารถดึงเอกสารได้ Status:', res.status);
        }
      } catch (err) {
        console.error('โหลดเอกสารไม่สำเร็จ:', err);
      }
    }

    // 4. ดึงรายชื่ออาจารย์สำหรับส่งต่อเอกสาร (Forward)
    async function loadLecturersForForwarding() {
      try {
        const res = await fetch('/api/lecturers');
        if (res.ok) {
          const lecturers = await res.json();
          const selectEl = document.getElementById('forwardDropdown');
          if (selectEl) {
            selectEl.innerHTML = '<option value="">-- เลือกอาจารย์/เจ้าหน้าที่ --</option>';
            lecturers.forEach(lec => {
              lecturerMap[lec.id] = lec.fullName;
              if (currentUser && lec.id !== currentUser.id) {
                const opt = document.createElement('option');
                opt.value = lec.id;
                opt.textContent = `${lec.fullName} (${lec.username})`;
                selectEl.appendChild(opt);
              }
            });
          }
        }
      } catch (err) {
        console.error('โหลดรายชื่ออาจารย์ไม่สำเร็จ:', err);
      }
    }

    // 5. แสดงผลตารางเอกสาร
    function renderTable(docs) {
      const tbody = document.getElementById('docTableBody');
      const emptyDiv = document.getElementById('docEmpty');
      if (!tbody) return;
      tbody.innerHTML = '';

      if (!docs || docs.length === 0) {
        if (emptyDiv) emptyDiv.style.display = 'block';
        return;
      }
      if (emptyDiv) emptyDiv.style.display = 'none';

      docs.slice().reverse().forEach(doc => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => showDetail(doc);

        const isAssignee = (currentUser && doc.assignedTo === currentUser.id);
        const isForwarder = (currentUser && doc.forwardedBy === currentUser.id && !isAssignee);
        const overdue = isDocumentOverdue(doc.deadline, doc.status, doc.currentStatus, doc.isDeleted);

        let tagScope = '<span style="color:#007bff; margin-left:8px;">[เอกสารทั่วไป]</span>';
        if (isAssignee) {
          tagScope = '<span style="color:#e83e8c; font-weight:bold; margin-left:8px;">[มอบหมายถึงคุณ]</span>';
        } else if (isForwarder) {
          tagScope = '<span style="color:#6c757d; font-weight:bold; margin-left:8px;">[คุณส่งต่อแล้ว]</span>';
        }

        const displayStatus = isForwarder ? 'ส่งต่อแล้ว' : (doc.currentStatus || 'รอรับเรื่อง');
        const statusClass = getStatusPillClass(isForwarder ? 'ส่งต่อแล้ว' : (doc.currentStatus || doc.status || 'PENDING'));
        const typeName = docTypeMap[doc.typeId] || 'ไม่ระบุประเภท';

        const deadlineSub = doc.deadline ? `<span class="cell-sub" style="display:block; font-size:11.5px; color:${overdue ? '#b91c1c' : '#8c7a6b'};">กำหนดเสร็จ: ${doc.deadline}</span>` : '';

        // แสดงป้ายสถานะเพียงอันเดียวตามเงื่อนไข
        let statusBadgeHtml = '';
        if (overdue) {
          statusBadgeHtml = `<span class="status-pill status-overdue">เกินกำหนด</span>`;
        } else {
          statusBadgeHtml = `<span class="status-pill ${statusClass}">${displayStatus}</span>`;
        }

        const receiveDate = doc.createdAt ? formatDateOnly(doc.createdAt) : '-';

        tr.innerHTML = `
          <td class="mono">${doc.referenceNumber || '-'}</td>
          <td>
            <b>${doc.subject || '-'}</b> ${tagScope}
            <span class="cell-sub" style="display:block; font-size:11.5px; color:#9E8C82; margin-top:2px;">${typeName}</span>
          </td>
          <td>${doc.senderName || '-'}</td>
          <td class="mono">${receiveDate}${deadlineSub}</td>
          <td>${statusBadgeHtml}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    // 6. กดปุ่มกรองตามสถานะ
    function filterByStatus(status) {
      document.querySelectorAll('.doc-filter').forEach(btn => btn.classList.remove('active'));
      if (window.event && window.event.target) {
        window.event.target.classList.add('active');
      }
      currentStatusFilter = status;
      applyFilter();
    }

    // 7. ฟังก์ชันกรองรวม
    function applyFilter() {
      const q = (document.getElementById('docSearch')?.value || '').toLowerCase().trim();
      const selectedTypeId = document.getElementById('docTypeFilter')?.value || '';

      const filtered = allDocuments.filter(d => {
        const isAssignee = (currentUser && d.assignedTo === currentUser.id);
        const isForwarder = (currentUser && d.forwardedBy === currentUser.id && !isAssignee);
        const effectiveStatus = isForwarder ? 'FORWARDED' : (d.status || 'PENDING');
        const typeName = (docTypeMap[d.typeId] || '').toLowerCase();
        const overdue = isDocumentOverdue(d.deadline, d.status, d.currentStatus, d.isDeleted);

        const matchScope = (currentScopeTab === 'ALL') || isAssignee || isForwarder;

        let matchStatus = true;
        if (currentStatusFilter) {
          if (currentStatusFilter === 'PENDING') {
            matchStatus = (effectiveStatus === 'PENDING' || (!isForwarder && d.currentStatus === 'รอรับเรื่อง'));
          } else if (currentStatusFilter === 'SUBMITTED') {
            matchStatus = (effectiveStatus === 'SUBMITTED' && d.currentStatus === 'รับเรื่องแล้ว');
          } else if (currentStatusFilter === 'OVERDUE') {
            matchStatus = overdue === true;
          } else {
            matchStatus = (effectiveStatus === currentStatusFilter);
          }
        }

        const matchType = !selectedTypeId || String(d.typeId) === String(selectedTypeId);

        const matchQuery = !q || 
          (d.subject && d.subject.toLowerCase().includes(q)) ||
          (d.senderName && d.senderName.toLowerCase().includes(q)) ||
          (d.referenceNumber && d.referenceNumber.toLowerCase().includes(q)) ||
          typeName.includes(q);

        return matchScope && matchStatus && matchType && matchQuery;
      });

      renderTable(filtered);
    }

    function searchDocs() {
      applyFilter();
    }

    // 8. แสดงหน้ารายละเอียดเอกสาร (ตรงตามรูปภาพ UI ใหม่)
    async function showDetail(doc) {
      selectedDoc = doc;
      const isAssignee = (currentUser && doc.assignedTo === currentUser.id);
      const isForwarder = (currentUser && doc.forwardedBy === currentUser.id && !isAssignee);
      const overdue = isDocumentOverdue(doc.deadline, doc.status, doc.currentStatus, doc.isDeleted);
      const typeName = docTypeMap[doc.typeId] || 'ไม่ระบุประเภท';

      // หัวเรื่องหลัก
      if (document.getElementById('detailRef')) document.getElementById('detailRef').textContent = doc.referenceNumber || 'ไม่มีเลขที่อ้างอิง';
      if (document.getElementById('detailSubject')) document.getElementById('detailSubject').textContent = doc.subject || '-';
      if (document.getElementById('detailMeta')) document.getElementById('detailMeta').textContent = `${typeName} · จาก ${doc.senderName || '-'}`;

      // ป้ายเลขที่เอกสารขวาบนตามรูปภาพ
      const topRefBox = document.getElementById('topRefBox');
      const topRefDisplay = document.getElementById('topRefDisplay');
      if (topRefBox && topRefDisplay) {
        topRefDisplay.textContent = doc.referenceNumber || '-';
        topRefBox.style.display = 'block';
      }

      // สถานะเดี่ยวไม่ซ้อนกัน
      const statusEl = document.getElementById('detailStatus');
      if (statusEl) {
        if (doc.rawStatus === 'CANCELED' || doc.isDeleted === true) {
          statusEl.textContent = 'ยกเลิกแล้ว';
          statusEl.className = 'status-pill cancelled';
        } else if (overdue || doc.isOverdue) {
          statusEl.textContent = 'เกินกำหนด';
          statusEl.className = 'status-pill status-overdue';
        } else {
          const displayStatus = isForwarder ? 'ส่งต่อแล้ว' : (doc.currentStatus || 'รอรับเรื่อง');
          statusEl.textContent = displayStatus;
          statusEl.className = 'status-pill ' + getStatusPillClass(displayStatus);
        }
      }

      const overdueBadge = document.getElementById('detailOverdueBadge');
      if (overdueBadge) overdueBadge.style.display = 'none';

      // ฟิลด์ในการ์ดรายละเอียดเอกสาร
      if (document.getElementById('detailCreatedAt')) document.getElementById('detailCreatedAt').textContent = doc.createdAt ? formatDateOnly(doc.createdAt) : (doc.documentDate || '-');
      if (document.getElementById('detailDeadline')) document.getElementById('detailDeadline').textContent = doc.deadline || 'ไม่ได้กำหนด';
      if (document.getElementById('detailSender')) document.getElementById('detailSender').textContent = doc.senderName || '-';
      if (document.getElementById('detailDescription')) document.getElementById('detailDescription').textContent = doc.description || '-';

      const assigneeName = doc.assignedTo
        ? (lecturerMap[doc.assignedTo] || (isAssignee ? currentUser.fullName : `รหัสผู้ใช้ ${doc.assignedTo}`))
        : 'เอกสารทั่วไป (ไม่ระบุผู้รับผิดชอบ)';
      if (document.getElementById('detailAssignee')) document.getElementById('detailAssignee').textContent = assigneeName;

      const scopeEl = document.getElementById('detailScope');
      if (scopeEl) {
        if (isAssignee) {
          scopeEl.innerHTML = '<span style="color: #c2410c; font-weight:600;">งานที่คุณเป็นผู้รับผิดชอบโดยตรง</span>';
        } else if (isForwarder) {
          scopeEl.innerHTML = '<span style="color: #64748b; font-weight:600;">งานที่คุณได้ส่งต่อให้ผู้อื่นแล้ว</span>';
        } else {
          scopeEl.innerHTML = '<span style="color: #0284c7; font-weight:600;">เอกสารประกาศทั่วไป</span>';
        }
      }

      // ไฟล์แนบ
      const hasFile = Boolean(doc.attachmentFile && doc.attachmentFile.trim() !== '' && doc.attachmentFile !== '-');
      if (document.getElementById('detailFile')) {
        document.getElementById('detailFile').textContent = hasFile ? 'เอกสารต้นฉบับพร้อมดาวน์โหลด' : 'ไม่มีไฟล์แนบ';
      }

      const btnDownload = document.getElementById('btnDownload');
      if (btnDownload) {
        btnDownload.style.display = hasFile ? 'inline-block' : 'none';
      }

      // แสดง/ซ่อน กล่องจัดการเอกสาร (เฉพาะผู้รับผิดชอบปัจจุบัน)
      const forwardSection = document.getElementById('forwardCardSection');
      const deadlineSection = document.getElementById('deadlineCardSection');
      const statusSection = document.getElementById('statusCardSection');
      const statusDropdown = document.getElementById('statusDropdown');
      const teacherNewDeadline = document.getElementById('teacherNewDeadline');

      if (isAssignee && !doc.isDeleted) {
        if (forwardSection) forwardSection.style.display = 'block';
        if (deadlineSection) {
          deadlineSection.style.display = 'block';
          if (teacherNewDeadline) teacherNewDeadline.value = doc.deadline || '';
        }
        if (statusSection) {
          statusSection.style.display = 'block';
          if (statusDropdown) statusDropdown.value = doc.status || 'PENDING';
        }
      } else {
        if (forwardSection) forwardSection.style.display = 'none';
        if (deadlineSection) deadlineSection.style.display = 'none';
        if (statusSection) statusSection.style.display = 'none';
      }

      goView('detail');
      const docId = doc.documentId || doc.id;
      await loadTeacherDocumentHistory(docId);
    }

    // 9. โหลดประวัติการดำเนินการ (FR7)
    async function loadTeacherDocumentHistory(docId) {
      const listEl = document.getElementById('teacherHistoryList');
      if (!listEl) return;
      listEl.innerHTML = '<li class="timeline-item"><div class="timeline-by">กำลังโหลดประวัติ...</div></li>';
      try {
        const res = await fetch(`/api/documents/${docId}/history`);
        if (res.ok) {
          const items = await res.json();
          if (!items || items.length === 0) {
            listEl.innerHTML = '<li class="timeline-item"><div class="timeline-by">ยังไม่มีประวัติการดำเนินการ</div></li>';
            return;
          }
          listEl.innerHTML = items.map((h, index) => `
            <li class="timeline-item${index === 0 ? ' is-current' : ''}">
              <div class="timeline-time">${formatDateTime(h.actionTime)}</div>
              <div class="timeline-action">${h.action}</div>
              <div class="timeline-by">โดย ${h.actionBy}</div>
              ${h.comment ? `<div class="timeline-comment">${h.comment}</div>` : ''}
            </li>
          `).join('');
        }
      } catch (err) {
        console.error('โหลดประวัติไม่สำเร็จ:', err);
      }
    }

    // 10. บันทึกการเปลี่ยนสถานะเอกสาร
    async function saveStatusChange() {
      if (!selectedDoc) return;
      const statusDropdown = document.getElementById('statusDropdown');
      const newStatus = statusDropdown ? statusDropdown.value : '';
      if (!newStatus) return;

      try {
        const docId = selectedDoc.documentId || selectedDoc.id;
        if (!await appConfirm('ยืนยันการเปลี่ยนสถานะเอกสารหรือไม่?')) return;
        const res = await fetch(`/api/documents/${docId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
          const updated = await res.json();
          selectedDoc = updated;
          await appAlert('อัปเดตสถานะเป็น "' + updated.currentStatus + '" เรียบร้อยแล้ว');
          await loadDocuments();
          await showDetail(updated);
        } else {
          await appAlert('ไม่สามารถเปลี่ยนสถานะได้: ' + await res.text());
        }
      } catch (err) {
        console.error(err);
        await appAlert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      }
    }

    // 11. ส่งต่อเอกสารให้อาจารย์ท่านอื่น พร้อมแนบความคิดเห็น (FR3)
    async function forwardDocument() {
      if (!selectedDoc) return;
      const newAssignee = document.getElementById('forwardDropdown')?.value;
      const comment = document.getElementById('forwardComment')?.value || '';

      if (!newAssignee) {
        await appAlert('กรุณาเลือกอาจารย์หรือผู้รับผิดชอบที่ต้องการส่งต่อให้');
        return;
      }
      if (!await appConfirm('คุณต้องการส่งต่อเอกสารนี้ใช่หรือไม่?')) return;

      const btn = document.getElementById('btnForwardDoc');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังส่งต่อ...'; }

      try {
        const docId = selectedDoc.documentId || selectedDoc.id;
        const res = await fetch(`/api/documents/${docId}/forward`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newAssignee: Number(newAssignee),
            comment: comment
          })
        });
        if (res.ok) {
          const updated = await res.json();
          await appAlert('ส่งต่อเอกสารเรียบร้อยแล้ว!');
          if (document.getElementById('forwardComment')) document.getElementById('forwardComment').value = '';
          await loadDocuments();
          await showDetail(updated);
        } else {
          await appAlert('ส่งต่อไม่สำเร็จ: ' + await res.text());
        }
      } catch (err) {
        console.error(err);
        await appAlert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'ส่งต่อเอกสาร'; }
      }
    }

    // 12. ปรับกำหนดเวลา Deadline สำหรับผู้รับผิดชอบ (FR8)
    async function updateDeadlineByTeacher() {
      if (!selectedDoc) return;
      const newDeadline = document.getElementById('teacherNewDeadline')?.value;
      if (!newDeadline) {
        await appAlert('กรุณาเลือกวันที่กำหนดเสร็จใหม่');
        return;
      }
      try {
        const docId = selectedDoc.documentId || selectedDoc.id;
        if (!await appConfirm('ยืนยันการบันทึกกำหนดเวลาใหม่หรือไม่?')) return;
        const res = await fetch(`/api/documents/${docId}/deadline`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deadline: newDeadline })
        });
        if (res.ok) {
          const updated = await res.json();
          selectedDoc = updated;
          if (document.getElementById('detailDeadline')) document.getElementById('detailDeadline').textContent = updated.deadline;
          await loadDocuments();
          await loadTeacherDocumentHistory(docId);
          await appAlert('บันทึกกำหนดเวลาใหม่เรียบร้อยแล้ว');
        } else {
          await appAlert('ไม่สามารถปรับกำหนดเวลาได้: ' + await res.text());
        }
      } catch (err) {
        console.error(err);
        await appAlert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      }
    }

    // 13. ดาวน์โหลดไฟล์แนบจริง
    function downloadFile() {
      if (!selectedDoc || !selectedDoc.attachmentFile || selectedDoc.attachmentFile === '-') return;
      const docId = selectedDoc.documentId || selectedDoc.id;
      window.location.href = `/api/documents/${docId}/download`;
    }

    // 14. สลับหน้าจอ Inbox <-> Detail
    function goView(view) {
      document.getElementById('view-inbox').style.display = (view === 'inbox') ? 'block' : 'none';
      document.getElementById('view-detail').style.display = (view === 'detail') ? 'block' : 'none';

      const topRefBox = document.getElementById('topRefBox');
      if (topRefBox && view === 'inbox') {
        topRefBox.style.display = 'none';
      }
    }

    // 15. ออกจากระบบ
    async function logout() {
      await fetch('/api/logout', { method: 'POST' });
      sessionStorage.clear();
      window.location.href = 'login.html';
    }

    document.addEventListener('DOMContentLoaded', initTeacherPage);

    function switchTeacherTab(scope) {
      currentScopeTab = scope;

      document.getElementById('nav-all')?.classList.toggle('active', scope === 'ALL');
      document.getElementById('nav-assigned')?.classList.toggle('active', scope === 'ASSIGNED');

      const titleEl = document.querySelector('.app-topbar h1');
      const subEl = document.querySelector('.app-topbar .sub');
      if (scope === 'ASSIGNED') {
        if (titleEl) titleEl.textContent = 'งานที่ได้รับมอบหมาย';
        if (subEl) subEl.textContent = 'รายการเอกสารที่ระบุให้คุณเป็นผู้รับผิดชอบโดยตรง หรือเคยส่งต่อ';
      } else {
        if (titleEl) titleEl.textContent = 'กล่องเอกสาร';
        if (subEl) subEl.textContent = 'เอกสารทั่วไปและเอกสารที่ได้รับมอบหมาย';
      }

      goView('inbox');
      applyFilter();
    }
