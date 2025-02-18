import bcrypt from "bcryptjs";
import { v2 as cloudinary } from "cloudinary";

import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";

export const getUserProfile = async (req, res) => {
    const { username } = req.params;

    try {
        const user = await User.findOne({ username }).select("-password");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.status(200).json(user);
    } catch (error) {
        console.log("Error in getUserProfile:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export const followUnfollowUser = async (req, res) => {
    try {
        const { id } = req.params; //ค่าที่มาจาก url (:userId)
        const userToModify = await User.findById(id); //ผู้ใช้ที่ต้องการติดตาม/เลิกติดตาม (id)
        const currentUser = await User.findById(req.user._id); //ผู้ใช้ที่ล็อกอินอยู่

        //ตรวจสอบว่าผู้ใช้กำลังติดตามตัวเองหรือไม่
        if(id === req.user._id.toString()) { //id = id ของผู้ใช้ที่ต้องการติดตาม / เลิกติดตาม , req.user._id = id ของผู้ใช้ที่ล็อคอินอยู่ โดยที่
            //ต้องการตรวจสอบว่า ผู้ใช้กำลังติดตามตัวเองหรือไม่
            return res.status(400).json({ error: "You can't follow/unfollow yourself" });
        }

        // ตรวจสอบว่า userToModify หรือ currentUser ไม่เป็น null
        if (!userToModify || !currentUser) return res.status(404).json({ error: "User not found" });

        //ตรวจสอบว่าผู้ใช้ติดตาม (id) อยู่หรือไม่
        const isFollowing = currentUser.following.includes(id); //เช็คว่า ผู้ใช้ที่ล็อคอินอยู่ ได้ติดตาม userToModify (id) หรือไม่

        if (isFollowing) { //ถ้าติดตามอยู่แล้ว
            // unfollow
            await User.findByIdAndUpdate(id, { $pull: { followers: req.user._id } }); //pull(ลบ) - userToModify.followers 👉 ลบ _id ของ currentUser ออก
            await User.findByIdAndUpdate(req.user._id, { $pull: { following: id } }); //pull(ลบ) - currentUser.following 👉 ลบ _id ของ userToModify ออก
            //send notification to user
            res.status(200).json({ message: "User Unfollowed successfully" });
        } else {
            // follow
            await User.findByIdAndUpdate(id, { $push: { followers: req.user._id } }); //push(เพิ่ม) - userToModify.followers 👉 เพิ่ม _id ของ currentUser ไป
            await User.findByIdAndUpdate(req.user._id, { $push: { following: id } }); //push(เพิ่ม) - currentUser.following 👉 เพิ่ม _id ของ userToModify ไป
            //send notification to user
            const newNotification = new Notification({ //สร้าง notification collection ใหม่
                type: "follow", 
                from: req.user._id, // _id ของผู้ใช้ที่ล็อกอินอยู่
                to: userToModify._id // _id ของผู้ใช้ที่ต้องการติดตาม/เลิกติดตาม
            });

            await newNotification.save(); //บันทึก notification ในฐานข้อมูล

            res.status(200).json({ message: "User Followed successfully" }); //ส่งข้อมูลไปยัง client
        }
    } catch (error) {
        console.log("Error in followUnfollowUser: ", error.message);
        res.status(500).json({ error: error.message });
    }
}

export const getSuggestedUsers = async (req, res) => { 
    //ฟังก์ชั่นแนะนำผู้ใช้ โดยสุ่มข้อมูลจากฐานข้อมูล และกรอกเอาผู้ใช้ที่ currentUser ติดตามอยู่แล้วออกไป
    try {
        const userId = req.user._id; //รับ id ของ user ที่กำลังใช้งาน

        const usersFollowedByMe = await User.findById(userId).select("following"); //ดึงรายชื่อที่ผู้ใช้ กำลังติดตาม

        //สุ่มผู้ใช้
        const users = await User.aggregate([ 
            {
                $match: { //$match 👉 กรองเอาผู้ใช้ที่ _id ไม่เท่ากับ userId ออก = ดึงข้อมูลผู้ใช้ที่ไม่ใช่ตัวเองออกมา
                    _id: { $ne: userId }, 
                },
            },
            {$sample:{size: 10}}, //สุ่มเอา 10 คน
        ])

        const filteredUsers = users.filter(user => !usersFollowedByMe.following.includes(user._id)); //ลบผู้ใช้ที่ currentUser ติดตามออก
        const suggestedUsers = filteredUsers.slice(0, 4); //เอา 4 คนแรก

        suggestedUsers.forEach((user) => (user.password = null)); //เอา password ออก

        res.status(200).json(suggestedUsers); //ส่งข้อมูลไปยัง client
    } catch (error) {
        console.log("Error in getSuggestedUsers: ", error.message);
        res.status(500).json({ error: error.message });
    }
}

export const updateUser = async (req, res) => {
    const { fullName, email, username, currentPassword, newPassword, bio, link } = req.body;
    let { profileImg, coverImg } = req.body; //ใช้ let เพื่อให้สามารถเปลี่ยนแปลงค่าได้

    const userId = req.user._id; //ใช้ id ของ user ที่ล็อคอินอยู่

    try {
        //ตรวจสอบการล็อกอินและหาผู้ใช้ในฐานข้อมูล
        let user = await User.findById(userId); //หาผู้ใช้ที่กำลังล็อคอินอยู่ โดยไปหาในระบบฐานข้อมูล
        if(!user) return res.status(404).json({ message: "User not found" }); //ถ้าไม่มี user ในฐานข้อมูล ให้ส่ง error

        //ตรวจสอบและเปลี่ยนรหัสผ่าน (ถ้าไม่มีค่าใดค่าหนึ่ง)
        if((!newPassword && currentPassword) || (!currentPassword && newPassword)) { //ถ้าไม่มี newPassword และ currentPassword หรือไม่มี currentPassword และ newPassword
            return res.status(400).json({ error: "Please provide both current password and new password" }); //ส่ง error ไปยัง client
        }

        //ตรวจสอบและเปลี่ยนรหัสผ่าน (ถ้ามีค่าทั้งคู่)
        if(currentPassword && newPassword) { 
            //นำ
            const isMatch = await bcrypt.compare(currentPassword, user.password); 

            //ถ้าพาสเวิร์ดที่ผู้ใช้กรอกเข้ามา กับ password ในฐานข้อมูล ไม่ตรงกัน
            if(!isMatch) return res.status(400).json({ error: "Current password is incorrect" }); 
            
            //จำนวนพาสเวิร์ดน้อยกว่า 6 ตัว
            if(newPassword.length < 6) { //ตรวจสอบ newPassword ว่ามีความยาวไม่น้อยกว่า 6 หรือไม่
                return res.status(400).json({ error: "New password must be at least 6 characters long" }); 
            }

            //ป้องกันการอ่านค่าของรหัสผ่าน
            const salt = await bcrypt.genSalt(10); //สร้าง salt 10 ตัว
            user.password = await bcrypt.hash(newPassword, salt); //เรียกใช้ bcrypt เพื่อเข้ารหัส newPassword แบบ salt และเก็บ password ในฐานข้อมูล
        }

        //อัปโหลดและจัดการรูปภาพ
        if(profileImg) { //ถ้ามี profileImg
            if(user.profileImg) { //ถ้าผู้ใช้มีรูปโปรไฟล์เดิม
                await cloudinary.uploader.destroy(user.profileImg.split("/").pop().split(".")[0]); //ลบรูปเดิมออกจาก Cloudinary ( cloudinary.uploader.destroy ) 
            }

            const uploadedResponse = await cloudinary.uploader.upload(profileImg);  //อัปโหลดรูปใหม่  
            profileImg = uploadedResponse.secure_url; //บันทึก URL ของรูปภาพที่อัปโหลด (จาก uploadedResponse.secure_url)
            
        }

        ////อัปโหลดและจัดการรูปภาพปห
        if(coverImg) { //ถ้ามี coverImg
            if(user.coverImg) { //ถ้าผู้ใช้มีรูปปกเดิม
                await cloudinary.uploader.destroy(user.coverImg.split("/").pop().split(".")[0]); //ลบรูปเดิมออกจาก Cloudinary ( cloudinary.uploader.destroy ) 
            }

            const uploadedResponse = await cloudinary.uploader.upload(coverImg); //อัปโหลดรูปปกใหม่  
            coverImg = uploadedResponse.secure_url; //บันทึก URL ของรูปภาพที่อัปโหลด (จาก uploadedResponse.secure_url)
        }

        //อัปเดตข้อมูลที่ได้รับจาก req.body ถ้าค่าที่รับเข้ามาเป็น null หรือ undefined ให้ใช้ค่าปัจจุบันแทน
        user.fullName = fullName || user.fullName;
        user.email = email || user.email;
        user.username = username || user.username;
        user.bio = bio || user.bio;
        user.link = link || user.link;
        user.profileImg = profileImg || user.profileImg;
        user.coverImg = coverImg || user.coverImg;

        user = await user.save(); //บันทึกข้อมูลที่อัปเดตลงฐานข้อมูล MongoDB

        user.password = null; //ลบข้อมูลรหัสผ่านออกจากผลลัพธ์ที่ส่งกลับไปยัง Client

        return res.status(200).json(user); // ส่งข้อมูลผู้ใช้กลับไปให้ Client แบบ json
    } catch (error) {
        console.log("Error in updateUser: ", error.message); //ถ้าเกิดข้อผิดพลาด
        res.status(500).json({ error: error.message }); //ส่ง error กลับไปให้ Client
    }
}