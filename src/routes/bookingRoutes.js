import express from "express";

import Booking from "../models/Booking.js";
import Property from "../models/Property.js";

import {
  protect,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/* =========================================================
   CREATE BOOKING
   POST /api/bookings
   Tenant only
========================================================= */

router.post(
  "/",
  protect,
  requireRole("tenant"),
  async (req, res) => {
    try {
      const {
        propertyId,
        startDate,
        endDate,
        duration,
        note,
      } = req.body;

      if (
        !propertyId ||
        !startDate ||
        !endDate ||
        duration === undefined
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please provide all required booking information.",
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
            "Property not found or is not approved.",
        });
      }

      const bookingStartDate =
        new Date(startDate);

      const bookingEndDate =
        new Date(endDate);

      if (
        Number.isNaN(
          bookingStartDate.getTime()
        ) ||
        Number.isNaN(
          bookingEndDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid booking date.",
        });
      }

      if (
        bookingEndDate <=
        bookingStartDate
      ) {
        return res.status(400).json({
          success: false,
          message:
            "End date must be after start date.",
        });
      }

      const durationNumber =
        Number(duration);

      if (
        !Number.isFinite(durationNumber) ||
        durationNumber <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Duration must be greater than zero.",
        });
      }

      const totalAmount =
        property.rent *
        durationNumber;

      /*
       * Check if the same property already
       * has an active booking for the
       * requested period.
       */

      const overlappingBooking =
        await Booking.findOne({
          "property.id": property._id.toString(),

          status: {
            $in: [
              "Pending",
              "Approved",
            ],
          },

          startDate: {
            $lt: bookingEndDate,
          },

          endDate: {
            $gt: bookingStartDate,
          },
        });

      if (overlappingBooking) {
        return res.status(409).json({
          success: false,
          message:
            "This property is already booked or has a pending booking for the selected period.",
        });
      }

      const booking =
        await Booking.create({
          property: {
            id: property._id.toString(),
            title: property.title,
            location: property.location,
            image:
              property.images?.[0] || "",
            rent: property.rent,
            rentType:
              property.rentType,
          },

          tenant: {
            id: req.user.id,
            name: req.user.name || "",
            email: req.user.email,
            photo:
              req.user.photo || "",
          },

          owner: {
            id: property.owner.id,
            name: property.owner.name,
            email: property.owner.email,
            photo:
              property.owner.photo || "",
          },

          startDate:
            bookingStartDate,

          endDate:
            bookingEndDate,

          duration:
            durationNumber,

          totalAmount,

          note: note || "",

          status: "Pending",

          paymentStatus:
            "Pending",
        });

      return res.status(201).json({
        success: true,
        message:
          "Booking request submitted successfully.",
        booking,
      });
    } catch (error) {
      console.error(
        "Create booking error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to create booking.",
      });
    }
  }
);


/* =========================================================
   GET OWNER BOOKING REQUESTS
   GET /api/bookings/owner
   Owner only

   Supports:
   ?page=1
   ?limit=10
   ?status=Pending
   ?search=john
========================================================= */

router.get(
  "/owner",
  protect,
  requireRole("owner"),
  async (req, res) => {
    try {
      const page = Math.max(
        Number(req.query.page) || 1,
        1
      );

      const limit = Math.min(
        Math.max(
          Number(req.query.limit) || 10,
          1
        ),
        50
      );

      const skip =
        (page - 1) * limit;

      const status =
        req.query.status || "";

      const search =
        req.query.search?.trim() || "";

      const query = {
        "owner.id": req.user.id,
      };

      if (
        status &&
        [
          "Pending",
          "Approved",
          "Rejected",
          "Cancelled",
          "Completed",
        ].includes(status)
      ) {
        query.status = status;
      }

      if (search) {
        query.$or = [
          {
            "tenant.name": {
              $regex: search,
              $options: "i",
            },
          },
          {
            "tenant.email": {
              $regex: search,
              $options: "i",
            },
          },
          {
            "property.title": {
              $regex: search,
              $options: "i",
            },
          },
          {
            "property.location": {
              $regex: search,
              $options: "i",
            },
          },
        ];
      }

      const [
        bookings,
        total,
      ] = await Promise.all([
        Booking.find(query)
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(limit),

        Booking.countDocuments(query),
      ]);

      const totalPages =
        Math.ceil(total / limit);

      return res.status(200).json({
        success: true,

        bookings,

        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage:
            page < totalPages,
          hasPreviousPage:
            page > 1,
        },
      });
    } catch (error) {
      console.error(
        "Get owner bookings error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch booking requests.",
      });
    }
  }
);


