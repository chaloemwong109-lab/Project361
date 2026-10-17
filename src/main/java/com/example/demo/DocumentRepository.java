package com.example.demo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface DocumentRepository extends JpaRepository<Document, Integer> {
    
    // ดึงเอกสารทั้งหมดที่ยังไม่ถูกลบ (สำหรับ STAFF)
    List<Document> findByIsDeletedFalse();

    // ดึงเฉพาะเอกสารทั่วไป (assignedTo เป็น null) หรือเอกสารที่มอบหมายให้ User คนนี้โดยเฉพาะ (สำหรับ LECTURER)
    @Query("SELECT d FROM Document d WHERE d.isDeleted = false AND (d.assignedTo IS NULL OR d.assignedTo = :userId OR d.forwardedBy = :userId)")
    List<Document> findVisibleDocumentsForUser(@Param("userId") Long userId);
}