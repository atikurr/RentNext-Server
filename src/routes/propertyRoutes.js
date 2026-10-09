import express from "express";

import Property from "../models/Property.js";

import {
  protect,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| PUBLIC — GET ALL APPROVED PROPERTIES
|--------------------------------------------------------------------------
| GET /api/properties
|
| Query:
| ?search=Dhaka
| ?type=Apartment
| ?sort=price_asc
| ?sort=price_desc
| ?page=1
| ?limit=9
|
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {
  try {
    const {
      search = "",
      type = "",
      sort = "",
      page = 1,
      limit = 9,
    } = req.query;

    const currentPage =
      Math.max(Number(page) || 1, 1);

    const itemsPerPage =
      Math.min(
        Math.max(Number(limit) || 9, 1),
        50
      );

    /*
    |--------------------------------------------------------------------------
    | BASE FILTER
    |--------------------------------------------------------------------------
    */

    const filter = {
      status: "Approved",
    };

    /*
    |--------------------------------------------------------------------------
    | LOCATION / TITLE SEARCH
    |--------------------------------------------------------------------------
    */

    if (
      typeof search === "string" &&
      search.trim()
    ) {
      const searchRegex =
        new RegExp(
          search.trim(),
          "i"
        );

      filter.$or = [
        {
          title: searchRegex,
        },
        {
          location: searchRegex,
        },
        {
          description: searchRegex,
        },
      ];
    }

    /*
    |--------------------------------------------------------------------------
    | PROPERTY TYPE FILTER
    |--------------------------------------------------------------------------
    */

    if (
      typeof type === "string" &&
      type.trim() &&
      type !== "All"
    ) {
      filter.type = type.trim();
    }

    /*
    |--------------------------------------------------------------------------
    | SORTING
    |--------------------------------------------------------------------------
    */

    let sortOption = {
      createdAt: -1,
    };

    if (sort === "price_asc") {
      sortOption = {
        rent: 1,
      };
    }

    if (sort === "price_desc") {
      sortOption = {
        rent: -1,
      };
    }

    /*
    |--------------------------------------------------------------------------
    | PAGINATION
    |--------------------------------------------------------------------------
    */

    const skip =
      (currentPage - 1) *
      itemsPerPage;

    const [
      properties,
      totalProperties,
    ] = await Promise.all([
      Property.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(itemsPerPage)
        .lean(),

      Property.countDocuments(filter),
    ]);

    const totalPages =
      Math.ceil(
        totalProperties /
          itemsPerPage
      );

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: true,

      properties,

      pagination: {
        currentPage,
        limit: itemsPerPage,
        totalProperties,
        totalPages,
        hasNextPage:
          currentPage <
          totalPages,
        hasPreviousPage:
          currentPage > 1,
      },
    });
  } catch (error) {
    console.error(
      "Get public properties error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load properties.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| OWNER — CREATE PROPERTY
|--------------------------------------------------------------------------
| POST /api/properties
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  protect,
  requireRole("owner"),
  async (req, res) => {
    try {
      const {
        title,
        description,
        location,
        type,
        rent,
        rentType,
        bedrooms,
        bathrooms,
        size,
        amenities,
        extraFeatures,
        images,
      } = req.body;

      /*
      |--------------------------------------------------------------------------
      | VALIDATION
      |--------------------------------------------------------------------------
      */

      if (
        !title ||
        !description ||
        !location ||
        !type ||
        rent === undefined ||
        rent === null ||
        bedrooms === undefined ||
        bathrooms === undefined ||
        size === undefined
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please provide all required property fields.",
        });
      }

      if (
        !Array.isArray(images) ||
        images.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "At least one property image is required.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | CREATE PROPERTY
      |--------------------------------------------------------------------------
      */

      const property =
        await Property.create({
          title: title.trim(),

          description:
            description.trim(),

          location:
            location.trim(),

          type,

          rent: Number(rent),

          rentType:
            rentType || "Monthly",

          bedrooms:
            Number(bedrooms),

          bathrooms:
            Number(bathrooms),

          size: Number(size),

          amenities:
            Array.isArray(amenities)
              ? amenities
              : [],

          extraFeatures:
            Array.isArray(
              extraFeatures
            )
              ? extraFeatures
              : [],

          images,

          owner: {
            id: req.user.id,

            name:
              req.user.name || "Owner",

            email:
              req.user.email,

            photo:
              req.user.photo || "",
          },

          status: "Pending",

          rejectionFeedback: "",
        });

      return res.status(201).json({
        success: true,

        message:
          "Property submitted successfully and is pending admin approval.",

        property,
      });
    } catch (error) {
      console.error(
        "Create property error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to create property.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| OWNER — GET MY PROPERTIES
|--------------------------------------------------------------------------
| GET /api/properties/my-properties
|--------------------------------------------------------------------------
*/

router.get(
  "/my-properties",
  protect,
  requireRole("owner"),
  async (req, res) => {
    try {
      const {
        search = "",
        status = "",
      } = req.query;

      const filter = {
        "owner.id": req.user.id,
      };

      /*
      |--------------------------------------------------------------------------
      | SEARCH
      |--------------------------------------------------------------------------
      */

      if (
        typeof search === "string" &&
        search.trim()
      ) {
        const searchRegex =
          new RegExp(
            search.trim(),
            "i"
          );

        filter.$or = [
          {
            title: searchRegex,
          },
          {
            location:
              searchRegex,
          },
          {
            description:
              searchRegex,
          },
        ];
      }

      /*
      |--------------------------------------------------------------------------
      | STATUS FILTER
      |--------------------------------------------------------------------------
      */

      if (
        typeof status === "string" &&
        status.trim() &&
        status !== "All"
      ) {
        filter.status =
          status.trim();
      }

      const properties =
        await Property.find(filter)
          .sort({
            createdAt: -1,
          })
          .lean();

      return res.status(200).json({
        success: true,
        properties,
      });
    } catch (error) {
      console.error(
        "Get owner properties error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load your properties.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET SINGLE PROPERTY
|--------------------------------------------------------------------------
| GET /api/properties/:id
|
| Public approved property can be viewed.
| Owner can view their own property even if Pending/Rejected.
|--------------------------------------------------------------------------
*/

router.get(
  "/:id",
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const property =
        await Property.findById(
          id
        ).lean();

      if (!property) {
        return res.status(404).json({
          success: false,
          message:
            "Property not found.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | PUBLIC ACCESS
      |--------------------------------------------------------------------------
      |
      | Approved properties are public.
      |
      */

      if (
        property.status ===
        "Approved"
      ) {
        return res.status(200).json({
          success: true,
          property,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | OWNER ACCESS
      |--------------------------------------------------------------------------
      |
      | Pending/Rejected properties can
      | still be viewed by their owner.
      |
      */

      const authorization =
        req.headers.authorization;

      if (!authorization) {
        return res.status(403).json({
          success: false,
          message:
            "This property is not publicly available.",
        });
      }

      try {
        /*
        |--------------------------------------------------------------------------
        | We do not manually verify JWT here.
        | Instead, owner frontend normally uses
        | the protected edit endpoint.
        |
        | For security, non-approved public
        | properties remain unavailable here.
        |--------------------------------------------------------------------------
        */

        return res.status(403).json({
          success: false,
          message:
            "This property is not publicly available.",
        });
      } catch {
        return res.status(403).json({
          success: false,
          message:
            "This property is not publicly available.",
        });
      }
    } catch (error) {
      console.error(
        "Get property error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load property.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| OWNER — UPDATE PROPERTY
|--------------------------------------------------------------------------
| PUT /api/properties/:id
|--------------------------------------------------------------------------
*/

router.put(
  "/:id",
  protect,
  requireRole("owner"),
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const property =
        await Property.findById(
          id
        );

      if (!property) {
        return res.status(404).json({
          success: false,
          message:
            "Property not found.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | OWNER CHECK
      |--------------------------------------------------------------------------
      */

      if (
        String(
          property.owner.id
        ) !==
        String(req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can only update your own property.",
        });
      }

      const {
        title,
        description,
        location,
        type,
        rent,
        rentType,
        bedrooms,
        bathrooms,
        size,
        amenities,
        extraFeatures,
        images,
      } = req.body;

      /*
      |--------------------------------------------------------------------------
      | VALIDATION
      |--------------------------------------------------------------------------
      */

      if (
        !title ||
        !description ||
        !location ||
        !type ||
        rent === undefined ||
        bedrooms === undefined ||
        bathrooms === undefined ||
        size === undefined
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please provide all required property fields.",
        });
      }

      if (
        !Array.isArray(images) ||
        images.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "At least one property image is required.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | UPDATE
      |--------------------------------------------------------------------------
      */

      property.title =
        title.trim();

      property.description =
        description.trim();

      property.location =
        location.trim();

      property.type =
        type;

      property.rent =
        Number(rent);

      property.rentType =
        rentType || "Monthly";

      property.bedrooms =
        Number(bedrooms);

      property.bathrooms =
        Number(bathrooms);

      property.size =
        Number(size);

      property.amenities =
        Array.isArray(amenities)
          ? amenities
          : [];

      property.extraFeatures =
        Array.isArray(
          extraFeatures
        )
          ? extraFeatures
          : [];

      property.images =
        images;

      /*
      |--------------------------------------------------------------------------
      | RE-SUBMIT FOR APPROVAL
      |--------------------------------------------------------------------------
      */

      property.status =
        "Pending";

      property.rejectionFeedback =
        "";

      await property.save();

      return res.status(200).json({
        success: true,

        message:
          "Property updated successfully and submitted for approval.",

        property,
      });
    } catch (error) {
      console.error(
        "Update property error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to update property.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| OWNER — DELETE PROPERTY
|--------------------------------------------------------------------------
| DELETE /api/properties/:id
|--------------------------------------------------------------------------
*/

router.delete(
  "/:id",
  protect,
  requireRole("owner"),
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const property =
        await Property.findById(
          id
        );

      if (!property) {
        return res.status(404).json({
          success: false,
          message:
            "Property not found.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | OWNER CHECK
      |--------------------------------------------------------------------------
      */

      if (
        String(
          property.owner.id
        ) !==
        String(req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can only delete your own property.",
        });
      }

      await Property.findByIdAndDelete(
        id
      );

      return res.status(200).json({
        success: true,
        message:
          "Property deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Delete property error:",
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