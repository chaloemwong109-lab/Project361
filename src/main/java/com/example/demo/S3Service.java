package com.example.demo;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.IOException;
import java.time.Duration;
import java.util.UUID;

@Service
@Configuration
public class S3Service {

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    @Value("${aws.region:us-east-1}")
    private String region;

    // สร้าง Bean สำหรับ S3Client โดยดึงสิทธิ์จาก LabInstanceProfile (IAM Role บน EC2) อัตโนมัติ
    @Bean
    public S3Client s3Client() {
        return S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
    }

    public String uploadFile(MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            return null;
        }

        // 1. ดึงชื่อไฟล์เดิม และสร้างรหัสสุ่ม UUID นำหน้า
        String originalFilename = file.getOriginalFilename();
        String uniqueFileName = UUID.randomUUID().toString() + "_" + originalFilename;

        // 2. เตรียมคำสั่งและเป้าหมายสำหรับวางไฟล์ใน Bucket ใหม่ผ่านตัวแปร bucketName
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(uniqueFileName)
                .build();

        // 3. ยิงไฟล์ขึ้น S3
        s3Client().putObject(putObjectRequest, RequestBody.fromBytes(file.getBytes()));

        // 4. ส่งคืนชื่อไฟล์ใหม่กลับไปให้ Controller เอาไปเก็บลงฐานข้อมูล MySQL
        return uniqueFileName;
    }

    // 5. ดึงไฟล์จาก S3 มาดาวน์โหลดลงเครื่อง
    public byte[] downloadFile(String fileName) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(fileName)
                .build();

        ResponseBytes<GetObjectResponse> objectBytes = s3Client().getObjectAsBytes(getObjectRequest);
        return objectBytes.asByteArray();
    }

    // 6. สร้าง Presigned URL สำหรับเปิดดูหรือดาวน์โหลดไฟล์จาก S3 (อายุ 30 วินาที)
    public String generatePresignedUrl(String fileName) {
        S3Presigner presigner = S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();

        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(fileName)
                .build();

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofSeconds(30))
                .getObjectRequest(getObjectRequest)
                .build();

        String url = presigner.presignGetObject(presignRequest).url().toString();
        presigner.close();
        return url;
    }

}