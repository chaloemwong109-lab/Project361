package com.example.demo;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "document_history")
public class DocumentHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer historyId;

    private Integer documentId;
    private String action;      // เช่น ลงทะเบียนเอกสาร, เปลี่ยนสถานะ, มอบหมายต่อ, ปรับกำหนดเวลา
    private String actionBy;    // ชื่อผู้ดำเนินการ + บทบาท
    
    @Column(columnDefinition = "TEXT")
    private String comment;     // ความคิดเห็นแนบ หรือหมายเหตุ
    
    private LocalDateTime actionTime;

    public DocumentHistory() {}

    public DocumentHistory(Integer documentId, String action, String actionBy, String comment) {
        this.documentId = documentId;
        this.action = action;
        this.actionBy = actionBy;
        this.comment = comment;
        this.actionTime = LocalDateTime.now();
    }

    // Getters and Setters
    public Integer getHistoryId() { return historyId; }
    public void setHistoryId(Integer historyId) { this.historyId = historyId; }

    public Integer getDocumentId() { return documentId; }
    public void setDocumentId(Integer documentId) { this.documentId = documentId; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getActionBy() { return actionBy; }
    public void setActionBy(String actionBy) { this.actionBy = actionBy; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }

    public LocalDateTime getActionTime() { return actionTime; }
    public void setActionTime(LocalDateTime actionTime) { this.actionTime = actionTime; }
}