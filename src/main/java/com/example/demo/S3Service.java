package com.example.demo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.UUID;

@Service
public class S3Service {

    @Autowired
    private S3Client s3Client;

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    public String uploadFile(MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            return null;
        }

        // 1. ดึงชื่อไฟล์เดิม และสร้างรหัสสุ่ม UUID นำหน้า
        String originalFilename = file.getOriginalFilename();
        String uniqueFileName = UUID.randomUUID().toString() + "_" + originalFilename;

        // 2. เตรียมคำสั่งและเป้าหมายสำหรับวางไฟล์ใน Bucket
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket("cs261-edocflow-storage-tu")
                .key(uniqueFileName)
                .build();

        // 3. ยิงไฟล์ขึ้น S3
        s3Client.putObject(putObjectRequest, RequestBody.fromBytes(file.getBytes()));

        // 4. ส่งคืนชื่อไฟล์ใหม่กลับไปให้ Controller เอาไปเก็บลงฐานข้อมูล MySQL
        return uniqueFileName;
    }

    // 🌟 5. เพิ่มฟังก์ชันดึงไฟล์จาก S3 มาดาวน์โหลดลงเครื่อง
    public byte[] downloadFile(String fileName) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket("cs261-edocflow-storage-tu")
                .key(fileName)
                .build();

        ResponseBytes<GetObjectResponse> objectBytes = s3Client.getObjectAsBytes(getObjectRequest);
        return objectBytes.asByteArray();
    }

    // สร้าง Presigned URL สำหรับดาวน์โหลดไฟล์จาก S3 (อายุ 5 นาที)
    public String generatePresignedUrl(String fileName) {
        software.amazon.awssdk.services.s3.presigner.S3Presigner presigner = 
            software.amazon.awssdk.services.s3.presigner.S3Presigner.builder()
                .region(s3Client.serviceClientConfiguration().region()) // 👈 ดึง Region เดียวกับตอนอัปโหลดอัตโนมัติ!
                .credentialsProvider(s3Client.serviceClientConfiguration().credentialsProvider())
                .build();

        software.amazon.awssdk.services.s3.model.GetObjectRequest getObjectRequest = 
            software.amazon.awssdk.services.s3.model.GetObjectRequest.builder()
                .bucket("cs261-edocflow-storage-tu")
                .key(fileName)
                .build();

        software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest presignRequest = 
            software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest.builder()
                .signatureDuration(java.time.Duration.ofMinutes(5))
                .getObjectRequest(getObjectRequest)
                .build();

        String url = presigner.presignGetObject(presignRequest).url().toString();
        presigner.close(); // ปิดเพื่อคืนทรัพยากร
        return url;
    }

}