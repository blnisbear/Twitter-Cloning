import Notification from "../models/notification.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { v2 as cloudinary } from "cloudinary";

export const createPost = async (req, res) => {
    try {
        const { text } = req.body;
        let { img } = req.body;
        const userId = req.user._id.toString();

        //ตรวจสอบว่าผู้ใช้มีอยู่จริงหรือไม่
        const user = await User.findById(userId);
        if(!user) return res.status(404).json({ error: "User not found" });

        //ตรวจสอบว่ามีข้อความหรือรูปภาพหรือไม่
        if(!text && !img) { //ถ้าไม่มี
            return res.status(400).json({ error: "Post must have text or image" });
        }

        if(img) { //ถ้ามี 
            const uploadResponse = await cloudinary.uploader.upload(img);// ส่งรูปภาพไปอัปโหลด
            img = uploadResponse.secure_url; //ได้ URL ของรูป จาก uploadResponse.secure_url และ แทนค่าตัวแปร img ด้วย URL ที่อัปโหลดสำเร็จ
        }

        const newPost = new Post({ //สร้าง Post ใหม่
            user: userId,
            text,
            img,
        });

        await newPost.save(); //บันทึกลงฐานข้อมูล
        res.status(201).json(newPost); //ส่ง Post ใหม่ไปยัง client
    } catch(error) {
        res.status(500).json({ error: "Internal Server Error" });
        console.log("Error in createPost controller", error);
    }
};

