import express from "express";

import Property from "../models/Property.js";
import Favorite from "../models/Favorite.js";

import {
  protect,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*
  GET
  Tenant's favorite properties
*/
router.get(
  "/my-favorites",
  protect,
  requireRole("tenant"),
  async (req, res) => {
    try {
      const favorites = await Favorite.find({
        "tenant.id": req.user.id,
      }).sort({
        createdAt: -1,
      });

      return res.status(200).json({
        success: true,
        favorites,
      });
    } catch (error) {
      console.error(
        "Get favorites error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load favorites.",
      });
    }
  }
);

/*
  GET
  Check whether a property is favorite
*/
router.get(
  "/check/:propertyId",
  protect,
  requireRole("tenant"),
  async (req, res) => {
    try {
      const { propertyId } =
        req.params;

      const favorite =
        await Favorite.findOne({
          "tenant.id": req.user.id,
          "property.id": propertyId,
        });

      return res.status(200).json({
        success: true,
        isFavorite: Boolean(favorite),
      });
    } catch (error) {
      console.error(
        "Check favorite error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to check favorite status.",
      });
    }
  }
);

/*
  POST
  Add property to favorites
*/
router.post(
  "/:propertyId",
  protect,
  requireRole("tenant"),
  async (req, res) => {
    try {
      const { propertyId } =
        req.params;

      if (!propertyId) {
        return res.status(400).json({
          success: false,
          message:
            "Property ID is required.",
        });
      }

      const property =
        await Property.findOne({
          _id: propertyId,
          status: "Approved",
        });

      if (!property) {
        return res.status(404).json({
          success: false,
          message:
            "Approved property not found.",
        });
      }

      const existingFavorite =
        await Favorite.findOne({
          "tenant.id": req.user.id,
          "property.id": propertyId,
        });

      if (existingFavorite) {
        return res.status(200).json({
          success: true,
          isFavorite: true,
          message:
            "Property is already in favorites.",
          favorite: existingFavorite,
        });
      }

      const favorite =
        await Favorite.create({
          tenant: {
            id: req.user.id,
            name:
              req.user.name ||
              "Tenant",
            email:
              req.user.email,
            photo:
              req.user.photo || "",
          },

          property: {
            id: property._id.toString(),
            title: property.title,
            location: property.location,
            type: property.type,
            rent: property.rent,
            rentType:
              property.rentType ||
              "Monthly",
            image:
              property.images?.[0] ||
              "",
            bedrooms:
              property.bedrooms || 0,
            bathrooms:
              property.bathrooms || 0,
            size:
              property.size || 0,
          },
        });

      return res.status(201).json({
        success: true,
        isFavorite: true,
        message:
          "Property added to favorites.",
        favorite,
      });
    } catch (error) {
      console.error(
        "Add favorite error:",
        error
      );

      if (
        error.code === 11000
      ) {
        return res.status(200).json({
          success: true,
          isFavorite: true,
          message:
            "Property is already in favorites.",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to add property to favorites.",
      });
    }
  }
);

/*
  DELETE
  Remove property from favorites
*/
router.delete(
  "/:propertyId",
  protect,
  requireRole("tenant"),
  async (req, res) => {
    try {
      const { propertyId } =
        req.params;

      const deletedFavorite =
        await Favorite.findOneAndDelete({
          "tenant.id": req.user.id,
          "property.id": propertyId,
        });

      if (!deletedFavorite) {
        return res.status(404).json({
          success: false,
          message:
            "Favorite property not found.",
        });
      }

      return res.status(200).json({
        success: true,
        isFavorite: false,
        message:
          "Property removed from favorites.",
      });
    } catch (error) {
      console.error(
        "Remove favorite error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to remove favorite.",
      });
    }
  }
);

export default router;