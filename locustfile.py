import random
from locust import HttpUser, task, between

class TeacherUser(HttpUser):
    wait_time = between(1, 2)

    def on_start(self):
        self.client.post("/api/login", json={
            "username": "teacher1",
            "password": "1234"
        }, timeout=15)

        self.doc_ids = []
        docs_res = self.client.get("/api/documents", timeout=15)
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

        if not self.doc_ids:
            self.doc_ids = [19, 20, 21, 22, 23, 24]

    @task(7)
    def view_document_list(self):
        self.client.get("/api/documents", name="/api/documents [Teacher List]", timeout=15)

    @task(3)
    def view_document_history(self):
        if self.doc_ids:
            doc_id = random.choice(self.doc_ids)
            self.client.get(
                f"/api/documents/{doc_id}/history",
                name="/api/documents/[id]/history [Teacher Detail]",
                timeout=15
            )