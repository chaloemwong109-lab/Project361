package com.example.demo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpSession;
import java.util.Optional;
import java.util.Map;
import java.util.HashMap;
import java.util.List;

@RestController
@RequestMapping("/api")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    // API เข้าสู่ระบบ
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body, HttpSession session) {
        String username = body.get("username");
        String password = body.get("password");

        Optional<User> userOpt = userRepository.findByUsername(username);

        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (user.getPassword().equals(password)) {
                // บันทึกสถานะผู้ใช้งานลงใน Session
                session.setAttribute("currentUser", user);

                Map<String, Object> res = new HashMap<>();
                res.put("id", user.getId());
                res.put("username", user.getUsername());
                res.put("fullName", user.getFullName());
                res.put("role", user.getRole());
                return ResponseEntity.ok(res);
            }
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    }

    // API ออกจากระบบ
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok("Logged out");
    }

    // API ตรวจสอบข้อมูลผู้ใช้ปัจจุบันที่กำลังล็อกอินอยู่
    @GetMapping("/current-user")
    public ResponseEntity<?> getCurrentUser(HttpSession session) {
        User user = (User) session.getAttribute("currentUser");
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("ยังไม่ได้เข้าสู่ระบบ");
        }
        Map<String, Object> res = new HashMap<>();
        res.put("id", user.getId());
        res.put("username", user.getUsername());
        res.put("fullName", user.getFullName());
        res.put("role", user.getRole());
        return ResponseEntity.ok(res);
    }

    // API สำหรับให้ Staff ดึงรายชื่ออาจารย์ไปแสดงใน Dropdown ผู้รับผิดชอบ
    @GetMapping("/lecturers")
    public ResponseEntity<?> getLecturers() {
        List<User> lecturers = userRepository.findByRole("LECTURER");
        return ResponseEntity.ok(lecturers);
    }
}