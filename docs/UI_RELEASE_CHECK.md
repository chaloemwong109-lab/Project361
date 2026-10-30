# ผลตรวจชุด UI ก่อนส่งขึ้น Git

วันที่ตรวจ: 31 ตุลาคม 2026

## ขอบเขต

เปลี่ยนรูปแบบพื้นที่ทำงาน ย้าย CSS/JavaScript ไป assets แยกโค้ดเฉพาะหน้า เพิ่ม dialog ของระบบ และเน้นประวัติรายการล่าสุด ไม่แก้ Java controller/entity/repository หรือ application.properties

## ตรวจผ่าน

- เทียบ API URL, HTTP method, JSON payload และชื่อฟิลด์ FormData กับ HEAD ของ staff/teacher/login: เหมือนเดิม
- style.css, script.js และ status.js ที่ย้าย: เนื้อหาเดิมตรงกัน
- ลิงก์ไฟล์ภายในหน้า HTML และไวยากรณ์ JavaScript ทุกไฟล์
- Maven clean package -DskipTests: BUILD SUCCESS (compile Java และ test source ผ่าน แต่ไม่ได้รัน contextLoads)
- เปิดตรวจ JAR: ไฟล์หน้าเว็บครบ ไม่มี ui-preview.html, .local-test หรือไฟล์ CSS/JS ที่อยู่เก่า
- ทดสอบ API จำลองด้วยข้อมูลชั่วคราว: login, registration, attachment download, visibility, status, deadline, forward, permission denial, cancel, history, logout และ static assets ผ่าน
- แก้ตัวจำลองให้ส่ง attachmentFile ตรงกับสัญญาข้อมูลจริง

## สิ่งที่เปลี่ยนพฤติกรรมหน้าเว็บโดยตั้งใจ

- ยืนยันก่อนเปลี่ยนสถานะและกำหนดเวลา
- ยืนยันและแจ้งผลด้วย dialog แบบรอผู้ใช้ตอบ แทน native alert/confirm
- ปุ่มเปิดลงทะเบียนแสดงเฉพาะกล่องเอกสาร
- รายชื่อผู้รับไม่แสดง undefined เมื่อไม่มี username

## ข้อจำกัด

ยังไม่ได้ทดสอบ MySQL, S3, cookie/session และ reverse proxy บน AWS จริง ไม่มีการ deploy หรือแก้ข้อมูลจริง และยังไม่ได้ทดสอบคลิกทุกหน้า/ขนาดจอหลังการจัดไฟล์ล่าสุด จึงไม่รับรองว่าไม่มีปัญหา runtime ทุกกรณี

ก่อน deploy ควรทดสอบบน staging: login ทั้งสองบทบาท, รับ/ส่งไฟล์ S3, ลงทะเบียนและส่งต่อเอกสาร, สถานะ/กำหนดเวลา/ยกเลิก/ประวัติ, logout และปฏิเสธสิทธิ์บัญชีอื่น

## ชุดไฟล์ที่จะส่ง

.gitignore, pom.xml (ยกเว้นพรีวิวจาก resource), หน้า HTML และ assets ใน static, เอกสารโครงสร้างและผลตรวจใน docs รวมการลบไฟล์ style.css/script.js/status.js ที่ตำแหน่งเก่าพร้อมเพิ่มไฟล์ตำแหน่งใหม่

ไม่ส่ง .local-test/, ui-preview.html, target/ หรือข้อมูลทดลอง
ยังไม่ได้ commit หรือ push
