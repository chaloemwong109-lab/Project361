function redirectByRole(role) {
  if (role === 'STAFF') {
    window.location.href = 'staff.html';
  } else if (role === 'LECTURER') {
    window.location.href = 'teacher.html';
  } else if (role === 'MANAGER') {
    window.location.href = 'manager.html';
  } else {
    sessionStorage.removeItem('currentUser');
    document.getElementById('errorMsg').textContent = 'ไม่พบบทบาทผู้ใช้งานในระบบ';
    document.getElementById('errorMsg').style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  const savedUser = sessionStorage.getItem('currentUser');
  if (savedUser) {
    try {
      redirectByRole(JSON.parse(savedUser).role);
      return;
    } catch (_) {
      sessionStorage.removeItem('currentUser');
    }
  }

  try {
    const res = await fetch('/api/current-user');
    if (res.ok) {
      const user = await res.json();
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      redirectByRole(user.role);
    }
  } catch (_) {
    // ยังไม่ login: อยู่หน้า login ตามปกติ
  }
});

document.getElementById('loginForm').addEventListener('submit', async function (event) {
  event.preventDefault();
  if (!this.reportValidity()) return;

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.style.display = 'none';

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      errorMsg.textContent = (await response.text()) || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
      errorMsg.style.display = 'block';
      return;
    }

    const user = await response.json();
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    redirectByRole(user.role);
  } catch (error) {
    console.error('Login error:', error);
    errorMsg.textContent = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
    errorMsg.style.display = 'block';
  }
});