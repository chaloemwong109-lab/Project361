package com.example.demo;

import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/manager")
public class ManagerDashboardController {

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private DocumentTypeRepository documentTypeRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/dashboard")
    public ResponseEntity<?> getDashboard(HttpSession session) {
        User currentUser = (User) session.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("กรุณาเข้าสู่ระบบ");
        }
        if (!"MANAGER".equals(currentUser.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("เฉพาะผู้บริหารเท่านั้นที่ดูแดชบอร์ดนี้ได้");
        }

        LocalDate today = LocalDate.now(ZoneId.of("Asia/Bangkok"));
        List<Document> allDocs = documentRepository.findAll();

        // เอกสารยกเลิกยังดูได้ใน Inbox แต่ไม่นับใน KPI การติดตามงาน
        List<Document> activeDocs = allDocs.stream()
                .filter(doc -> !isCancelled(doc))
                .toList();

        List<Document> openDocs = activeDocs.stream()
                .filter(doc -> !"DONE".equals(doc.getStatus()))
                .toList();

        List<Document> overdueDocs = openDocs.stream()
                .filter(doc -> isOverdue(doc, today))
                .sorted(Comparator.comparing(Document::getDeadline))
                .toList();

        Map<Integer, String> typeNameById = documentTypeRepository.findAll().stream()
                .collect(Collectors.toMap(DocumentType::getTypeId, DocumentType::getTypeName));

        Map<Long, String> userNameById = userRepository.findAll().stream()
                .collect(Collectors.toMap(User::getId, User::getFullName));

        Map<String, Long> countByType = activeDocs.stream()
                .collect(Collectors.groupingBy(
                        doc -> typeNameById.getOrDefault(doc.getTypeId(), "ไม่ระบุประเภท"),
                        Collectors.counting()));

        List<Map<String, Object>> documentsByType = countByType.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(entry -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("name", entry.getKey());
                    item.put("count", entry.getValue());
                    return item;
                })
                .toList();

        List<Map<String, Object>> overdueItems = new ArrayList<>();
        for (Document doc : overdueDocs.stream().limit(5).toList()) {
            LocalDate deadline = LocalDate.parse(doc.getDeadline());
            Map<String, Object> item = new HashMap<>();
            item.put("id", doc.getDocumentId());
            item.put("referenceNumber", doc.getReferenceNumber());
            item.put("subject", doc.getSubject());
            item.put("deadline", doc.getDeadline());
            item.put("daysOverdue", Duration.between(deadline.atStartOfDay(), today.atStartOfDay()).toDays());
            item.put("assigneeName", doc.getAssignedTo() == null
                    ? "ยังไม่ระบุผู้รับผิดชอบ"
                    : userNameById.getOrDefault(doc.getAssignedTo(), "ไม่พบชื่อผู้รับผิดชอบ"));
            overdueItems.add(item);
        }

        double averageTurnaroundDays = activeDocs.stream()
                .filter(doc -> "DONE".equals(doc.getStatus()))
                .filter(doc -> doc.getCreatedAt() != null && doc.getCompletedAt() != null)
                .mapToDouble(doc -> Duration.between(doc.getCreatedAt(), doc.getCompletedAt()).toHours() / 24.0)
                .average()
                .orElse(0.0);

        Map<String, Object> response = new HashMap<>();
        response.put("totalDocuments", activeDocs.size());
        response.put("openDocuments", openDocs.size());
        response.put("overdueDocuments", overdueDocs.size());
        response.put("averageTurnaroundDays", Math.round(averageTurnaroundDays * 10.0) / 10.0);
        response.put("documentsByType", documentsByType);
        response.put("overdueItems", overdueItems);
        return ResponseEntity.ok(response);
    }

    private boolean isCancelled(Document doc) {
        return Boolean.TRUE.equals(doc.getIsDeleted()) || "CANCELED".equals(doc.getStatus());
    }

    private boolean isOverdue(Document doc, LocalDate today) {
        if (doc.getDeadline() == null || doc.getDeadline().isBlank()) return false;
        try {
            return LocalDate.parse(doc.getDeadline()).isBefore(today);
        } catch (Exception ignored) {
            return false;
        }
    }
}

