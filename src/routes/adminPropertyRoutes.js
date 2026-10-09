import express from "express";

import Property from "../models/Property.js";
import {
  protect,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| ADMIN AUTH
|--------------------------------------------------------------------------
*/

router.use(protect);
router.use(requireRole("admin"));

/*
|--------------------------------------------------------------------------
| GET ALL PROPERTIES
|--------------------------------------------------------------------------
| Admin can see Pending, Approved and Rejected properties.
| Search + status filter + type filter + pagination
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {
  try {
    const {
      search = "",
      status = "",
      type = "",
      page = 1,
      limit = 10,
    } = req.query;

    const currentPage = Math.max(
      Number(page) || 1,
      1
    );

    const perPage = Math.min(
      Math.max(Number(limit) || 10, 1),
      50
    );

    const filter = {};

    /*
    |--------------------------------------------------------------------------
    | SEARCH
    |--------------------------------------------------------------------------
    */

    if (search.trim()) {
      const searchRegex = new RegExp(
        search.trim(),
        "i"
      );

      filter.$or = [
        { title: searchRegex },
        { location: searchRegex },
        { description: searchRegex },
        { "owner.name": searchRegex },
        { "owner.email": searchRegex },
      ];
    }

    /*
    |--------------------------------------------------------------------------
    | STATUS FILTER
    |--------------------------------------------------------------------------
    */

    if (
      ["Pending", "Approved", "Rejected"].includes(
        status
      )
    ) {
      filter.status = status;
    }

    /*
    |--------------------------------------------------------------------------
    | PROPERTY TYPE FILTER
    |--------------------------------------------------------------------------
    */

    if (type.trim()) {
      filter.type = type.trim();
    }

    const totalProperties =
      await Property.countDocuments(filter);

    const totalPages = Math.max(
      Math.ceil(
        totalProperties / perPage
      ),
      1
    );

    const safePage = Math.min(
      currentPage,
      totalPages
    );

    const properties =
      await Property.find(filter)
        .sort({
          createdAt: -1,
        })
        .skip(
          (safePage - 1) * perPage
        )
        .limit(perPage)
        .lean();

    return res.status(200).json({
      success: true,
      message:
        "Admin properties fetched successfully.",
      data: properties,
      pagination: {
        currentPage: safePage,
        limit: perPage,
        totalProperties,
        totalPages,
        hasNextPage:
          safePage < totalPages,
        hasPreviousPage:
          safePage > 1,
      },
    });
  } catch (error) {
    console.error(
      "Admin get properties error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch properties.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET SINGLE PROPERTY
|--------------------------------------------------------------------------
*/

router.get("/:id", async (req, res) => {
  try {
    const property =
      await Property.findById(
        req.params.id
      ).lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        message:
          "Property not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: property,
    });
  } catch (error) {
    console.error(
      "Admin get property error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch property.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| APPROVE PROPERTY
|--------------------------------------------------------------------------
*/

router.patch(
  "/:id/approve",
  async (req, res) => {
    try {
      const property =
        await Property.findById(
          req.params.id
        );

      if (!property) {
        return res.status(404).json({
          success: false,
          message:
            "Property not found.",
        });
      }

      property.status = "Approved";
      property.rejectionFeedback = "";

      await property.save();

      return res.status(200).json({
        success: true,
        message:
          "Property approved successfully.",
        data: property,
      });
    } catch (error) {
      console.error(
        "Admin approve property error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to approve property.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| REJECT PROPERTY
|--------------------------------------------------------------------------
| Rejection feedback is required.
|--------------------------------------------------------------------------
*/

router.patch(
  "/:id/reject",
  async (req, res) => {
    try {
      const {
        rejectionFeedback,
      } = req.body;

      if (
        !rejectionFeedback ||
        !rejectionFeedback.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Rejection feedback is required.",
        });
      }

      const property =
        await Property.findById(
          req.params.id
        );

      if (!property) {
        return res.status(404).json({
          success: false,
          message:
            "Property not found.",
        });
      }

      property.status = "Rejected";

      property.rejectionFeedback =
        rejectionFeedback.trim();

      await property.save();

      return res.status(200).json({
        success: true,
        message:
          "Property rejected successfully.",
        data: property,
      });
    } catch (error) {
      console.error(
        "Admin reject property error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to reject property.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| UPDATE PROPERTY
|--------------------------------------------------------------------------
*/

router.put("/:id", async (req, res) => {
  try {
    const property =
      await Property.findById(
        req.params.id
      );

    if (!property) {
      return res.status(404).json({
        success: false,
        message:
          "Property not found.",
      });
    }

    const allowedFields = [
      "title",
      "description",
      "location",
      "type",
      "rent",
      "rentType",
      "bedrooms",
      "bathrooms",
      "size",
      "amenities",
      "extraFeatures",
      "images",
    ];

    allowedFields.forEach(
      (field) => {
        if (
          req.body[field] !== undefined
        ) {
          property[field] =
            req.body[field];
        }
      }
    );

    /*
    |--------------------------------------------------------------------------
    | Clear rejection feedback if admin updates property
    |--------------------------------------------------------------------------
    */

    if (
      property.status === "Rejected"
    ) {
      property.rejectionFeedback = "";
    }

    await property.save();

    return res.status(200).json({
      success: true,
      message:
        "Property updated successfully.",
      data: property,
    });
  } catch (error) {
    console.error(
      "Admin update property error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update property.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| DELETE PROPERTY
|--------------------------------------------------------------------------
*/

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const property =
        await Property.findByIdAndDelete(
          req.params.id
        );

      if (!property) {
        return res.status(404).json({
          success: false,
          message:
            "Property not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Property deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Admin delete property error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete property.",
      });
    }
  }
);

export default router;