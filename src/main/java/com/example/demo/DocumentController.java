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
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private S3Service s3Service;

    @Autowired
    private DocumentTypeRepository documentTypeRepository;

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
           docs = documentRepository.findAll();;
        } else {
            // ถ้าเป็นอาจารย์/เจ้าหน้าที่ทั่วไป ให้เห็นเฉพาะเอกสารทั่วไป + เอกสารที่ได้รับมอบหมาย
            docs = documentRepository.findVisibleDocumentsForUser(currentUser.getId());
        }

        return ResponseEntity.ok(docs);
    }

    // 2. ลงทะเบียนเอกสารใหม่ (รองรับการแนบไฟล์ S3 และการระบุ assignedTo)
    @PostMapping
    public ResponseEntity<?> createDocument(
            @RequestParam("referenceNumber") String referenceNumber,
            @RequestParam("subject") String subject,
            @RequestParam("senderName") String senderName,
            @RequestParam("documentDate") String documentDate,
            @RequestParam("submissionChannel") String submissionChannel,
            @RequestParam(value = "typeId", required = false) Integer typeId,
            @RequestParam(value = "assignedTo", required = false) Long assignedTo,
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
            doc.setDocumentDate(documentDate);
            doc.setSubmissionChannel(submissionChannel);
            doc.setTypeId(typeId);
            doc.setAssignedTo(assignedTo); // null = เอกสารทั่วไป, มีค่า = มอบหมายให้อาจารย์
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
            return ResponseEntity.ok(savedDoc);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("เกิดข้อผิดพลาดในการบันทึกเอกสาร: " + e.getMessage());
        }
    }

    // 3. ปรับสถานะเอกสาร (สำหรับผู้รับผิดชอบ หรือ Staff)
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
            return ResponseEntity.ok(doc);
        }

        return ResponseEntity.badRequest().body("รูปแบบสถานะไม่ถูกต้อง");
    }
    // 4. ฟังก์ชันส่งต่อเอกสาร (Forward)
    @PatchMapping("/{id}/forward")
    public ResponseEntity<?> forwardDocument(
            @PathVariable("id") Integer id,
            @RequestBody Map<String, Long> body,
            HttpSession session) {

        User currentUser = (User) session.getAttribute("currentUser");
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("กรุณาเข้าสู่ระบบ");

        Optional<Document> docOpt = documentRepository.findById(id);
        if (docOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("ไม่พบเอกสาร");

        Document doc = docOpt.get();

        // ตรวจสอบ: ต้องเป็นผู้ที่ได้รับมอบหมายคนปัจจุบันเท่านั้นถึงจะส่งต่อได้
        if (doc.getAssignedTo() == null || !doc.getAssignedTo().equals(currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("เฉพาะผู้รับผิดชอบปัจจุบันเท่านั้นที่สามารถส่งต่อได้");
        }

        Long newAssignee = body.get("newAssignee");
        if (newAssignee != null) {
            doc.setForwardedBy(currentUser.getId()); // จำคนส่งต่อ (คนที่ 1)
            doc.setAssignedTo(newAssignee);          // เปลี่ยนผู้รับผิดชอบเป็นคนที่ 2
            doc.setStatus("PENDING");                // 👈 ตั้งเป็น PENDING ให้คนที่ 2
            doc.setCurrentStatus("รอรับเรื่อง");       // 👈 คนที่ 2 จะเห็นว่า "รอรับเรื่อง"
            doc.setUpdatedAt(LocalDateTime.now());
            documentRepository.save(doc);
            return ResponseEntity.ok(doc);
        }

        return ResponseEntity.badRequest().body("กรุณาระบุผู้รับมอบหมายใหม่");
    }
    // 5. ฟังก์ชันยกเลิกเอกสาร (Soft Delete - Staff เห็น / อาจารย์ไม่เห็น)
    @PatchMapping("/{id}/cancel")
    public ResponseEntity<?> cancelDocument(@PathVariable("id") Integer id, HttpSession session) {
        User currentUser = (User) session.getAttribute("currentUser");
        
        // เช็คว่าเป็น STAFF เท่านั้นถึงกดยกเลิกได้
        if (currentUser == null || !"STAFF".equals(currentUser.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("เฉพาะเจ้าหน้าที่เท่านั้นที่สามารถยกเลิกเอกสารได้");
        }

        Optional<Document> docOpt = documentRepository.findById(id);
        if (docOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("ไม่พบเอกสาร");

        Document doc = docOpt.get();
        doc.setIsDeleted(true); // ทำเครื่องหมาย Soft Delete
        doc.setStatus("CANCELED"); 
        doc.setCurrentStatus("ยกเลิกแล้ว"); // เปลี่ยนสถานะให้ Staff เห็น
        doc.setUpdatedAt(LocalDateTime.now());
        documentRepository.save(doc);

        return ResponseEntity.ok("ยกเลิกเอกสารสำเร็จ");
    }

    // 6. ฟังก์ชันดาวน์โหลดไฟล์แนบจาก S3
   // ฟังก์ชันดาวน์โหลดไฟล์ผ่าน Presigned URL ของ S3
    @GetMapping("/{id}/download")
    public ResponseEntity<?> downloadAttachment(@PathVariable Integer id) {
        Optional<Document> docOpt = documentRepository.findById(id);
        if (docOpt.isEmpty() || docOpt.get().getAttachmentFile() == null || docOpt.get().getAttachmentFile().isBlank()) {
            return ResponseEntity.notFound().build();
        }

        String fileKey = docOpt.get().getAttachmentFile().trim();

        try {
            // ถ้าเป็น URL ภายนอกอยู่แล้ว ให้ Redirect ไปได้เลย
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