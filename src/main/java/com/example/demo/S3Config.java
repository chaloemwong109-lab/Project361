package com.example.demo; // เปลี่ยนให้ตรงกับชื่อ package ของคุณ

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsSessionCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
public class S3Config {

    @Value("${aws.access-key}")
    private String accessKey;

    @Value("${aws.secret-key}")
    private String secretKey;

    @Value("${aws.session-token}")
    private String sessionToken;

    @Value("${aws.region}")
    private String region;

    @Bean
    public S3Client s3Client() {
        // สำหรับบัญชี AWS Academy ต้องใช้ AwsSessionCredentials เพราะมีการบังคับใช้ Token ด้วย
        AwsSessionCredentials credentials = AwsSessionCredentials.create(accessKey, secretKey, sessionToken);
        return S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .build();
    }
}