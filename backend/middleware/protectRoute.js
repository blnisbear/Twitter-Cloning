import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

export const protectRoute = async (req, res, next) => {
    try {
        const token = req.cookies.jwt; //รับ token จาก cookie ของผู้ใช้
        if(!token) { //ถ้าไม่มี
            return res.status(401).json({ error: "Unauthorized: No Token Provided" }); //error แสดงข้อความ
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET); //ถอดรหัส 

        if(!decoded) { //ถ้าไม่ถูกต้อง
            return res.status(401).json({ error: "Unauthorized: Invalid Token" }); //error แสดงข้อความ
        }

        const user = await User.findById(decoded.userId).select("-password"); //ค้นหาผู้ใช้จาก userId ที่ได้จาก JWT Token || select("-password") → ไม่ดึงรหัสผ่านมาเพื่อความปลอดภัย

        if(!user) { //ถ้าไม่มีผู้ใช้อยู่ในฐานข้อมูล
            return res.status(401).json({ error: "Unauthorized: User not found" }); //error แสดงข้อความ
        }        

        req.user = user; //บันทึกข้อมูลผู้ใช้ลงใน req.user เพื่อใช้ใน API ถัดไป
        next(); //เรียก next เพื่อให้ API ถัดไปทำงานต่อ
    } catch (error) { //ถ้ามี error
        console.log("Error in protectRoute middleware", error.message); //แสดงข้อความ
        res.status(500).json({ error: "Internal server error" });
    }
};

//ภาพรวม 
    // ตรวจสอบว่ามี JWT Token ใน Cookie หรือไม่
    // ถอดรหัส (Verify) JWT Token
    // ค้นหาผู้ใช้ในฐานข้อมูล MongoDB
    // ถ้าถูกต้อง → ให้ผ่านไปที่ API ถัดไป
    // ถ้าไม่ถูกต้อง → บล็อกการเข้าถึงด้วย 401 Unauthorized