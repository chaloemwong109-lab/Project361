package com.example.demo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface DocumentRepository extends JpaRepository<Document, Integer> {
    
    // ดึงเอกสารทั้งหมดที่ยังไม่ถูกลบ (สำหรับ STAFF)
    List<Document> findByIsDeletedFalse();

    // ดึงเอกสารสำหรับอาจารย์: เอกสารทั่วไป + เอกสารที่รับผิดชอบปัจจุบัน + เอกสารที่เคยส่งต่อ (รองรับหลายทอดผ่าน DocumentHistory)
    @Query("SELECT DISTINCT d FROM Document d WHERE (d.isDeleted = false OR d.isDeleted IS NULL) AND (" +
           "d.assignedTo IS NULL " +
           "OR d.assignedTo = :userId " +
           "OR d.forwardedBy = :userId " +
           "OR d.documentId IN (SELECT h.documentId FROM DocumentHistory h WHERE h.actionBy = :fullName)" +
           ")")
    List<Document> findVisibleDocumentsForUser(@Param("userId") Long userId, @Param("fullName") String fullName);
}