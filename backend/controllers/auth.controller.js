import { generateTokenAndSetCookie } from "../lib/utils/generateToken.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";

export const signup = async (req, res) => {
    try {
        const { fullName, username, email, password } = req.body; //รับค่าจากผู้ใช้

        // เช็คความถูกต้องของอีเมล
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; //ตรวจสอบ email ว่าถูกต้องหรือไม่
        if(!emailRegex.test(email)) { 
            return res.status(400).json({ error: "Invalid email format" });
        }

        // ตรวจจับหา username ที่ซำ้
        const existingUser = await User.findOne({ username }); //หา username ในฐานข้อมูล
        if (existingUser) { //ถ้ามี username ในฐานข้อมูล(ซ้ํา)
            return res.status(400).json({ error: "Username is already taken" }); //ส่ง error ไปยัง client
        }

        // ตรวจจับหา email ที่ซ้ํา
        const existingEmail = await User.findOne({ email }); //หา email ในฐานข้อมูล
        if (existingEmail) { //ถ้ามี email ในฐานข้อมูล
            return res.status(400).json({ error: "Email is already taken" }); //ส่ง error ไปยัง client
        }

        // ตรวจสอบ password ว่ามีความยาวไม่น้อยกว่า 6 หรือไม่
        if (password.length < 6) { //ตรวจสอบ password ว่ามีความยาวไม่น้อยกว่า 6 หรือไม่
            return res.status(400).json({ error: "Password must be at least 6 characters long" });
        }

        // แปลง password ให้เป็นค่าที่อ่านไม่ได้
        const salt = await bcrypt.genSalt(10); //สร้าง salt (ค่าพิเศษเพื่อเพิ่มความปลอดภัย)
        const hashedPassword = await bcrypt.hash(password, salt);  //เรียกใช้ bcrypt เพื่อเข้ารหัส password แบบ salt

        //สร้าง User ใหม่ 
        const newUser = new User({ 
            fullName,
            username,
            email,
            password: hashedPassword //เก็บ password แบบ Hash (รหัสที่ถูกแปลงรหัสแล้ว)
        })

        //ถ้าสร้าง user สําเร็จ
        if(newUser) { 
            generateTokenAndSetCookie(newUser._id, res) //เรียกใช้ฟังก์ชั่น generateTokenAndSetCookie เพื่อสร้าง token โดยใช้ id ของ user
            await newUser.save(); //บันทึก user ในฐานข้อมูล

            res.status(201).json({ //ส่งข้อมูลผู้ใช้กลับไปให้ Client
                _id: newUser._id,
                fullName: newUser.fullName,
                username: newUser.username,
                email: newUser.email,
                followers: newUser.followers,
                following: newUser.following,
                profileImg: newUser.profileImg,
                coverImg: newUser.coverImg
            })
        } else { //ถ้าสร้าง user ไม่สําเร็จ
            res.status(400).json({ error: "Invalid user data" });
        }
    } catch (error) {
        console.log("Error in signup controller", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const login = async (req, res) => {
    try {
        const { username, password } = req.body; //รับ username,password จาก client 
        const user = await User.findOne({ username }); //หา username ในฐานข้อมูล
        const isPasswordCorrect = await bcrypt.compare(password, user?.password || ""); //compare = ตรวจสอบ password ผ่านการ hash ว่าตรงกันไหม
        // user?.password || "" = ตรวจสอบว่า user มีค่าอยู่หรือไม่ , ถ้า user มีค่า → ดึง password จากฐานข้อมูล , ถ้า user เป็น null หรือ undefined = ใช้ "" เพื่อป้องกันการ error

        if(!user || !isPasswordCorrect) { //ถ้าไม่มี username ในฐานข้อมูล หรือ รหัสผ่านผิด
            return res.status(400).json({ error: "Invalid username or password" }); //ส่ง error ไปยัง client
        }

        generateTokenAndSetCookie(user._id, res); //เรียกใช้ฟังก์ชั่น generateTokenAndSetCookie เพื่อสร้าง token โดยใช้ id ของ user

        res.status(200).json({ //ส่งข้อมูล user ไปยัง client ||  React.js จะนำข้อมูลนี้ไปแสดงในโปรไฟล์ผู้ใช้
            _id: user._id,
            fullName: user.fullName,
            username: user.username,
            email: user.email,
            followers: user.followers,
            following: user.following,
            profileImg: user.profileImg,
            coverImg: user.coverImg
        });
    } catch (error) {
        console.log("Error in login controller", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const logout = async (req, res) => {
    try {
        res.cookie("jwt", "", { maxAge: 0 }); //ลบ JWT ออกจาก cookie ||  ตั้งค่า jwt Cookie ให้เป็น "" (ค่าว่าง) ||  ตั้งค่า { maxAge: 0 } → ทำให้ Cookie หมดอายุทันที
        res.status(200).json({ message: "Logged out successfully" }); 
    } catch (error) {
        console.log("Error in logout controller", error.message);
        res.status(500).json({ error: "Internal server error" });
        //สรุป 
        //  Browser ลบ Cookie jwt ออกจากระบบ
        //  API ที่ใช้ protectRoute ไม่สามารถเข้าถึงได้
    }
};

export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("-password"); //หา user ในฐานข้อมูล โดยใช้ id ของ user ที่ได้จาก token
        res.status(200).json(user);
    } catch (error) {
        console.log("Error in getMe controller", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
}