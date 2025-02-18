import jwt from "jsonwebtoken";

export const generateTokenAndSetCookie = (userId, res) => { //รับ id ของ user 
    const token = jwt.sign({ userId }, //สร้าง token จาก id ของ user
        process.env.JWT_SECRET, { //รับ secret จาก .env
        expiresIn: "15d", //token จะหมดอายุใน 15 วัน
        }
    );

    res.cookie("jwt", token, { //สร้าง cookie จาก token
        maxAge: 15 * 24 * 60 * 60 * 1000, //หมดอายุใน 15 วัน
        httpOnly: true, //ป้องกันการเข้าถึง cookie จาก javascript
        sameSite: "strict", //ป้องกันการเข้าถึง cookie จาก cross-site
        secure: process.env.NODE_ENV !== "development", // เริ่มใช้ Cookie เมื่ออยู่ในโหมด production เท่านั้น
    });
};

//ภาพรวม
//Cookie ช่วยให้ React.js สามารถจดจำสถานะการล็อกอินของผู้ใช้