/* =========================================================
   GET TENANT BOOKINGS
   GET /api/bookings/my-bookings
   Tenant only
========================================================= */

router.get(
  "/my-bookings",
  protect,
  requireRole("tenant"),
  async (req, res) => {
    try {
      const bookings =
        await Booking.find({
          "tenant.id": req.user.id,
        }).sort({
          createdAt: -1,
        });

      return res.status(200).json({
        success: true,
        count: bookings.length,
        bookings,
      });
    } catch (error) {
      console.error(
        "Get tenant bookings error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch your bookings.",
      });
    }
  }
);


/* =========================================================
   UPDATE BOOKING STATUS
   PATCH /api/bookings/:id/status
   Owner only

   Body:
   {
     "status": "Approved"
   }

   OR

   {
     "status": "Rejected",
     "rejectionFeedback": "Property is no longer available."
   }
========================================================= */

router.patch(
  "/:id/status",
  protect,
  requireRole("owner"),
  async (req, res) => {
    try {
      const {
        status,
        rejectionFeedback,
      } = req.body;

      if (
        !["Approved", "Rejected"].includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Status must be either Approved or Rejected.",
        });
      }

      const booking =
        await Booking.findOne({
          _id: req.params.id,
          "owner.id": req.user.id,
        });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message:
            "Booking request not found or you do not have permission to update it.",
        });
      }

      if (booking.status !== "Pending") {
        return res.status(400).json({
          success: false,
          message:
            "Only pending booking requests can be approved or rejected.",
        });
      }

      if (
        status === "Rejected" &&
        !rejectionFeedback?.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please provide rejection feedback.",
        });
      }

      /*
       * Before approving, check whether
       * another approved booking overlaps
       * with this booking.
       */

      if (status === "Approved") {
        const overlappingBooking =
          await Booking.findOne({
            _id: {
              $ne: booking._id,
            },

            "property.id":
              booking.property.id,

            status: "Approved",

            startDate: {
              $lt: booking.endDate,
            },

            endDate: {
              $gt: booking.startDate,
            },
          });

        if (overlappingBooking) {
          return res.status(409).json({
            success: false,
            message:
              "This property has already been approved for another booking during the selected period.",
          });
        }
      }

      booking.status = status;

      if (status === "Rejected") {
        booking.rejectionFeedback =
          rejectionFeedback.trim();
      } else {
        booking.rejectionFeedback = "";
      }

      await booking.save();

      return res.status(200).json({
        success: true,
        message:
          status === "Approved"
            ? "Booking request approved successfully."
            : "Booking request rejected successfully.",

        booking,
      });
    } catch (error) {
      console.error(
        "Update booking status error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update booking status.",
      });
    }
  }
);


/* =========================================================
   CANCEL BOOKING
   PATCH /api/bookings/:id/cancel
   Tenant only
========================================================= */

router.patch(
  "/:id/cancel",
  protect,
  requireRole("tenant"),
  async (req, res) => {
    try {
      const booking =
        await Booking.findOne({
          _id: req.params.id,
          "tenant.id": req.user.id,
        });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message:
            "Booking not found or you do not have permission to cancel it.",
        });
      }

      if (
        ![
          "Pending",
          "Approved",
        ].includes(booking.status)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This booking cannot be cancelled.",
        });
      }

      booking.status = "Cancelled";

      await booking.save();

      return res.status(200).json({
        success: true,
        message:
          "Booking cancelled successfully.",
        booking,
      });
    } catch (error) {
      console.error(
        "Cancel booking error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to cancel booking.",
      });
    }
  }
);

export default router;