package com.example.demo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import jakarta.servlet.http.HttpSession;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.net.URI;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private S3Service s3Service;

    @Autowired
    private DocumentTypeRepository documentTypeRepository;

    @Autowired
    private DocumentHistoryRepository documentHistoryRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/types")
    public ResponseEntity<?> getDocumentTypes() {
        return ResponseEntity.ok(documentTypeRepository.findAll());
    }

    // 1. ดึงรายการเอกสาร (กรองตามสิทธิ์ของผู้ใช้ที่ Login อยู่ใน Session)
    @GetMapping
    public ResponseEntity<?> getAllDocuments(HttpSession session) {
        User currentUser = (User) session.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("กรุณาเข้าสู่ระบบก่อนใช้งาน");
        }

        List<Document> docs;
        if ("STAFF".equals(currentUser.getRole())) {
            // ถ้าเป็นเจ้าหน้าที่ ให้เห็นเอกสารทั้งหมด
            docs = documentRepository.findAll();
        } else {
            // ถ้าเป็นอาจารย์/เจ้าหน้าที่ทั่วไป ให้เห็นเฉพาะเอกสารทั่วไป + เอกสารที่ได้รับมอบหมาย หรือเคยส่งต่อ
            docs = documentRepository.findVisibleDocumentsForUser(currentUser.getId(), currentUser.getFullName());
        }

        return ResponseEntity.ok(docs);
    }

    // 2. ลงทะเบียนเอกสารใหม่ (รองรับ S3, assignedTo, deadline, description และบันทึก History)
    @PostMapping
    public ResponseEntity<?> createDocument(
            @RequestParam("referenceNumber") String referenceNumber,
            @RequestParam("subject") String subject,
            @RequestParam("senderName") String senderName,
            @RequestParam("submissionChannel") String submissionChannel,
            @RequestParam(value = "typeId", required = false) Integer typeId,
            @RequestParam(value = "assignedTo", required = false) Long assignedTo,
            @RequestParam(value = "deadline", required = false) String deadline,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "file", required = false) MultipartFile file,
            HttpSession session) {

        User currentUser = (User) session.getAttribute("currentUser");
        if (currentUser == null || !"STAFF".equals(currentUser.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("เฉพาะเจ้าหน้าที่เท่านั้นที่มีสิทธิ์ลงทะเบียนเอกสาร");
        }

        try {
            Document doc = new Document();
            doc.setReferenceNumber(referenceNumber);
            doc.setSubject(subject);
            doc.setSenderName(senderName);
            doc.setSubmissionChannel(submissionChannel);
            doc.setTypeId(typeId);
            doc.setAssignedTo(assignedTo); // null = เอกสารทั่วไป, มีค่า = มอบหมายให้อาจารย์
            doc.setDeadline((deadline != null && !deadline.isBlank()) ? deadline : null);
            doc.setDescription((description != null && !description.isBlank()) ? description : null);

            // เงื่อนไข: ถ้าเป็นเอกสารทั่วไป (assignedTo == null) ให้สถานะเป็น DONE ทันที
            if (assignedTo == null) {
                doc.setStatus("DONE");
                doc.setCurrentStatus("เสร็จสิ้น");
            } else {
                doc.setStatus("PENDING");
                doc.setCurrentStatus("รอรับเรื่อง"); 
            }
            doc.setCreatedBy(currentUser.getId().intValue());
            doc.setCreatedAt(LocalDateTime.now());
            doc.setUpdatedAt(LocalDateTime.now());
            doc.setIsDeleted(false);

            // อัปโหลดไฟล์ขึ้น S3 ถ้ามีแนบไฟล์มา
            if (file != null && !file.isEmpty()) {
                String fileUrl = s3Service.uploadFile(file);
                doc.setAttachmentFile(fileUrl);
            }

            Document savedDoc = documentRepository.save(doc);

            // บันทึกประวัติการลงทะเบียน (FR7)
            String actorName = "เจ้าหน้าที่รับเอกสาร (" + currentUser.getFullName() + ")";
            documentHistoryRepository.save(new DocumentHistory(
                    savedDoc.getDocumentId(),
                    "ลงทะเบียนเอกสารเข้าระบบ ออกเลขที่อ้างอิง " + savedDoc.getReferenceNumber(),
                    actorName,
                    description
            ));

            // ถ้ามีการระบุผู้รับผิดชอบตั้งแต่ตอนลงทะเบียน ให้บันทึกประวัติการมอบหมายด้วย
            if (assignedTo != null) {
                String assigneeName = userRepository.findById(assignedTo)
                        .map(User::getFullName)
                        .orElse("รหัสผู้ใช้ " + assignedTo);
                String deadlineNote = (deadline != null && !deadline.isBlank()) ? "กำหนดเสร็จ: " + deadline : null;
                documentHistoryRepository.save(new DocumentHistory(
                        savedDoc.getDocumentId(),
                        "มอบหมายให้ " + assigneeName,
                        actorName,
                        deadlineNote
                ));
            }

            return ResponseEntity.ok(savedDoc);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("เกิดข้อผิดพลาดในการบันทึกเอกสาร: " + e.getMessage());
        }
    }

    // 3. ปรับสถานะเอกสาร (สำหรับผู้รับผิดชอบ หรือ Staff) พร้อมบันทึก History
    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateDocumentStatus(
            @PathVariable("id") Integer id,
            @RequestBody Map<String, String> body,
            HttpSession session) {

        User currentUser = (User) session.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("กรุณาเข้าสู่ระบบ");
        }

        Optional<Document> docOpt = documentRepository.findById(id);
        if (docOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("ไม่พบเอกสาร");
        }

        Document doc = docOpt.get();

        // ตรวจสอบสิทธิ์: ต้องเป็น STAFF หรือ ผู้รับผิดชอบเอกสารชิ้นนี้เท่านั้น
        boolean isStaff = "STAFF".equals(currentUser.getRole());
        boolean isAssignee = doc.getAssignedTo() != null && doc.getAssignedTo().equals(currentUser.getId());

        if (!isStaff && !isAssignee) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("คุณไม่มีสิทธิ์เปลี่ยนสถานะเอกสารนี้");
        }

        String newStatus = body.get("status"); 
        String comment = body.get("comment");
        if (newStatus != null) {
            doc.setStatus(newStatus);
            if ("SUBMITTED".equals(newStatus)) {
                doc.setCurrentStatus("รับเรื่องแล้ว");
            } else if ("IN_PROGRESS".equals(newStatus)) {
                doc.setCurrentStatus("กำลังดำเนินการ");
            } else if ("DONE".equals(newStatus)) {
                doc.setCurrentStatus("เสร็จสิ้น");
            } else if ("FORWARDED".equals(newStatus)) {
                doc.setCurrentStatus("ส่งต่อแล้ว");
            } else {
                doc.setCurrentStatus("รอรับเรื่อง"); // กรณี PENDING
            }
            doc.setUpdatedAt(LocalDateTime.now());
            documentRepository.save(doc);

            // บันทึกประวัติการเปลี่ยนสถานะ (FR7)
            documentHistoryRepository.save(new DocumentHistory(
                    doc.getDocumentId(),
                    "เปลี่ยนสถานะเป็น " + doc.getCurrentStatus(),
                    currentUser.getFullName(),
                    comment
            ));

            return ResponseEntity.ok(doc);
        }

        return ResponseEntity.badRequest().body("รูปแบบสถานะไม่ถูกต้อง");
    }

    // 4. ฟังก์ชันส่งต่อเอกสาร (Forward) รองรับการแนบความคิดเห็น (FR3) และบันทึก History (FR7)
    @PatchMapping("/{id}/forward")
    public ResponseEntity<?> forwardDocument(
            @PathVariable("id") Integer id,
            @RequestBody Map<String, Object> body,
            HttpSession session) {

        User currentUser = (User) session.getAttribute("currentUser");
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("กรุณาเข้าสู่ระบบ");

        Optional<Document> docOpt = documentRepository.findById(id);
        if (docOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("ไม่พบเอกสาร");

        Document doc = docOpt.get();

        // ตรวจสอบ: ต้องเป็นผู้ที่ได้รับมอบหมายคนปัจจุบัน หรือ STAFF เท่านั้นถึงจะส่งต่อได้
        boolean isStaff = "STAFF".equals(currentUser.getRole());
        boolean isCurrentAssignee = doc.getAssignedTo() != null && doc.getAssignedTo().equals(currentUser.getId());
        if (!isStaff && !isCurrentAssignee) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("เฉพาะผู้รับผิดชอบปัจจุบันหรือเจ้าหน้าที่เท่านั้นที่สามารถส่งต่อได้");
        }

        Object newAssigneeObj = body.get("newAssignee");
        String comment = body.get("comment") != null ? String.valueOf(body.get("comment")).trim() : null;

        if (newAssigneeObj != null) {
            Long newAssignee = Long.valueOf(String.valueOf(newAssigneeObj));
            doc.setForwardedBy(currentUser.getId()); // จำคนส่งต่อ
            doc.setAssignedTo(newAssignee);          // เปลี่ยนผู้รับผิดชอบเป็นคนใหม่
            doc.setStatus("PENDING");                // ตั้งเป็น PENDING ให้คนใหม่กดรับเรื่อง
            doc.setCurrentStatus("รอรับเรื่อง");
            doc.setUpdatedAt(LocalDateTime.now());
            documentRepository.save(doc);

            String newAssigneeName = userRepository.findById(newAssignee)
                    .map(User::getFullName)
                    .orElse("รหัสผู้ใช้ " + newAssignee);

            // บันทึกประวัติการส่งต่อพร้อมความคิดเห็น (FR3 & FR7)
            documentHistoryRepository.save(new DocumentHistory(
                    doc.getDocumentId(),
                    "ส่งต่อ/มอบหมายให้ " + newAssigneeName,
                    currentUser.getFullName(),
                    (comment != null && !comment.isEmpty()) ? comment : null
            ));

            return ResponseEntity.ok(doc);
        }

        return ResponseEntity.badRequest().body("กรุณาระบุผู้รับมอบหมายใหม่");
    }

    // 5. ฟังก์ชันปรับกำหนดเวลา Deadline (FR8) สำหรับผู้รับผิดชอบหรือเจ้าหน้าที่
    @PatchMapping("/{id}/deadline")
    public ResponseEntity<?> updateDeadline(
            @PathVariable("id") Integer id,
            @RequestBody Map<String, String> body,
            HttpSession session) {

        User currentUser = (User) session.getAttribute("currentUser");
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("กรุณาเข้าสู่ระบบ");

        Optional<Document> docOpt = documentRepository.findById(id);
        if (docOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("ไม่พบเอกสาร");

        Document doc = docOpt.get();
        boolean isStaff = "STAFF".equals(currentUser.getRole());
        boolean isAssignee = doc.getAssignedTo() != null && doc.getAssignedTo().equals(currentUser.getId());

        if (!isStaff && !isAssignee) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("เฉพาะผู้รับผิดชอบหรือเจ้าหน้าที่เท่านั้นที่ปรับกำหนดเวลาได้");
        }

        String newDeadline = body.get("deadline");
        if (newDeadline == null || newDeadline.isBlank()) {
            return ResponseEntity.badRequest().body("กรุณาระบุวันที่กำหนดเสร็จใหม่");
        }

        String oldDeadline = doc.getDeadline() != null ? doc.getDeadline() : "ไม่ได้ระบุ";
        doc.setDeadline(newDeadline);
        doc.setUpdatedAt(LocalDateTime.now());
        documentRepository.save(doc);

        // บันทึกประวัติการปรับกำหนดเวลา (FR7 & FR8)
        documentHistoryRepository.save(new DocumentHistory(
                doc.getDocumentId(),
                "ปรับกำหนดเสร็จ (Deadline) เป็น " + newDeadline,
                currentUser.getFullName(),
                "กำหนดเดิม: " + oldDeadline
        ));

        return ResponseEntity.ok(doc);
    }

    // 6. ดึงประวัติการดำเนินการของเอกสาร (FR7)
    @GetMapping("/{id}/history")
    public ResponseEntity<?> getDocumentHistory(@PathVariable("id") Integer id, HttpSession session) {
        User currentUser = (User) session.getAttribute("currentUser");
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("กรุณาเข้าสู่ระบบ");

        List<DocumentHistory> historyList = documentHistoryRepository.findByDocumentIdOrderByActionTimeDesc(id);
        return ResponseEntity.ok(historyList);
    }

    // 7. ฟังก์ชันยกเลิกเอกสาร (Soft Delete - Staff เห็น / อาจารย์ไม่เห็น)
    @PatchMapping("/{id}/cancel")
    public ResponseEntity<?> cancelDocument(@PathVariable("id") Integer id, HttpSession session) {
        User currentUser = (User) session.getAttribute("currentUser");
        
        if (currentUser == null || !"STAFF".equals(currentUser.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("เฉพาะเจ้าหน้าที่เท่านั้นที่สามารถยกเลิกเอกสารได้");
        }

        Optional<Document> docOpt = documentRepository.findById(id);
        if (docOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("ไม่พบเอกสาร");

        Document doc = docOpt.get();
        doc.setIsDeleted(true);
        doc.setStatus("CANCELED"); 
        doc.setCurrentStatus("ยกเลิกแล้ว");
        doc.setUpdatedAt(LocalDateTime.now());
        documentRepository.save(doc);

        documentHistoryRepository.save(new DocumentHistory(
                doc.getDocumentId(),
                "ยกเลิกเอกสาร",
                "เจ้าหน้าที่ (" + currentUser.getFullName() + ")",
                null
        ));

        return ResponseEntity.ok("ยกเลิกเอกสารสำเร็จ");
    }

    // 8. ฟังก์ชันดาวน์โหลดไฟล์แนบจาก S3 (อัปเกรดความปลอดภัยสูงสุดสำหรับ V4)
    @GetMapping("/{id}/download")
    public ResponseEntity<?> downloadAttachment(@PathVariable Integer id, HttpSession session) {
        // ด่านที่ 1: ตรวจสอบว่าล็อกอินอยู่ในระบบหรือไม่
        User currentUser = (User) session.getAttribute("currentUser");
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("กรุณาเข้าสู่ระบบก่อนดาวน์โหลดไฟล์แนบ");
        }

        Optional<Document> docOpt = documentRepository.findById(id);
        if (docOpt.isEmpty() || docOpt.get().getAttachmentFile() == null || docOpt.get().getAttachmentFile().isBlank()) {
            return ResponseEntity.notFound().build();
        }

        Document doc = docOpt.get();

        // ด่านที่ 2: ถ้าเป็นเอกสารที่ถูกยกเลิกไปแล้ว ห้ามอาจารย์ดาวน์โหลด
        if (Boolean.TRUE.equals(doc.getIsDeleted()) && !"STAFF".equals(currentUser.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("เอกสารนี้ถูกยกเลิกแล้ว");
        }

        // 🌟 ด่านที่ 3 (เพิ่มใหม่): ตรวจสอบสิทธิ์การเข้าถึงเอกสารเฉพาะบุคคล (Prevent Unauthorized Access)
        boolean isStaff = "STAFF".equals(currentUser.getRole());
        boolean isPublicDoc = (doc.getAssignedTo() == null);
        boolean isAssignee = (doc.getAssignedTo() != null && doc.getAssignedTo().equals(currentUser.getId()));
        boolean isForwarder = (doc.getForwardedBy() != null && doc.getForwardedBy().equals(currentUser.getId()));
        boolean isInHistory = documentHistoryRepository.findByDocumentIdOrderByActionTimeDesc(id)
                .stream()
                .anyMatch(h -> h.getActionBy() != null && h.getActionBy().contains(currentUser.getFullName()));

        if (!isStaff && !isPublicDoc && !isAssignee && !isForwarder && !isInHistory) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("คุณไม่มีสิทธิ์ดาวน์โหลดไฟล์แนบของเอกสารนี้ (เฉพาะผู้รับผิดชอบที่เกี่ยวข้องเท่านั้น)");
        }

        String fileKey = doc.getAttachmentFile().trim();

        try {
            if (fileKey.startsWith("http://") || fileKey.startsWith("https://")) {
                return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(fileKey)).build();
            }

            // ให้ S3Service สร้างลิงก์ชั่วคราวจาก S3 ให้
            String presignedUrl = s3Service.generatePresignedUrl(fileKey);

            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(presignedUrl))
                    .build();

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("เกิดข้อผิดพลาดในการสร้างลิงก์ดาวน์โหลด: " + e.getMessage());
        }
    }
}