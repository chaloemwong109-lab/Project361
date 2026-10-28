package com.example.demo;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "documents")
public class Document {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer documentId;

    private String referenceNumber;
    private String subject;
    private String senderName;
    private String documentDate;
    private String submissionChannel;
    private String attachmentFile;
    private String currentStatus;
    
    private Integer typeId; 
    private Integer createdBy; 
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    private Boolean isDeleted = false;

    // ฟิลด์สำหรับ V3 (ผู้รับผิดชอบ และ สถานะ)
    @Column(name = "assigned_to")
    private Long assignedTo;

    @Column(name = "status")
    private String status = "SUBMITTED"; // SUBMITTED, IN_PROGRESS, DONE

    @Column(name = "forwarded_by")
    private Long forwardedBy;

    // ===== ฟิลด์ที่เพิ่มใหม่สำหรับ V4 =====
    @Column(name = "deadline")
    private String deadline; // เก็บรูปแบบ YYYY-MM-DD

    @Column(name = "description", columnDefinition = "TEXT")
    private String description; // คำอธิบายหรือหมายเหตุเพิ่มเติมตอนลงทะเบียน

    public Document() {}

    // Getters and Setters เดิมทั้งหมด
    public Integer getDocumentId() {
        return documentId;
    }
    public void setDocumentId(Integer documentId) {
        this.documentId = documentId;
    }

    public String getReferenceNumber() {
        return referenceNumber;
    }
    public void setReferenceNumber(String referenceNumber) {
        this.referenceNumber = referenceNumber;
    }

    public String getSubject() {
        return subject;
    }
    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getSenderName() {
        return senderName;
    }
    public void setSenderName(String senderName) {
        this.senderName = senderName;
    }

    public String getDocumentDate() {
        return documentDate;
    }
    public void setDocumentDate(String documentDate) {
        this.documentDate = documentId != null ? documentDate : documentDate;
        this.documentDate = documentDate;
    }

    public String getSubmissionChannel() {
        return submissionChannel;
    }
    public void setSubmissionChannel(String submissionChannel) {
        this.submissionChannel = submissionChannel;
    }

    public String getAttachmentFile() {
        return attachmentFile;
    }
    public void setAttachmentFile(String attachmentFile) {
        this.attachmentFile = attachmentFile;
    }

    public String getCurrentStatus() {
        return currentStatus;
    }
    public void setCurrentStatus(String currentStatus) {
        this.currentStatus = currentStatus;
    }

    public Integer getTypeId() {
        return typeId;
    }
    public void setTypeId(Integer typeId) {
        this.typeId = typeId;
    }

    public Integer getCreatedBy() {
        return createdBy;
    }
    public void setCreatedBy(Integer createdBy) {
        this.createdBy = createdBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Boolean getIsDeleted() {
        return isDeleted;
    }
    public void setIsDeleted(Boolean isDeleted) {
        this.isDeleted = isDeleted;
    }

    public Long getAssignedTo() {
        return assignedTo;
    }
    public void setAssignedTo(Long assignedTo) {
        this.assignedTo = assignedTo;
    }

    public String getStatus() {
        return status;
    }
    public void setStatus(String status) {
        this.status = status;
    }

    public Long getForwardedBy() {
        return forwardedBy;
    }
    public void setForwardedBy(Long forwardedBy) {
        this.forwardedBy = forwardedBy;
    }

    // Getters and Setters สำหรับ V4
    public String getDeadline() {
        return deadline;
    }
    public void setDeadline(String deadline) {
        this.deadline = deadline;
    }

    public String getDescription() {
        return description;
    }
    public void setDescription(String description) {
        this.description = description;
    }
}