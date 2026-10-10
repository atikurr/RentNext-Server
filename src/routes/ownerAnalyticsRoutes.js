
import express from "express";

import Property from "../models/Property.js";
import Booking from "../models/Booking.js";
import Transaction from "../models/Transaction.js";

import {
  protect,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| OWNER ANALYTICS
|--------------------------------------------------------------------------
*/

router.get(
  "/analytics",
  protect,
  requireRole("owner"),
  async (req, res) => {
    try {
      const ownerId = String(req.user.id);

      /*
      |--------------------------------------------------------------------------
      | GET OWNER PROPERTIES
      |--------------------------------------------------------------------------
      */

      const properties = await Property.find({
        "owner.id": ownerId,
      })
        .sort({ createdAt: -1 })
        .lean();

      const propertyIds = properties.map((property) =>
        String(property._id)
      );

      /*
      |--------------------------------------------------------------------------
      | GET OWNER BOOKINGS
      |--------------------------------------------------------------------------
      */

      const bookings = await Booking.find({
        "owner.id": ownerId,
      })
        .sort({ createdAt: -1 })
        .lean();

      /*
      |--------------------------------------------------------------------------
      | TOTAL EARNINGS
      |--------------------------------------------------------------------------
      | Preserves the existing dashboard calculation.
      |--------------------------------------------------------------------------
      */

      const totalEarnings = bookings
        .filter(
          (booking) => booking.paymentStatus === "Paid"
        )
        .reduce(
          (total, booking) =>
            total + Number(booking.totalAmount || 0),
          0
        );

      /*
      |--------------------------------------------------------------------------
      | TOTAL PROPERTIES
      |--------------------------------------------------------------------------
      */

      const totalProperties = properties.length;

      /*
      |--------------------------------------------------------------------------
      | CONFIRMED BOOKINGS
      |--------------------------------------------------------------------------
      */

      const confirmedBookings = bookings.filter(
        (booking) =>
          booking.status === "Approved" ||
          booking.status === "Completed"
      );

      const totalBookings = confirmedBookings.length;

      /*
      |--------------------------------------------------------------------------
      | PENDING REQUESTS
      |--------------------------------------------------------------------------
      */

      const pendingRequests = bookings.filter(
        (booking) => booking.status === "Pending"
      ).length;

      /*
      |--------------------------------------------------------------------------
      | ACTIVE TENANTS
      |--------------------------------------------------------------------------
      */

      const activeTenantIds = new Set();

      confirmedBookings.forEach((booking) => {
        if (booking.tenant?.id) {
          activeTenantIds.add(String(booking.tenant.id));
        }
      });

      const activeTenants = activeTenantIds.size;

      /*
      |--------------------------------------------------------------------------
      | MONTHLY EARNINGS - LAST 12 MONTHS
      |--------------------------------------------------------------------------
      | Preserves the existing dashboard chart calculation.
      |--------------------------------------------------------------------------
      */

      const now = new Date();
      const monthlyEarnings = [];

      for (let index = 11; index >= 0; index--) {
        const monthDate = new Date(
          now.getFullYear(),
          now.getMonth() - index,
          1
        );

        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();

        const nextMonth = new Date(year, month + 1, 1);

        const earnings = bookings
          .filter((booking) => {
            if (booking.paymentStatus !== "Paid") {
              return false;
            }

            const bookingDate = new Date(booking.createdAt);

            return (
              bookingDate >= monthDate &&
              bookingDate < nextMonth
            );
          })
          .reduce(
            (total, booking) =>
              total + Number(booking.totalAmount || 0),
            0
          );

        monthlyEarnings.push({
          month: monthDate.toLocaleString("en-US", {
            month: "short",
          }),
          earnings,
          year,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | PROPERTY BOOKING COUNTS
      |--------------------------------------------------------------------------
      */

      const bookingCountMap = {};

      bookings.forEach((booking) => {
        const propertyId = booking.property?.id;

        if (!propertyId) {
          return;
        }

        const key = String(propertyId);

        bookingCountMap[key] =
          (bookingCountMap[key] || 0) + 1;
      });

      /*
      |--------------------------------------------------------------------------
      | RECENT PROPERTIES
      |--------------------------------------------------------------------------
      */

      const recentProperties = properties
        .slice(0, 5)
        .map((property) => ({
          id: String(property._id),
          name: property.title,
          title: property.title,
          location: property.location,
          rent: Number(property.rent || 0),
          rentType: property.rentType || "Monthly",
          status: property.status,
          bookings:
            bookingCountMap[String(property._id)] || 0,
          image: property.images?.[0] || "",
          createdAt: property.createdAt,
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
      console.error("Owner analytics error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load owner analytics.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| OWNER MONTHLY EARNINGS REPORT
|--------------------------------------------------------------------------
| GET /api/owner/earnings-report?month=10&year=2026
|
| Uses successful Transaction records and transactionDate.
|--------------------------------------------------------------------------
*/

router.get(
  "/earnings-report",
  protect,
  requireRole("owner"),
  async (req, res) => {
    try {
      const ownerId = String(req.user.id);

      const month = Number(req.query.month);
      const year = Number(req.query.year);

      /*
      |--------------------------------------------------------------------------
      | VALIDATE MONTH AND YEAR
      |--------------------------------------------------------------------------
      */

      if (
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
      ) {
        return res.status(400).json({
          success: false,
          message: "Month must be a number from 1 to 12.",
        });
      }

      if (
        !Number.isInteger(year) ||
        year < 2000 ||
        year > 2100
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid year.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | SELECT MONTH RANGE
      |--------------------------------------------------------------------------
      | JavaScript Date months are zero-based.
      |--------------------------------------------------------------------------
      */

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);

      /*
      |--------------------------------------------------------------------------
      | GET PAID TRANSACTIONS FOR THIS OWNER
      |--------------------------------------------------------------------------
      */

      const transactions = await Transaction.find({
        "owner.id": ownerId,
        status: "Paid",
        transactionDate: {
          $gte: startDate,
          $lt: endDate,
        },
      })
        .sort({ transactionDate: 1 })
        .lean();

      /*
      |--------------------------------------------------------------------------
      | PROPERTY-WISE EARNINGS
      |--------------------------------------------------------------------------
      */

      const propertyMap = new Map();

      for (const transaction of transactions) {
        const propertyId = String(
          transaction.property?.id || "unknown"
        );

        const existing = propertyMap.get(propertyId) || {
          propertyId,
          propertyTitle:
            transaction.property?.title || "Property",
          location: transaction.property?.location || "",
          bookingCount: 0,
          totalEarnings: 0,
          currency: transaction.currency || "BDT",
        };

        existing.bookingCount += 1;
        existing.totalEarnings += Number(
          transaction.amount || 0
        );

        propertyMap.set(propertyId, existing);
      }

      const properties = Array.from(propertyMap.values());

      /*
      |--------------------------------------------------------------------------
      | TOTAL EARNINGS
      |--------------------------------------------------------------------------
      */

      const totalEarnings = transactions.reduce(
        (total, transaction) =>
          total + Number(transaction.amount || 0),
        0
      );

      /*
      |--------------------------------------------------------------------------
      | CURRENCIES
      |--------------------------------------------------------------------------
      | Avoid presenting mixed currencies as one total.
      |--------------------------------------------------------------------------
      */

      const currencies = [
        ...new Set(
          transactions.map(
            (transaction) => transaction.currency || "BDT"
          )
        ),
      ];

      /*
      |--------------------------------------------------------------------------
      | REPORT RESPONSE
      |--------------------------------------------------------------------------
      */

      return res.status(200).json({
        success: true,
        report: {
          ownerId,
          month,
          year,
          startDate,
          endDate,
          transactionCount: transactions.length,
          totalEarnings:
            currencies.length <= 1 ? totalEarnings : null,
          currencies,
          properties,
          transactions: transactions.map((transaction) => ({
            transactionId: transaction.transactionId,
            bookingId: transaction.bookingId,
            paymentId: transaction.paymentId,
            property: {
              id: transaction.property?.id || "",
              title: transaction.property?.title || "Property",
              location: transaction.property?.location || "",
            },
            tenant: {
              name: transaction.tenant?.name || "Tenant",
              email: transaction.tenant?.email || "",
            },
            amount: Number(transaction.amount || 0),
            currency: transaction.currency || "BDT",
            paymentMethod: transaction.paymentMethod || "Stripe",
            status: transaction.status,
            transactionDate: transaction.transactionDate,
          })),
        },
      });
    } catch (error) {
      console.error("Owner earnings report error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to generate monthly earnings report.",
      });
    }
  }
);

export default router;
