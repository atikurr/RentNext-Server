import express from "express";

import Property from "../models/Property.js";
import Booking from "../models/Booking.js";

import {
  protect,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| GET OWNER ANALYTICS
|--------------------------------------------------------------------------
| GET /api/owner/analytics
|
| Owner Dashboard:
| - Total Earnings
| - Total Properties
| - Total Bookings
| - Active Tenants
| - Pending Requests
| - Monthly Earnings - Last 12 Months
| - Recent Properties
|--------------------------------------------------------------------------
*/

router.get(
  "/analytics",
  protect,
  requireRole("owner"),
  async (req, res) => {
    try {
      const ownerId = req.user.id;

      /*
      |--------------------------------------------------------------------------
      | GET OWNER PROPERTIES
      |--------------------------------------------------------------------------
      */

      const properties =
        await Property.find({
          "owner.id": ownerId,
        })
          .sort({
            createdAt: -1,
          })
          .lean();

      const propertyIds =
        properties.map(
          (property) =>
            String(property._id)
        );

      /*
      |--------------------------------------------------------------------------
      | GET OWNER BOOKINGS
      |--------------------------------------------------------------------------
      */

      const bookings =
        propertyIds.length > 0
          ? await Booking.find({
              "owner.id": ownerId,
            })
              .sort({
                createdAt: -1,
              })
              .lean()
          : [];

      /*
      |--------------------------------------------------------------------------
      | TOTAL EARNINGS
      |--------------------------------------------------------------------------
      |
      | Only successful/paid booking payments
      |
      */

      const totalEarnings =
        bookings
          .filter(
            (booking) =>
              booking.paymentStatus ===
              "Paid"
          )
          .reduce(
            (total, booking) =>
              total +
              Number(
                booking.totalAmount || 0
              ),
            0
          );

      /*
      |--------------------------------------------------------------------------
      | TOTAL PROPERTIES
      |--------------------------------------------------------------------------
      */

      const totalProperties =
        properties.length;

      /*
      |--------------------------------------------------------------------------
      | TOTAL BOOKINGS
      |--------------------------------------------------------------------------
      |
      | Confirmed bookings:
      | Approved + Completed
      |
      */

      const confirmedBookings =
        bookings.filter(
          (booking) =>
            booking.status ===
              "Approved" ||
            booking.status ===
              "Completed"
        );

      const totalBookings =
        confirmedBookings.length;

      /*
      |--------------------------------------------------------------------------
      | PENDING REQUESTS
      |--------------------------------------------------------------------------
      */

      const pendingRequests =
        bookings.filter(
          (booking) =>
            booking.status ===
            "Pending"
        ).length;

      /*
      |--------------------------------------------------------------------------
      | ACTIVE TENANTS
      |--------------------------------------------------------------------------
      |
      | Unique tenants from confirmed bookings
      |
      */

      const activeTenantIds =
        new Set();

      confirmedBookings.forEach(
        (booking) => {
          if (booking.tenant?.id) {
            activeTenantIds.add(
              String(
                booking.tenant.id
              )
            );
          }
        }
      );

      const activeTenants =
        activeTenantIds.size;

      /*
      |--------------------------------------------------------------------------
      | MONTHLY EARNINGS - LAST 12 MONTHS
      |--------------------------------------------------------------------------
      |
      | Uses successful paid booking payments.
      |
      | Booking model currently does not have a dedicated paidAt field,
      | therefore createdAt is used as the payment/transaction date.
      |
      */

      const now = new Date();

      const monthlyEarnings = [];

      for (
        let index = 11;
        index >= 0;
        index--
      ) {
        const monthDate =
          new Date(
            now.getFullYear(),
            now.getMonth() -
              index,
            1
          );

        const year =
          monthDate.getFullYear();

        const month =
          monthDate.getMonth();

        const nextMonth =
          new Date(
            year,
            month + 1,
            1
          );

        const earnings =
          bookings
            .filter((booking) => {
              if (
                booking.paymentStatus !==
                "Paid"
              ) {
                return false;
              }

              const bookingDate =
                new Date(
                  booking.createdAt
                );

              return (
                bookingDate >=
                  monthDate &&
                bookingDate <
                  nextMonth
              );
            })
            .reduce(
              (total, booking) =>
                total +
                Number(
                  booking.totalAmount ||
                    0
                ),
              0
            );

        monthlyEarnings.push({
          month:
            monthDate.toLocaleString(
              "en-US",
              {
                month: "short",
              }
            ),
          earnings,
          year,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | PROPERTY BOOKING COUNTS
      |--------------------------------------------------------------------------
      */

      const bookingCountMap =
        {};

      bookings.forEach(
        (booking) => {
          const propertyId =
            booking.property?.id;

          if (!propertyId) {
            return;
          }

          const key =
            String(propertyId);

          bookingCountMap[key] =
            (bookingCountMap[key] ||
              0) + 1;
        }
      );

      /*
      |--------------------------------------------------------------------------
      | RECENT PROPERTIES
      |--------------------------------------------------------------------------
      */

      const recentProperties =
        properties
          .slice(0, 5)
          .map((property) => ({
            id: String(
              property._id
            ),

            name:
              property.title,

            title:
              property.title,

            location:
              property.location,

            rent:
              Number(
                property.rent || 0
              ),

            rentType:
              property.rentType ||
              "Monthly",

            status:
              property.status,

            bookings:
              bookingCountMap[
                String(
                  property._id
                )
              ] || 0,

            image:
              property.images?.[0] ||
              "",

            createdAt:
              property.createdAt,
          }));

      /*
      |--------------------------------------------------------------------------
      | RESPONSE
      |--------------------------------------------------------------------------
      */

      return res.status(200).json({
        success: true,

        analytics: {
          totalEarnings,
          totalProperties,
          totalBookings,
          activeTenants,
          pendingRequests,

          monthlyEarnings,

          recentProperties,
        },
      });
    } catch (error) {
      console.error(
        "Owner analytics error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load owner analytics.",
      });
    }
  }
);

export default router;