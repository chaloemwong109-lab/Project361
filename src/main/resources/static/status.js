function getStatusPillClass(status) {
  const normalizedStatus = String(status || '').trim().toUpperCase();

  const statusClasses = {
    'รอรับเรื่อง': 'status-pending',
    PENDING: 'status-pending',
    'รับเรื่องแล้ว': 'status-submitted',
    SUBMITTED: 'status-submitted',
    'กำลังดำเนินการ': 'status-in-progress',
    IN_PROGRESS: 'status-in-progress',
    'เสร็จสิ้น': 'status-completed',
    DONE: 'status-completed',
    COMPLETED: 'status-completed',
    'ส่งต่อแล้ว': 'status-forwarded',
    FORWARDED: 'status-forwarded',
    'เกินกำหนด': 'status-overdue',
    OVERDUE: 'status-overdue'
  };

  return statusClasses[normalizedStatus] || '';
}

// ฟังก์ชันเช็กว่าเอกสารเกินกำหนด Deadline หรือยัง (ใช้ร่วมกันทั้ง staff.html และ teacher.html)
function isDocumentOverdue(deadlineStr, rawStatus, currentStatus, isDeleted) {
  if (!deadlineStr || deadlineStr === '-' || isDeleted) return false;
  if (rawStatus === 'DONE' || rawStatus === 'CANCELED' || currentStatus === 'เสร็จสิ้น' || currentStatus === 'ยกเลิกแล้ว') {
    return false;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(deadlineStr);
  if (isNaN(due.getTime())) return false;
  due.setHours(0, 0, 0, 0);
  return today > due;
}