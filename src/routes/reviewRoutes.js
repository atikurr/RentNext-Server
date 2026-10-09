import express from "express";
import mongoose from "mongoose";
import Review from "../models/Review.js";
import Property from "../models/Property.js";
import { protect, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =========================================================
   GET LATEST REVIEWS
   Public endpoint for the homepage
   GET /api/reviews?limit=4
   ========================================================= */
router.get("/", async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 20)
      : 4;

    const [reviews, totalReviews] = await Promise.all([
      Review.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),

      Review.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      reviews,
      totalReviews,
    });
  } catch (error) {
    console.error("Get latest reviews error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
    });
  }
});

/* =========================================================
   GET REVIEWS BY PROPERTY
   Public endpoint
   ========================================================= */
router.get("/property/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;

    if (!mongoose.isValidObjectId(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID",
      });
    }

    const reviews = await Review.find({
      "property.id": propertyId,
    })
      .sort({ createdAt: -1 })
      .lean();

    const totalReviews = reviews.length;

    const averageRating =
      totalReviews > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) /
          totalReviews
        : 0;

    return res.status(200).json({
      success: true,
      reviews,
      totalReviews,
      averageRating: Number(averageRating.toFixed(1)),
    });
  } catch (error) {
    console.error("Get reviews by property error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
    });
  }
});

/* =========================================================
   CREATE REVIEW
   Tenant only
   ========================================================= */
router.post("/", protect, requireRole("tenant"), async (req, res) => {
  try {
    const user = req.user;
    const { propertyId, rating, comment } = req.body;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required",
      });
    }

    if (!mongoose.isValidObjectId(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID",
      });
    }

    if (
      rating === undefined ||
      rating === null ||
      rating === "" ||
      !Number.isFinite(Number(rating)) ||
      Number(rating) < 1 ||
      Number(rating) > 5
    ) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    if (
      typeof comment !== "string" ||
      comment.trim().length < 3 ||
      comment.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "Review must contain between 3 and 1000 characters",
      });
    }

    const property = await Property.findById(propertyId);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (
      property.status &&
      property.status.toLowerCase() !== "approved"
    ) {
      return res.status(400).json({
        success: false,
        message: "You can only review an approved property",
      });
    }

    const existingReview = await Review.findOne({
      "property.id": propertyId,
      "tenant.id": user.id,
    });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this property",
      });
    }

    const review = await Review.create({
      property: {
        id: property._id,
        title: property.title,
      },
      tenant: {
        id: user.id,
        name: user.name || "Tenant",
        email: user.email,
        photo: user.photo || "",
      },
      rating: Number(rating),
      comment: comment.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review,
    });
  } catch (error) {
    console.error("Create review error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this property",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to submit review",
    });
  }
});

/* =========================================================
   DELETE REVIEW
   Tenant can delete own review
   ========================================================= */
router.delete("/:id", protect, requireRole("tenant"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
    }

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (String(review.tenant.id) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own review",
      });
    }

    await Review.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete review error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete review",
    });
  }
});

export default router;