import express from "express";
import mongoose from "mongoose";

import { protect, requireRole } from "../middleware/authMiddleware.js";

import Property from "../models/Property.js";
import Booking from "../models/Booking.js";
import Transaction from "../models/Transaction.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| ADMIN ANALYTICS
|--------------------------------------------------------------------------
| GET /api/admin/analytics
|
| Returns exact platform-wide statistics for Admin Dashboard.
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  protect,
  requireRole("admin"),
  async (req, res) => {
    try {
      /*
      |--------------------------------------------------------------------------
      | USER COLLECTION
      |--------------------------------------------------------------------------
      |
      | Better Auth stores users in the MongoDB "user" collection.
      | We use the existing Mongoose MongoDB connection so no second
      | database connection is required.
      |
      */

      const db = mongoose.connection.db;

      if (!db) {
        return res.status(500).json({
          success: false,
          message:
            "Database connection is not available.",
        });
      }

      const usersCollection =
        db.collection("user");

      /*
      |--------------------------------------------------------------------------
      | BASIC COUNTS
      |--------------------------------------------------------------------------
      */

      const [
        totalUsers,
        totalProperties,
        totalBookings,
        totalTransactions,
      ] = await Promise.all([
        usersCollection.countDocuments(),

        Property.countDocuments(),

        Booking.countDocuments(),

        Transaction.countDocuments(),
      ]);

      /*
      |--------------------------------------------------------------------------
      | USER ROLE COUNTS
      |--------------------------------------------------------------------------
      */

      const [
        totalTenants,
        totalOwners,
        totalAdmins,
      ] = await Promise.all([
        usersCollection.countDocuments({
          role: "tenant",
        }),

        usersCollection.countDocuments({
          role: "owner",
        }),

        usersCollection.countDocuments({
          role: "admin",
        }),
      ]);

      /*
      |--------------------------------------------------------------------------
      | PROPERTY STATUS COUNTS
      |--------------------------------------------------------------------------
      */

      const [
        pendingProperties,
        approvedProperties,
        rejectedProperties,
      ] = await Promise.all([
        Property.countDocuments({
          status: "Pending",
        }),

        Property.countDocuments({
          status: "Approved",
        }),

        Property.countDocuments({
          status: "Rejected",
        }),
      ]);

      /*
      |--------------------------------------------------------------------------
      | PROPERTY TYPE COUNTS
      |--------------------------------------------------------------------------
      */

      const propertyTypeStats =
        await Property.aggregate([
          {
            $group: {
              _id: "$type",
              count: {
                $sum: 1,
              },
            },
          },
          {
            $sort: {
              count: -1,
            },
          },
        ]);

      /*
      |--------------------------------------------------------------------------
      | BOOKING STATUS COUNTS
      |--------------------------------------------------------------------------
      */

      const [
        pendingBookings,
        approvedBookings,
        rejectedBookings,
        cancelledBookings,
        completedBookings,
      ] = await Promise.all([
        Booking.countDocuments({
          status: "Pending",
        }),

        Booking.countDocuments({
          status: "Approved",
        }),

        Booking.countDocuments({
          status: "Rejected",
        }),

        Booking.countDocuments({
          status: "Cancelled",
        }),

        Booking.countDocuments({
          status: "Completed",
        }),
      ]);

      /*
      |--------------------------------------------------------------------------
      | PAYMENT STATUS COUNTS
      |--------------------------------------------------------------------------
      */

      const [
        paidBookings,
        pendingPayments,
        failedPayments,
        refundedPayments,
      ] = await Promise.all([
        Booking.countDocuments({
          paymentStatus: "Paid",
        }),

        Booking.countDocuments({
          paymentStatus: "Pending",
        }),

        Booking.countDocuments({
          paymentStatus: "Failed",
        }),

        Booking.countDocuments({
          paymentStatus: "Refunded",
        }),
      ]);

      /*
      |--------------------------------------------------------------------------
      | TRANSACTION STATUS COUNTS
      |--------------------------------------------------------------------------
      */

      const [
        paidTransactions,
        pendingTransactions,
        failedTransactions,
        refundedTransactions,
      ] = await Promise.all([
        Transaction.countDocuments({
          status: "Paid",
        }),

        Transaction.countDocuments({
          status: "Pending",
        }),

        Transaction.countDocuments({
          status: "Failed",
        }),

        Transaction.countDocuments({
          status: "Refunded",
        }),
      ]);

      /*
      |--------------------------------------------------------------------------
      | TOTAL REVENUE
      |--------------------------------------------------------------------------
      |
      | Revenue is calculated from successful Paid transactions.
      |
      */

      const revenueResult =
        await Transaction.aggregate([
          {
            $match: {
              status: "Paid",
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$amount",
              },
            },
          },
        ]);

      const totalRevenue =
        revenueResult[0]?.totalRevenue || 0;

      /*
      |--------------------------------------------------------------------------
      | MONTHLY REVENUE - LAST 12 MONTHS
      |--------------------------------------------------------------------------
      */

      const twelveMonthsAgo =
        new Date();

      twelveMonthsAgo.setMonth(
        twelveMonthsAgo.getMonth() - 11
      );

      twelveMonthsAgo.setDate(1);

      twelveMonthsAgo.setHours(
        0,
        0,
        0,
        0
      );

      const monthlyRevenue =
        await Transaction.aggregate([
          {
            $match: {
              status: "Paid",
              transactionDate: {
                $gte: twelveMonthsAgo,
              },
            },
          },

          {
            $group: {
              _id: {
                year: {
                  $year:
                    "$transactionDate",
                },

                month: {
                  $month:
                    "$transactionDate",
                },
              },

              revenue: {
                $sum: "$amount",
              },

              transactions: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              "_id.year": 1,
              "_id.month": 1,
            },
          },
        ]);

      /*
      |--------------------------------------------------------------------------
      | FORMAT MONTHLY REVENUE
      |--------------------------------------------------------------------------
      */

      const formattedMonthlyRevenue =
        monthlyRevenue.map(
          (item) => ({
            year: item._id.year,

            month: item._id.month,

            revenue: item.revenue || 0,

            transactions:
              item.transactions || 0,
          })
        );

      /*
      |--------------------------------------------------------------------------
      | RECENT TRANSACTIONS
      |--------------------------------------------------------------------------
      */

      const recentTransactions =
        await Transaction.find({})
          .sort({
            transactionDate: -1,
          })
          .limit(5)
          .lean();

      /*
      |--------------------------------------------------------------------------
      | RECENT BOOKINGS
      |--------------------------------------------------------------------------
      */

      const recentBookings =
        await Booking.find({})
          .sort({
            createdAt: -1,
          })
          .limit(5)
          .lean();

      /*
      |--------------------------------------------------------------------------
      | RECENT PROPERTIES
      |--------------------------------------------------------------------------
      */

      const recentProperties =
        await Property.find({})
          .sort({
            createdAt: -1,
          })
          .limit(5)
          .lean();

      /*
      |--------------------------------------------------------------------------
      | RESPONSE
      |--------------------------------------------------------------------------
      */

      return res.status(200).json({
        success: true,

        data: {
          /*
          |--------------------------------------------------------------------------
          | MAIN SUMMARY
          |--------------------------------------------------------------------------
          */

          summary: {
            totalUsers,

            totalProperties,

            totalBookings,

            totalTransactions,

            totalRevenue,
          },

          /*
          |--------------------------------------------------------------------------
          | USERS
          |--------------------------------------------------------------------------
          */

          users: {
            total: totalUsers,

            tenants: totalTenants,

            owners: totalOwners,

            admins: totalAdmins,
          },

          /*
          |--------------------------------------------------------------------------
          | PROPERTIES
          |--------------------------------------------------------------------------
          */

          properties: {
            total: totalProperties,

            pending: pendingProperties,

            approved: approvedProperties,

            rejected: rejectedProperties,

            byType:
              propertyTypeStats.map(
                (item) => ({
                  type:
                    item._id ||
                    "Other",

                  count:
                    item.count || 0,
                })
              ),
          },

          /*
          |--------------------------------------------------------------------------
          | BOOKINGS
          |--------------------------------------------------------------------------
          */

          bookings: {
            total: totalBookings,

            pending: pendingBookings,

            approved: approvedBookings,

            rejected: rejectedBookings,

            cancelled:
              cancelledBookings,

            completed:
              completedBookings,
          },

          /*
          |--------------------------------------------------------------------------
          | PAYMENTS
          |--------------------------------------------------------------------------
          */

          payments: {
            paidBookings,

            pendingPayments,

            failedPayments,

            refundedPayments,
          },

          /*
          |--------------------------------------------------------------------------
          | TRANSACTIONS
          |--------------------------------------------------------------------------
          */

          transactions: {
            total: totalTransactions,

            paid: paidTransactions,

            pending:
              pendingTransactions,

            failed:
              failedTransactions,

            refunded:
              refundedTransactions,
          },

          /*
          |--------------------------------------------------------------------------
          | REVENUE
          |--------------------------------------------------------------------------
          */

          revenue: {
            total:
              totalRevenue,

            monthly:
              formattedMonthlyRevenue,
          },

          /*
          |--------------------------------------------------------------------------
          | RECENT DATA
          |--------------------------------------------------------------------------
          */

          recent: {
            transactions:
              recentTransactions,

            bookings:
              recentBookings,

            properties:
              recentProperties,
          },
        },
      });
    } catch (error) {
      console.error(
        "Admin analytics error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to load admin analytics.",

        error:
          process.env.NODE_ENV ===
          "development"
            ? error.message
            : undefined,
      });
    }
  }
);

export default router;