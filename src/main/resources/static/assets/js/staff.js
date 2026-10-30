let allDocuments = [];
    let selectedDoc = null;
    let staffStatusFilter = '';
    let docTypeMap = {};
    let lecturerMap = {};

    // แปลงวันที่จาก created_at (ISO) เป็น YYYY-MM-DD HH:mm
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

    // 1. ตรวจสอบสิทธิ์และโหลดข้อมูลเริ่มต้นทั้งหมด
    async function checkStaffAuth() {
        try {
            const res = await fetch('/api/current-user');
            if (!res.ok) {
                window.location.href = 'login.html';
                return;
            }
            const user = await res.json();
            if (user.role !== 'STAFF') {
                window.location.href = 'teacher.html';
                return;
            }
            document.getElementById('userNameDisplay').textContent = user.fullName;

            await loadDocumentTypes();
            await loadLecturersDropdown();
            await fetchDocumentsFromAPI();
        } catch (err) {
            console.error(err);
            window.location.href = 'login.html';
        }
    }

    // 2. โหลดประเภทเอกสารใส่ Dropdown
    async function loadDocumentTypes() {
        try {
            let res = await fetch('/api/documents/types');
            if (!res.ok) res = await fetch('/api/document-types');

            if (res.ok) {
                const types = await res.json();
                const fType = document.getElementById('fType');
                const docTypeFilter = document.getElementById('docTypeFilter');

                if (fType) fType.innerHTML = '<option value="">เลือกประเภท</option>';
                if (docTypeFilter) docTypeFilter.innerHTML = '<option value="">ทุกประเภท</option>';

                types.forEach(t => {
                    const id = t.typeId || t.id;
                    const name = t.typeName || t.name;
                    docTypeMap[id] = name;

                    if (fType) {
                        const opt = document.createElement('option');
                        opt.value = id;
                        opt.textContent = name;
                        fType.appendChild(opt);
                    }
                    if (docTypeFilter) {
                        const optFilter = document.createElement('option');
                        optFilter.value = id;
                        optFilter.textContent = name;
                        docTypeFilter.appendChild(optFilter);
                    }
                });
            }
        } catch (err) {
            console.error("โหลดประเภทเอกสารไม่สำเร็จ", err);
        }
    }

    // 3. ดึงรายชื่ออาจารย์มาใส่ใน Dropdown ผู้รับผิดชอบ และเก็บใน Map
    async function loadLecturersDropdown() {
        try {
            const res = await fetch('/api/lecturers');
            if (res.ok) {
                const lecturers = await res.json();
                const selectEl = document.getElementById('assignedTo');
                if (selectEl) {
                    selectEl.innerHTML = '<option value="">— ไม่ระบุ (เอกสารทั่วไป/ทุกคนเห็นได้) —</option>';
                    lecturers.forEach(lec => {
                        lecturerMap[lec.id] = lec.fullName;
                        const opt = document.createElement('option');
                        opt.value = lec.id;
                        opt.textContent = lec.username ? `${lec.fullName} (${lec.username})` : lec.fullName;
                        selectEl.appendChild(opt);
                    });
                }
            }
        } catch (err) {
            console.error("โหลดรายชื่อผู้รับผิดชอบไม่สำเร็จ", err);
        }
    }

    // 4. ดึงรายการเอกสารจาก Backend
    async function fetchDocumentsFromAPI() {
        try {
            const response = await fetch('/api/documents');
            if (!response.ok) return;
            const data = await response.json();

            allDocuments = data.map(dbDoc => {
                let docTypeName = docTypeMap[dbDoc.typeId] || 'ไม่ระบุประเภท';
                const overdue = isDocumentOverdue(dbDoc.deadline, dbDoc.status, dbDoc.currentStatus, dbDoc.isDeleted);
                return {
                    id: dbDoc.documentId || dbDoc.id,
                    ref: dbDoc.referenceNumber || '-',
                    subject: dbDoc.subject || '-',
                    sender: dbDoc.senderName || '-',
                    date: dbDoc.documentDate || '-',
                    createdAt: dbDoc.createdAt ? formatDateTime(dbDoc.createdAt) : '-',
                    deadline: dbDoc.deadline || '-',
                    description: dbDoc.description || '-',
                    assignedTo: dbDoc.assignedTo,
                    assigneeName: dbDoc.assignedTo ? (lecturerMap[dbDoc.assignedTo] || `รหัสผู้ใช้ ${dbDoc.assignedTo}`) : 'เอกสารทั่วไป (ไม่ระบุผู้รับผิดชอบ)',
                    status: dbDoc.currentStatus || 'รอรับเรื่อง',
                    rawStatus: dbDoc.status,
                    isDeleted: dbDoc.isDeleted,
                    isOverdue: overdue,
                    typeId: dbDoc.typeId,
                    type: docTypeName,
                    fileName: dbDoc.attachmentFile || ''
                };
            });

            applyFilter();
        } catch (error) {
            console.error('เกิดข้อผิดพลาดในการดึงข้อมูล:', error);
        }
    }

    // 5. กดปุ่มกรองตามสถานะ
    function filterStaffByStatus(status, evt) {
        document.querySelectorAll('.doc-filter').forEach(btn => btn.classList.remove('active'));
        if (evt && evt.target) evt.target.classList.add('active');
        staffStatusFilter = status;
        applyFilter();
    }

    // 6. กรองข้อมูลรวม
    function applyFilter() {
        const searchEl = document.getElementById('docSearch');
        const typeEl = document.getElementById('docTypeFilter');

        const q = searchEl ? searchEl.value.toLowerCase().trim() : '';
        const selectedType = typeEl ? typeEl.value : '';

        const filtered = allDocuments.filter(doc => {
            const matchQuery = !q ||
                (doc.ref && doc.ref.toLowerCase().includes(q)) ||
                (doc.subject && doc.subject.toLowerCase().includes(q)) ||
                (doc.sender && doc.sender.toLowerCase().includes(q)) ||
                (doc.type && doc.type.toLowerCase().includes(q));

            const matchType = !selectedType || 
                String(doc.typeId) === String(selectedType) || 
                doc.type === selectedType;

            let matchStatus = true;
            if (staffStatusFilter) {
                if (staffStatusFilter === 'ยกเลิกแล้ว') {
                    matchStatus = (doc.status === 'ยกเลิกแล้ว' || doc.status === 'ยกเลิก' || doc.rawStatus === 'CANCELED' || doc.isDeleted === true);
                } else if (staffStatusFilter === 'เกินกำหนด') {
                    matchStatus = doc.isOverdue === true;
                } else {
                    matchStatus = (doc.status === staffStatusFilter && !doc.isDeleted);
                }
            }

            return matchQuery && matchType && matchStatus;
        });

        renderStaffTable(filtered);
    }

    // 7. วาดตารางแสดงผลเอกสาร
    function renderStaffTable(list) {
        const tbody = document.getElementById('docTableBody');
        const emptyDiv = document.getElementById('docEmpty');
        const tableWrap = document.getElementById('docTableWrap');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!list || list.length === 0) {
            if (emptyDiv) emptyDiv.style.display = 'block';
            if (tableWrap) tableWrap.style.display = 'none';
            return;
        }

        if (emptyDiv) emptyDiv.style.display = 'none';
        if (tableWrap) tableWrap.style.display = 'block';

        list.slice().reverse().forEach(doc => {
            const tr = document.createElement('tr');

            const isCanceled = (
                doc.rawStatus === 'CANCELED' || 
                doc.status === 'ยกเลิกแล้ว' || 
                doc.status === 'ยกเลิก' || 
                doc.isDeleted === true
            );

            if (isCanceled) tr.classList.add('is-cancelled');

            const deadlineSub = (doc.deadline && doc.deadline !== '-') ? `<span class="cell-sub" style="color:${doc.isOverdue ? '#b91c1c' : '#8c7a6b'};">กำหนดเสร็จ: ${doc.deadline}</span>` : '';

            // ป้ายสถานะเดี่ยวไม่ซ้อนกัน
            let statusBadgeHtml = '';
            if (isCanceled) {
                statusBadgeHtml = `<span class="status-pill cancelled">ยกเลิกแล้ว</span>`;
            } else if (doc.isOverdue) {
                statusBadgeHtml = `<span class="status-pill status-overdue">เกินกำหนด</span>`;
            } else {
                statusBadgeHtml = `<span class="status-pill ${getStatusPillClass(doc.status)}">${doc.status}</span>`;
            }

            const receiveDate = doc.createdAt || '-';

            tr.innerHTML = `
                <td class="mono">${doc.ref}</td>
                <td>
                    <span style="color:var(--ink);font-weight:600;">${doc.subject}</span>
                    <span class="cell-sub">${doc.type} · ผู้รับผิดชอบ: ${doc.assigneeName}</span>
                </td>
                <td>${doc.sender}</td>
                <td class="mono">${receiveDate}${deadlineSub}</td>
                <td>${statusBadgeHtml}</td>
            `;

            tr.addEventListener('click', () => showStaffDetail(doc));
            tbody.appendChild(tr);
        });
    }

    // 8. แสดงหน้ารายละเอียดเอกสารเมื่อคลิกที่แถว
    async function showStaffDetail(doc) {
        selectedDoc = doc;
        document.getElementById('detailRef').textContent = doc.ref;
        document.getElementById('detailSubject').textContent = doc.subject;
        document.getElementById('detailMeta').textContent = `${doc.type} · จาก ${doc.sender}`;

        const statusEl = document.getElementById('detailStatus');
        const isCanceled = (doc.rawStatus === 'CANCELED' || doc.status === 'ยกเลิกแล้ว' || doc.isDeleted === true);

        if (isCanceled) {
            statusEl.textContent = 'ยกเลิกแล้ว';
            statusEl.className = 'status-pill cancelled';
        } else if (doc.isOverdue) {
            statusEl.textContent = 'เกินกำหนด';
            statusEl.className = 'status-pill status-overdue';
        } else {
            statusEl.textContent = doc.status || doc.currentStatus;
            statusEl.className = 'status-pill ' + getStatusPillClass(doc.status || doc.currentStatus);
        }

        const overdueBadge = document.getElementById('detailOverdueBadge');
        if (overdueBadge) overdueBadge.style.display = 'none';

        document.getElementById('detailSender').textContent = doc.sender;
        document.getElementById('detailType').textContent = doc.type;
        if (document.getElementById('detailCreatedAt')) document.getElementById('detailCreatedAt').textContent = doc.createdAt;
        if (document.getElementById('detailDeadline')) document.getElementById('detailDeadline').textContent = doc.deadline;
        if (document.getElementById('detailAssignee')) document.getElementById('detailAssignee').textContent = doc.assigneeName;
        if (document.getElementById('detailDescription')) document.getElementById('detailDescription').textContent = doc.description || '-';

        const deadlineInput = document.getElementById('staffNewDeadline');
        if (deadlineInput) deadlineInput.value = (doc.deadline && doc.deadline !== '-') ? doc.deadline : '';

        const hasFile = Boolean(doc.fileName && doc.fileName.trim() !== '' && doc.fileName !== '-');
        if (document.getElementById('detailFile')) document.getElementById('detailFile').textContent = hasFile ? 'มีไฟล์แนบพร้อมดาวน์โหลด' : 'ไม่มีไฟล์แนบ';

        const btnDownload = document.getElementById('btnDownload');
        if (btnDownload) btnDownload.style.display = hasFile ? 'inline-block' : 'none';

        const btnCancel = document.getElementById('btnCancel');
        if (btnCancel) btnCancel.style.display = isCanceled ? 'none' : 'inline-block';

        goView('detail');
        await loadStaffDocumentHistory(doc.id);
    }

    // โหลดประวัติการดำเนินการ (FR7)
    async function loadStaffDocumentHistory(docId) {
        const listEl = document.getElementById('staffHistoryList');
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

    // ปรับกำหนดเวลาจากฝั่งเจ้าหน้าที่ (FR8)
    async function updateDeadlineByStaff() {
        if (!selectedDoc) return;
        const newDeadline = document.getElementById('staffNewDeadline')?.value;
        if (!newDeadline) {
            await appAlert('กรุณาเลือกวันที่กำหนดเสร็จใหม่');
            return;
        }
        try {
            if (!await appConfirm('ยืนยันการบันทึกกำหนดเวลาใหม่หรือไม่?')) return;
            const res = await fetch(`/api/documents/${selectedDoc.id}/deadline`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deadline: newDeadline })
            });
            if (res.ok) {
                await appAlert('บันทึกกำหนดเวลาใหม่เรียบร้อยแล้ว');
                if (document.getElementById('detailDeadline')) document.getElementById('detailDeadline').textContent = newDeadline;
                await fetchDocumentsFromAPI();
                await loadStaffDocumentHistory(selectedDoc.id);
            } else {
                await appAlert('ไม่สามารถปรับกำหนดเวลาได้: ' + await res.text());
            }
        } catch (err) {
            console.error(err);
            await appAlert('เชื่อมต่อเซิร์ฟเวอร์ขัดข้อง');
        }
    }

    // 9. สลับหน้าจอ (Inbox / Register / Detail)
    function goView(view) {
        document.getElementById('openRegisterButton').hidden = view !== 'inbox';
        document.getElementById('view-inbox').style.display = (view === 'inbox') ? 'block' : 'none';
        document.getElementById('view-register').style.display = (view === 'register') ? 'block' : 'none';
        document.getElementById('view-detail').style.display = (view === 'detail') ? 'block' : 'none';

        document.querySelectorAll('.app-nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        const titleEl = document.getElementById('appTitle');
        const subEl = document.getElementById('appSub');
        if (view === 'inbox') {
            titleEl.textContent = 'กล่องเอกสาร';
            subEl.textContent = 'เอกสารทั้งหมดที่ลงทะเบียนในระบบ';
        } else if (view === 'register') {
            titleEl.textContent = 'ลงทะเบียนเอกสารใหม่';
            subEl.textContent = 'บันทึกข้อมูลเอกสารที่ได้รับเข้าสู่ระบบ ระบบจะออกเลขที่อ้างอิงให้อัตโนมัติ';
        } else if (view === 'detail' && selectedDoc) {
            titleEl.textContent = 'รายละเอียดเอกสาร';
            subEl.textContent = selectedDoc.ref;
        }
    }

    // 10. ดาวน์โหลดไฟล์แนบจริง
    function downloadFile() {
        if (!selectedDoc || !selectedDoc.fileName || selectedDoc.fileName === '-') return;
        window.location.href = `/api/documents/${selectedDoc.id}/download`;
    }

    // 11. ยกเลิกเอกสาร (Soft Delete)
    async function cancelDoc() {
        if (!selectedDoc) return;
        const confirmCancel = await appConfirm(`คุณแน่ใจหรือไม่ว่าต้องการยกเลิกเอกสาร: ${selectedDoc.subject} (${selectedDoc.ref})?`);
        if (!confirmCancel) return;

        try {
            const res = await fetch(`/api/documents/${selectedDoc.id}/cancel`, {
                method: 'PATCH'
            });

            if (res.ok) {
                await appAlert("ยกเลิกเอกสารสำเร็จ!");
                goView('inbox');
                await fetchDocumentsFromAPI();
            } else {
                const err = await res.text();
                await appAlert("ไม่สามารถยกเลิกได้: " + err);
            }
        } catch (err) {
            console.error(err);
            await appAlert("เชื่อมต่อเซิร์ฟเวอร์ขัดข้อง");
        }
    }

    // 12. บันทึกการลงทะเบียนเอกสารใหม่
    document.getElementById('registerForm')?.addEventListener('submit', async function (event) {
        event.preventDefault();

        const submitBtn = document.getElementById('btnSubmitRegister');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'กำลังบันทึก...';
        }

        const subject = document.getElementById('fSubject').value;
        const senderName = document.getElementById('fSender').value;
        const typeId = document.getElementById('fType').value;
        const assignedTo = document.getElementById('assignedTo').value;
        const deadline = document.getElementById('fDeadline').value;
        const description = document.getElementById('fDescription').value;
        const fileInput = document.getElementById('fFile');

        const formData = new FormData();
        const autoRefNo = 'DOC-' + Date.now();
        const todayStr = new Date().toISOString().slice(0, 10);

        formData.append('referenceNumber', autoRefNo);
        formData.append('submissionChannel', 'ระบบ e-Mailbox');
        formData.append('subject', subject);
        formData.append('senderName', senderName);
        formData.append('documentDate', todayStr);

        if (typeId) formData.append('typeId', typeId);
        if (assignedTo) formData.append('assignedTo', assignedTo);
        if (deadline) formData.append('deadline', deadline);
        if (description) formData.append('description', description);
        if (fileInput && fileInput.files.length > 0) {
            formData.append('file', fileInput.files[0]);
        }

        try {
            const res = await fetch('/api/documents', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                await appAlert('บันทึกเอกสารสำเร็จ!');
                document.getElementById('registerForm').reset();
                goView('inbox');
                await fetchDocumentsFromAPI();
            } else {
                const errText = await res.text();
                await appAlert('เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: ' + errText);
            }
        } catch (error) {
            console.error('Error saving document:', error);
            await appAlert('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'บันทึกเข้าระบบ';
            }
        }
    });

    // 13. ออกจากระบบ
    async function logout() {
        await fetch('/api/logout', { method: 'POST' });
        sessionStorage.clear();
        window.location.href = 'login.html';
    }

    document.addEventListener('DOMContentLoaded', () => {
        checkStaffAuth();
        document.getElementById('docSearch')?.addEventListener('input', applyFilter);
        document.getElementById('docTypeFilter')?.addEventListener('change', applyFilter);
    });
