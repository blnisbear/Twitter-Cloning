import Notification from "../models/notification.model.js";

export const getNotifications = async (req, res) => {
    // ดึงการแจ้งเตือนของผู้ใช้ที่ล็อกอินอยู่และ อัปเดตสถานะของการแจ้งเตือนให้เป็น "อ่านแล้ว" (read: true)
    try {
        const userId = req.user._id; //ID ของผู้ใช้ที่ล็อกอินอยู่ 

        //ค้นหาการแจ้งเตือนทั้งหมดของผู้ใช้
        const notifications = await Notification.find({ to: userId }) //ค้นหาแจ้งเตือนทั้งหมด ที่ส่งถึงผู้ใช้ (to: userId)
            .populate({
                path: "from", //พร้อมกับเฉพาะฟิลด์ที่จำเป็น (user, profileImg)
                select: "username profileImg",
            })
            //อัปเดตสถานะแจ้งเตือนเป็น "อ่านแล้ว"
            await Notification.updateMany({ to: userId }, { read: true }); //อัปเดต แจ้งเตือนทั้งหมดของผู้ใช้ (to: userId) || เปลี่ยนค่า read: true เพื่อระบุว่า ผู้ใช้ได้อ่านแจ้งเตือนแล้ว


        res.status(200).json(notifications); //ส่งการแจ้งเตือนกลับไปยัง client
    }   catch (error) {
        console.log("Error in getNotifications controller: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const deleteNotifications = async (req, res) => {
    //ลบการแจ้งเตือนทั้งหมด
    try {
        const userId = req.user._id; //ID ของผู้ใช้ที่ล็อกอินอยู่

        await Notification.deleteMany({ to: userId }); //ลบการแจ้งเตือนทั้งหมด ที่ส่งถึงผู้ใช้

        res.status(200).json({ message: "Notifications deleted successfully" }); //ส่ง message กลับไปยัง client
    } catch (error) {
        console.log("Error in deleteNotifications controller: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
}

// export const deleteNotification = async (req, res) => {
        //ลบการแจ้งเตือนที่ละอัน โดยใช้ ID
//     try {
//         const notificationId = req.params.id; //ID ของการแจ้งเตือนที่ต้องการลบ
//         const userId = req.user._id; //ID ของผู้ใช้ที่ล็อกอินอยู่
//         const notification = await Notification.findById(notificationId); //ค้นหาการแจ้งเตือนที่ต้องการลบ

//         if (!notification) { //ถ้าไม่พบการแจ้งเตือนที่ต้องการลบ
//             return res.status(404).json({ error: "Notification not found" });
//         }

//         if (notification.to.toString() !== userId.toString()) { //ถ้าผู้ใช้ไม่ใช่ผู้ใช้ที่ส่งการแจ้งเตือน
//             return res.status(403).json({ error: "You are not allowed to delete this notification" });
//         }

//         await Notification.findByIdAndDelete(notificationId); //ลบการแจ้งเตือนที่ต้องการลบ
//         res.status(200).json({ message: "Notification deleted successfully" });

//     } catch (error) {
//         console.log("Error in deleteNotification controller: ", error.message);
//         res.status(500).json({ error: "Internal server error" });
//     }
// }