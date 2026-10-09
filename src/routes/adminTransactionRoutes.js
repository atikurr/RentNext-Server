import express from "express";

import Transaction from "../models/Transaction.js";
import {
  protect,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| GET ALL TRANSACTIONS
|--------------------------------------------------------------------------
| Admin only
| Supports:
| - Search
| - Status filter
| - Payment method filter
| - Pagination
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  protect,
  requireRole("admin"),
  async (req, res) => {
    try {
      const {
        search = "",
        status = "",
        paymentMethod = "",
        page = 1,
        limit = 10,
      } = req.query;

      const currentPage = Math.max(
        Number(page) || 1,
        1
      );

      const itemsPerPage = Math.min(
        Math.max(Number(limit) || 10, 1),
        50
      );

      const query = {};

      /*
      |--------------------------------------------------------------------------
      | Search
      |--------------------------------------------------------------------------
      */

      if (search.trim()) {
        const searchRegex =
          new RegExp(search.trim(), "i");

        query.$or = [
          {
            transactionId: searchRegex,
          },
          {
            paymentId: searchRegex,
          },
          {
            bookingId: searchRegex,
          },
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
      | Status Filter
      |--------------------------------------------------------------------------
      */

      if (status) {
        query.status = status;
      }

      /*
      |--------------------------------------------------------------------------
      | Payment Method Filter
      |--------------------------------------------------------------------------
      */

      if (paymentMethod) {
        query.paymentMethod =
          paymentMethod;
      }

      /*
      |--------------------------------------------------------------------------
      | Pagination
      |--------------------------------------------------------------------------
      */

      const skip =
        (currentPage - 1) *
        itemsPerPage;

      const [
        transactions,
        totalTransactions,
      ] = await Promise.all([
        Transaction.find(query)
          .sort({
            transactionDate: -1,
            createdAt: -1,
          })
          .skip(skip)
          .limit(itemsPerPage)
          .lean(),

        Transaction.countDocuments(query),
      ]);

      const totalPages =
        Math.ceil(
          totalTransactions /
            itemsPerPage
        );

      return res.status(200).json({
        success: true,
        data: transactions,
        pagination: {
          currentPage,
          limit: itemsPerPage,
          totalTransactions,
          totalPages,
          hasNextPage:
            currentPage < totalPages,
          hasPreviousPage:
            currentPage > 1,
        },
      });
    } catch (error) {
      console.error(
        "Get admin transactions error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch transactions.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET SINGLE TRANSACTION
|--------------------------------------------------------------------------
*/

router.get(
  "/:id",
  protect,
  requireRole("admin"),
  async (req, res) => {
    try {
      const transaction =
        await Transaction.findById(
          req.params.id
        ).lean();

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message:
            "Transaction not found.",
        });
      }

      return res.status(200).json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      console.error(
        "Get transaction details error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch transaction details.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| UPDATE TRANSACTION STATUS
|--------------------------------------------------------------------------
*/

router.patch(
  "/:id/status",
  protect,
  requireRole("admin"),
  async (req, res) => {
    try {
      const {
        status,
      } = req.body;

      const allowedStatuses = [
        "Paid",
        "Failed",
        "Refunded",
        "Pending",
      ];

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid transaction status.",
        });
      }

      const transaction =
        await Transaction.findById(
          req.params.id
        );

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message:
            "Transaction not found.",
        });
      }

      transaction.status = status;

      await transaction.save();

      return res.status(200).json({
        success: true,
        message:
          "Transaction status updated successfully.",
        data: transaction,
      });
    } catch (error) {
      console.error(
        "Update transaction status error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update transaction status.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| DELETE TRANSACTION
|--------------------------------------------------------------------------
*/

router.delete(
  "/:id",
  protect,
  requireRole("admin"),
  async (req, res) => {
    try {
      const transaction =
        await Transaction.findByIdAndDelete(
          req.params.id
        );

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message:
            "Transaction not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Transaction deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Delete transaction error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete transaction.",
      });
    }
  }
);

export default router;