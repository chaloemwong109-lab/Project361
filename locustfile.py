import random
from locust import HttpUser, task, between

class DocflowUser(HttpUser):
    # หน่วงเวลาระหว่างคำขอ 1 - 2 วินาที
    wait_time = between(1, 2)

    def on_start(self):
        # ล็อกอินด้วย staff เพื่อรับ Session Cookie
        login_res = self.client.post("/api/login", json={
            "username": "staff",
            "password": "1234"
        })
        
        # ดึง ID เอกสารที่มีอยู่จริงในระบบมาเตรียมไว้
        self.doc_ids = []
        docs_res = self.client.get("/api/documents")
        if docs_res.status_code == 200:
            try:
                docs = docs_res.json()
                self.doc_ids = [
                    d.get("documentId") or d.get("id") 
                    for d in docs 
                    if (d.get("documentId") or d.get("id")) is not None
                ]
            except Exception:
                pass
        
        # กรณีสำรอง หากยังไม่มีข้อมูลในระบบ ให้ใช้ช่วง ID ที่มีในตารางจริง
        if not self.doc_ids:
            self.doc_ids = [19, 20, 21, 22, 23, 24]

    # 1. หน้ารายการ (List - สัดส่วนน้ำหนัก 4 = 40%)
    @task(4)
    def view_document_list(self):
        self.client.get("/api/documents")

    # 2. หน้ารายละเอียด (Detail - สัดส่วนน้ำหนัก 4 = 40%)
    @task(4)
    def view_document_history(self):
        doc_id = random.choice(self.doc_ids)
        self.client.get(f"/api/documents/{doc_id}/history")

    # 3. การบันทึกข้อมูล (Write - สัดส่วนน้ำหนัก 2 = 20% ตามเกณฑ์)
    @task(2)
    def update_document_status(self):
        doc_id = random.choice(self.doc_ids)
        self.client.patch(f"/api/documents/{doc_id}/status", json={
            "status": "IN_PROGRESS"
        })