export const deletePost = async (req, res) => {
    try {
        const  post = await Post.findById(req.params.id); //ดึงค่า id ของโพสต์ที่ต้องการลบจาก URL Parameter
        if(!post) { //ถ้าไม่พบโพสต์
            return res.status(404).json({ error: "Post not found" });
        }

        //ตรวจสอบสิทธิ์การลบโพสต์
        if(post.user.toString() !== req.user._id.toString()) { //เปรียบเทียบ user._id (เจ้าของโพสต์) กับ req.user._id (ผู้ที่ล็อกอิน) ว่าตรงกันไหม ถ้าไม่ตรงกัน = ไม่ใช่เจ้าของโพสต์
           return res.status(401).json({ error: "You are not authorized to delete this post" }); // ส่ง error กลับไป
        }

        //ลบรูปจาก Cloudinary (ถ้ามีรูป)
        if(post.img) {
            const imgId = post.img.split("/").pop().split(".")[0]; // ดึง imgId จาก URL ของ Cloudinary || .split("/") → แยก / เอาส่วนท้ายสุด เช่น "sample.jpg" || .split(".")[0] → เอาชื่อไฟล์โดยไม่รวม .jpg เช่น "sample" 
            await cloudinary.uploader.destroy(imgId); // ลบไฟล์รูปจาก Cloudinary
        }

        //ลบโพสต์จากฐานข้อมูล
        await Post.findByIdAndDelete(req.params.id); // ลบโพสต์จาก MongoDB
        res.status(200).json({ message: "Post deleted successfully" });

    }   catch(error) {
        console.log("Error in deletePost controller", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export const commentOnPost = async (req, res) => {
    try {
        const { text } = req.body; //ข้อความของคอมเมนต์
        const postId = req.params.id; //ดึง id ของโพสต์จาก URL Parameter
        const userId = req.user._id; // ดึง user._id ของผู้ที่ล็อกอินจาก req.user
 
        //ตรวจสอบว่ามีข้อความหรือไม่ (ป้องกันการส่งคอมเมนต์เปล่า)
        if(!text) {// ถ้าไม่มีข้อความ
            return res.status(400).json({ error: "Text field is required" });
        }

        //ค้นหาโพสต์จากฐานข้อมูล
        const post = await Post.findById(postId);
        if(!post) { //ถ้า ไม่พบโพสต์
            return res.status(404).json({ error: "Post not found" });
        }

        //เพิ่มคอมเมนต์ลงในโพสต์
        const comment = {user: userId, text}; //สร้าง Object คอมเมนต์

        post.comments.push(comment); //เพิ่มคอมเมนต์ลงในโพสต์
        await post.save(); //บันทึกการคอมเมนต์ในโพสต์นั้น ลงฐานข้อมูล

        res.status(200).json(post); //ส่งโพสต์กลับไปยัง client
    }   catch(error) {
        console.log("Error in commentOnPost controller", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export const likeUnlikePost = async (req, res) => {
    try {
        const userId = req.user._id; // ดึง _id ของผู้ที่ล็อกอินจาก req.user
        const { id: postId } = req.params;  //ดึง id ของโพสต์จาก URL Parameter

        //ค้นหาโพสต์จากฐานข้อมูล
        const post = await Post.findById(postId);

        if(!post) { //ถ้าไม่พบโพสต์
            return res.status(404).json({ error: "Post not found" });
        }

        //ตรวจสอบว่าผู้ใช้กดไลก์โพสต์แล้วหรือยัง
        const userLikedPost = post.likes.includes(userId);
        if(userLikedPost) { //ถ้าผู้ใช้กดไลก์โพสต์อยู่แล้ว
            //Unlike Post
            await Post.updateOne({_id: postId}, {$pull: {likes: userId}}); //ยกเลิกไลก์โพสต์ 
            await User.updateOne({_id: userId}, {$pull: {likedPosts: postId}}); //ยกเลิกไลก์โพสต์ ในหน้าโปรไฟล์ของผู้ใช้ที่ล็อกอินอยู่(ไลค์โพสอะไรบ้าง)
            res.status(200).json({ message: "Post unliked successfully" }); //ส่ง message กลับไปยัง client
        } else { //ถ้าผู้ใช้ยังไม่ไลก์โพสต์
            //Like Post
            post.likes.push(userId); //เพิ่ม userId เข้าไปใน likes array (กดไลค์โพสต์)
            await User.updateOne({_id: userId}, {$push: {likedPosts: postId}}); //เพิ่มโพสต์ที user กดไลก์โพสต์ ในหน้าโปรไฟล์ของ user (ไลค์โพสอะไรบ้าง)
            await post.save(); // บันทึกการกดไลค์โพสต์ลงฐานข้อมูล

            //สร้าง Notification เมื่อกดไลก์
            const notification = new Notification({ //สร้าง Object Notification
                from: userId, // ใครเป็นคนกดไลก์
                to: post.user, //เจ้าของโพสต์ได้รับ Notification
                type: "like", // ประเภท Notification like
            });

            await notification.save(); //บันทึก Notification ลงฐานข้อมูล

            res.status(200).json({ message: "Post liked successfully" });
        }

    }   catch(error) {
        console.log("Error in likeUnlikePost controller", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export const getAllPosts = async (req, res) => {
    //ดึงโพสต์ทั้งหมด จากฐานข้อมูล โดยเรียงลำดับจาก ใหม่ไปเก่า และดึงข้อมูลของ ผู้ใช้ และ คอมเมนต์ของแต่ละโพสต์ มาแสดงโดยใช้ populate()
    try {
        const posts = await Post.find() //Post.find() = ดึงโพสต์ทั้งหมด
        .sort({ createdAt: -1 }) // .sort({ createdAt: -1 }) = เพื่อเรียงโพสต์ตาม createdAt (-1 = ใหม่ → เก่า || 1 = เก่า → ใหม่)
        .populate({ //ใช้ populate() เพื่อดึงข้อมูลของผู้ใช้
            path: "user", //ดึงข้อมูลของ ผู้ที่โพสต์
            select: "-password", // ไม่ดึง รหัสผ่าน 
        })
        .populate({ //ใช้ populate() เพื่อดึงข้อมูลคอมเมนต์
            path: "comments.user", //ดึงข้อมูลของ ผู้ที่คอมเมนต์
            select: "-password", // ไม่ดึง รหัสผ่าน
        })

        //ตรวจสอบว่ามีโพสต์หรือไม่
        if(posts.length === 0) { // ถ้าไม่มีโพสต์
            return res.status(200).json([]); //ส่ง [] (Array ว่าง) กลับไป
        }

        res.status(200).json(posts);
    }   catch(error) {
        console.log("Error in getAllPosts controller: ", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export const getLikedPosts = async (req, res) => {
    const userId = req.params.id; //ดึง _id ของผู้ใช้จาก req.params.id ซึ่งมากจาก URL ที่เรียก API

    try {
        const user = await User.findById(userId); //ดึงข้อมูลผู้ใช้จากฐานข้อมูล
        if(!user) { //ถ้าไม่พบผู้ใช้
            return res.status(404).json({ error: "User not found" });
        }

        // ค้นหาโพสต์ที่ผู้ใช้กดไลก์
        const likedPosts = await Post.find({_id: {$in: user.likedPosts}})  //ดึงโพสต์ที่ผู้ใช้กดไลก์
        .populate({ //ดึงข้อมูลเจ้าของโพสต์ (ไม่ระบุ password)
            path: "user",
            select: "-password"
        }).populate({ // ดึงข้อมูลผู้ที่คอมเมนต์ (ไม่ระบุ password)
            path: "comments.user",
            select: "-password"
        });

        res.status(200).json(likedPosts); //ส่งโพสต์ที่ผู้ใช้กดไลก์กลับไปที่ client
    }   catch(error) {
        console.log("Error in getLikedPosts controller: ", error);
        res.status(500).json({error: "Internal server error"})
    }
}

export const getFollowingPosts = async (req, res) => {
    //หน้า Feed  ดึงโพสต์ทั้งหมดที่ user ติดตาม
    try {
        const userId = req.user._id; // ดึง _id ของผู้ใช้ที่ล็อคอินอยู่
        const user = await User.findById(userId); //ค้นหาข้อมูลของผู้ใช้
        if(!user) return res.status(404).json({ error: "User not found" }); //ถ้าไม่พบ

        //ดึงรายชื่อคนที่ user กำลังติดตามอยู่
        const following = user.following;

        //ค้นหาโพสต์ของผู้ใช้ที่เราติดตาม
        const feedPosts = await Post.find({user: { $in: following }}) // หมายความว่า "ค้นหาโพสต์ที่ user กำลังติดตามอยู่             .sort({ createdAt: -1 }) // เรียงโพสต์ตาม createdAt จากใหม่ไปเก่า
            .populate({ //ใช้ populate() เพื่อดึงข้อมูลของผู้ใช้
                path: "user",
                select: "-password",
            })
            .populate({ //ใช้ populate() เพื่อดึงข้อมูลคอมเมนต์
                path: "comments.user",
                select: "-password",
            });

            res.status(200).json(feedPosts); //ส่งโพสต์ของผู้ใช้ที่เราติดตามกลับไปที่ Client
    }   catch(error) {
        console.log("Error in getFollowingPosts controller: " , error);
        res.status(500).json({ error: "Internal server error "});
    }
}

export const getUserPosts = async (req, res) => {
    // ดึงโพสต์ทั้งหมดของ user (หน้า Timeline)
    try {
        const { username } = req.params; //ดึง username จาก req.params || ถ้า request เป็น /api/posts/user/john_doe || username = "john_doe"

        //ค้นหาผู้ใช้
        const user = await User.findOne({ username }); //ค้นหา ผู้ใช้ในฐานข้อมูลที่มี username ตรงกับค่าที่รับมา
        if(!user) return res.status(404).json({ error: "User not found" }); 

        //ค้นหาโพสต์ทั้งหมดที่ user เป็นเจ้าของ
        const posts = await Post.find({ user: user._id })
            .sort({ createdAt: -1 }) // เรียงโพสต์ตาม createdAt จากใหม่ไปเก่า
            .populate({ //ใช้ populate() เพื่อดึงข้อมูลของผู้ใช้
                path: "user",
                select: "-password",
            })
            .populate({ //ใช้ populate() เพื่อดึงข้อมูลคอมเมนต์
                path: "comments.user",
                select: "-password",
            });

        res.status(200).json(posts); //ส่งโพสต์กลับไปยัง client
    } catch (error) {
        console.log("Error in getUserPosts controller: ", error);
        res.status(500).json({ error: "Internal server error" });
    }
}