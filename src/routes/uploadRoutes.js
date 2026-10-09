import express from "express";
import multer from "multer";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

router.post("/profile", upload.single("image"), async (req, res) => {
  try {
    console.log("Profile upload request received");

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file received",
      });
    }

    if (!process.env.IMGBB_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "IMGBB_API_KEY is missing in backend .env",
      });
    }

    console.log("Image received:", req.file.originalname);

    const base64Image = req.file.buffer.toString("base64");

    const formData = new FormData();
    formData.append("image", base64Image);

    const imgbbResponse = await fetch(
      `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
      {
        method: "POST",
        body: formData,
      }
    );

    const imgbbData = await imgbbResponse.json();

    console.log("ImgBB response:", imgbbData);

    if (!imgbbResponse.ok || !imgbbData.success) {
      return res.status(500).json({
        success: false,
        message:
          imgbbData?.error?.message ||
          "ImgBB upload failed",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully",
      imageUrl: imgbbData.data.display_url,
      deleteUrl: imgbbData.data.delete_url,
    });
  } catch (error) {
    console.error("Profile upload error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Image upload failed",
    });
  }
});

export default router;