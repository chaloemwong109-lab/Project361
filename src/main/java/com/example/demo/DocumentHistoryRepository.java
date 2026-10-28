package com.example.demo;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DocumentHistoryRepository extends JpaRepository<DocumentHistory, Integer> {
    // ดึงประวัติของเอกสารเรียงจากล่าสุดไปเก่าสุด (เหมือนในรูป Prototype FR7)
    List<DocumentHistory> findByDocumentIdOrderByActionTimeDesc(Integer documentId);
}