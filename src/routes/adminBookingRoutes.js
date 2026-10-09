import express from "express";

import Booking from "../models/Booking.js";

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
| GET ALL BOOKINGS
|--------------------------------------------------------------------------
| Admin can see all bookings.
| Search + status filter + payment filter + pagination
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {
  try {
    const {
      search = "",
      status = "",
      paymentStatus = "",
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
        {
          "property.title": searchRegex,
        },
        {
          "property.location": searchRegex,
        },
        {
          "tenant.name": searchRegex,
        },
        {
          "tenant.email": searchRegex,
        },
        {
          "owner.name": searchRegex,
        },
        {
          "owner.email": searchRegex,
        },
      ];
    }

    /*
    |--------------------------------------------------------------------------
    | BOOKING STATUS
    |--------------------------------------------------------------------------
    */

    const allowedStatuses = [
      "Pending",
      "Approved",
      "Rejected",
      "Cancelled",
      "Completed",
    ];

    if (
      allowedStatuses.includes(status)
    ) {
      filter.status = status;
    }

    /*
    |--------------------------------------------------------------------------
    | PAYMENT STATUS
    |--------------------------------------------------------------------------
    */

    const allowedPaymentStatuses = [
      "Pending",
      "Paid",
      "Failed",
      "Refunded",
    ];

    if (
      allowedPaymentStatuses.includes(
        paymentStatus
      )
    ) {
      filter.paymentStatus =
        paymentStatus;
    }

    /*
    |--------------------------------------------------------------------------
    | COUNT
    |--------------------------------------------------------------------------
    */

    const totalBookings =
      await Booking.countDocuments(
        filter
      );

    const totalPages = Math.max(
      Math.ceil(
        totalBookings / perPage
      ),
      1
    );

    const safePage = Math.min(
      currentPage,
      totalPages
    );

    /*
    |--------------------------------------------------------------------------
    | BOOKINGS
    |--------------------------------------------------------------------------
    */

    const bookings =
      await Booking.find(filter)
        .sort({
          createdAt: -1,
        })
        .skip(
          (safePage - 1) * perPage
        )
        .limit(perPage)
        .lean();

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: true,
      message:
        "Admin bookings fetched successfully.",

      data: bookings,

      pagination: {
        currentPage: safePage,
        limit: perPage,
        totalBookings,
        totalPages,

        hasNextPage:
          safePage < totalPages,

        hasPreviousPage:
          safePage > 1,
      },
    });
  } catch (error) {
    console.error(
      "Admin get bookings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch bookings.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET SINGLE BOOKING
|--------------------------------------------------------------------------
*/

router.get("/:id", async (req, res) => {
  try {
    const booking =
      await Booking.findById(
        req.params.id
      ).lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message:
          "Booking not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error(
      "Admin get booking error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch booking.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| UPDATE BOOKING STATUS
|--------------------------------------------------------------------------
| Admin can manage booking status.
|--------------------------------------------------------------------------
*/

router.patch(
  "/:id/status",
  async (req, res) => {
    try {
      const {
        status,
        rejectionFeedback = "",
      } = req.body;

      const allowedStatuses = [
        "Pending",
        "Approved",
        "Rejected",
        "Cancelled",
        "Completed",
      ];

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid booking status.",
        });
      }

      if (
        status === "Rejected" &&
        !rejectionFeedback.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Rejection feedback is required.",
        });
      }

      const booking =
        await Booking.findById(
          req.params.id
        );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message:
            "Booking not found.",
        });
      }

      booking.status = status;

      if (
        status === "Rejected"
      ) {
        booking.rejectionFeedback =
          rejectionFeedback.trim();
      } else {
        booking.rejectionFeedback =
          "";
      }

      await booking.save();

      return res.status(200).json({
        success: true,
        message:
          "Booking status updated successfully.",
        data: booking,
      });
    } catch (error) {
      console.error(
        "Admin update booking status error:",
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

/*
|--------------------------------------------------------------------------
| DELETE BOOKING
|--------------------------------------------------------------------------
*/

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const booking =
        await Booking.findByIdAndDelete(
          req.params.id
        );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message:
            "Booking not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Booking deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Admin delete booking error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete booking.",
      });
    }
  }
);

export default router;