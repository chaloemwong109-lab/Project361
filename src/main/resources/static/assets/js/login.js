// ตรวจสอบว่าเคยล็อกอินค้างไว้หรือไม่ทันทีที่เปิดหน้าเว็บ
    document.addEventListener('DOMContentLoaded', async function() {
      const savedUser = sessionStorage.getItem('currentUser');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        window.location.href = (user.role === 'STAFF') ? 'staff.html' : 'teacher.html';
        return; // หยุดการทำงานตรงนี้เลยถ้ามีข้อมูลแล้ว
      }
      try {
        const res = await fetch('/api/current-user');
        if (res.ok) {
          const user = await res.json();
          // ถ้ามี Session ล็อกอินอยู่แล้ว ให้พากลับไปหน้าทำงานตาม Role ทันที
          if (user.role === 'STAFF') {
            window.location.href = 'staff.html';
          } else {
            window.location.href = 'teacher.html';
          }
        }
      } catch (err) {
        // ถ้าเกิดข้อผิดพลาด หรือยังไม่ล็อกอิน ก็ปล่อยให้อยู่หน้าฟอร์ม Login ต่อไป
        console.log("No active session, please login.");
      }
    });

    document.getElementById('loginForm').addEventListener('submit', async function (event) {
      event.preventDefault();

      if (!this.reportValidity()) {
        return;
      }

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value.trim();
      const errorMsg = document.getElementById('errorMsg');
      errorMsg.style.display = 'none';

      try {
        // ยิงไปตรวจสอบที่ AuthController ใน Backend
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username, password: password })
        });

        if (response.ok) {
          const user = await response.json();
          // เก็บข้อมูลผู้ใช้ไว้ใน sessionStorage
          sessionStorage.setItem('currentUser', JSON.stringify(user));

          // แยกหน้าตาม Role ที่ได้จาก Database
          if (user.role === 'STAFF') {
            window.location.href = 'staff.html';
          } else {
            window.location.href = 'teacher.html';
          }
        } else {
          const errorText = await response.text();
          errorMsg.textContent = errorText || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
          errorMsg.style.display = 'block';
        }
      } catch (error) {
        console.error('Login error:', error);
        errorMsg.textContent = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
        errorMsg.style.display = 'block';
      }
    });
