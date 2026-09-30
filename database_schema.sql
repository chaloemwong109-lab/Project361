-- ================================================================
-- 1. สร้างฐานข้อมูลและเคลียร์ของเก่า (ถ้ามี)
-- ================================================================
CREATE DATABASE IF NOT EXISTS cs361_emailbox CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cs361_emailbox;

-- ลบตารางเก่าทิ้งเรียงตามลำดับ (ลูกไปหาแม่) เพื่อป้องกัน Error
DROP TABLE IF EXISTS document_workflow_logs;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS document_types;

-- ================================================================
-- 2. สร้างตาราง (TABLES)
-- ================================================================

-- ตารางประเภทเอกสาร
CREATE TABLE document_types (
    type_id INT AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(100) NOT NULL
);

-- ตารางผู้ใช้งาน/เจ้าหน้าที่
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL
);

-- ตารางเก็บข้อมูลเอกสาร (ตารางหลัก)
CREATE TABLE documents (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    reference_number VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    sender_name VARCHAR(100) NOT NULL,
    document_date DATE,
    submission_channel VARCHAR(50),
    attachment_file VARCHAR(255),
    current_status VARCHAR(50) NOT NULL DEFAULT 'ลงทะเบียน',
    type_id INT,
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (type_id) REFERENCES document_types(type_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- ตารางเก็บประวัติการเดินทางของเอกสาร
CREATE TABLE document_workflow_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    action_status VARCHAR(50) NOT NULL,
    action_by INT NOT NULL,
    remarks TEXT,
    action_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(document_id),
    FOREIGN KEY (action_by) REFERENCES users(user_id)
);

-- ================================================================
-- 3. ข้อมูลจำลองสำหรับทดสอบ (MOCK DATA)
-- ================================================================

-- เพิ่มข้อมูลประเภทเอกสาร
INSERT INTO document_types (type_name) VALUES 
('หนังสือราชการ'),
('บันทึกข้อความ'),
('เอกสารจากภายนอก');

-- เพิ่มข้อมูลเจ้าหน้าที่
INSERT INTO users (username, password_hash, full_name, role) VALUES 
('staff01', '123456', 'สมหมาย รับเอกสาร', 'เจ้าหน้าที่รับเอกสาร');

-- เพิ่มเอกสารจำลอง 1 ฉบับ
INSERT INTO documents (reference_number, subject, sender_name, document_date, submission_channel, current_status, type_id, created_by) VALUES 
('อว 6801/2569-001', 'ขอเชิญเข้าร่วมประชุมวิชาการ', 'คณะวิทยาศาสตร์', '2026-09-29', 'ระบบสารบรรณอิเล็กทรอนิกส์', 'ลงทะเบียน', 1, 1);

-- เพิ่มประวัติการทำงานของเอกสารฉบับนั้น
INSERT INTO document_workflow_logs (document_id, action_status, action_by, remarks) VALUES 
(1, 'รับเอกสารเข้าระบบเรียบร้อย', 1, 'เอกสารครบถ้วน ไม่มีรอยฉีกขาด');

-- ================================================================
-- 4. เรียกดูผลลัพธ์
-- ================================================================
SELECT * FROM documents;