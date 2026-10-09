import express from "express";
import { MongoClient, ObjectId } from "mongodb";

import {
  protect,
  requireRole,
} from "../middleware/authMiddleware.js";

const router = express.Router();

const mongoClient = new MongoClient(
  process.env.MONGODB_URL
);

const getUserCollection = async () => {
  if (!mongoClient.topology?.isConnected()) {
    await mongoClient.connect();
  }

  const database =
    mongoClient.db("property_db");

  return database.collection("user");
};

/*
|--------------------------------------------------------------------------
| GET ALL USERS
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
        role = "all",
        page = 1,
        limit = 10,
      } = req.query;

      const currentPage = Math.max(
        Number(page) || 1,
        1
      );

      const perPage = Math.min(
        Math.max(
          Number(limit) || 10,
          1
        ),
        50
      );

      const collection =
        await getUserCollection();

      const filter = {};

      /*
      |--------------------------------------------------------------------------
      | SEARCH
      |--------------------------------------------------------------------------
      */

      if (search.trim()) {
        const searchRegex =
          new RegExp(
            search.trim(),
            "i"
          );

        filter.$or = [
          {
            name: searchRegex,
          },
          {
            email: searchRegex,
          },
        ];
      }

      /*
      |--------------------------------------------------------------------------
      | ROLE FILTER
      |--------------------------------------------------------------------------
      */

      if (
        role !== "all" &&
        [
          "tenant",
          "owner",
          "admin",
        ].includes(role)
      ) {
        filter.role = role;
      }

      /*
      |--------------------------------------------------------------------------
      | TOTAL USERS
      |--------------------------------------------------------------------------
      */

      const totalUsers =
        await collection.countDocuments(
          filter
        );

      const totalPages = Math.ceil(
        totalUsers / perPage
      );

      const safePage =
        totalPages > 0
          ? Math.min(
              currentPage,
              totalPages
            )
          : 1;

      const skip =
        (safePage - 1) *
        perPage;

      /*
      |--------------------------------------------------------------------------
      | USERS
      |--------------------------------------------------------------------------
      */

      const users =
        await collection
          .find(filter)
          .project({
            password: 0,
            passwordHash: 0,
          })
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(perPage)
          .toArray();

      /*
      |--------------------------------------------------------------------------
      | STATS
      |--------------------------------------------------------------------------
      */

      const [
        totalCount,
        tenantCount,
        ownerCount,
        adminCount,
      ] = await Promise.all([
        collection.countDocuments(),

        collection.countDocuments({
          role: "tenant",
        }),

        collection.countDocuments({
          role: "owner",
        }),

        collection.countDocuments({
          role: "admin",
        }),
      ]);

      return res.status(200).json({
        success: true,

        data: users,

        pagination: {
          currentPage: safePage,
          limit: perPage,
          totalUsers,
          totalPages,
          hasNextPage:
            safePage < totalPages,
          hasPreviousPage:
            safePage > 1,
        },

        stats: {
          total: totalCount,
          tenants: tenantCount,
          owners: ownerCount,
          admins: adminCount,
        },
      });
    } catch (error) {
      console.error(
        "Admin get users error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load users.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| CHANGE USER ROLE
|--------------------------------------------------------------------------
*/

router.patch(
  "/:id/role",
  protect,
  requireRole("admin"),
  async (req, res) => {
    try {
      const requestedId =
        String(
          req.params.id || ""
        ).trim();

      const {
        role,
        email,
      } = req.body;

      /*
      |--------------------------------------------------------------------------
      | VALIDATE ROLE
      |--------------------------------------------------------------------------
      */

      if (
        !["tenant", "owner"].includes(
          role
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Role must be tenant or owner.",
        });
      }

      if (!requestedId && !email) {
        return res.status(400).json({
          success: false,
          message:
            "User ID or email is required.",
        });
      }

      const collection =
        await getUserCollection();

      /*
      |--------------------------------------------------------------------------
      | BUILD USER SEARCH
      |--------------------------------------------------------------------------
      */

      const searchConditions = [];

      if (requestedId) {
        searchConditions.push({
          id: requestedId,
        });
      }

      if (email) {
        searchConditions.push({
          email: String(
            email
          )
            .trim()
            .toLowerCase(),
        });
      }

      if (
        requestedId &&
        ObjectId.isValid(
          requestedId
        )
      ) {
        searchConditions.push({
          _id: new ObjectId(
            requestedId
          ),
        });
      }

      /*
      |--------------------------------------------------------------------------
      | FIND USER
      |--------------------------------------------------------------------------
      */

      let user = null;

      if (
        searchConditions.length === 1
      ) {
        user =
          await collection.findOne(
            searchConditions[0]
          );
      } else {
        user =
          await collection.findOne({
            $or: searchConditions,
          });
      }

      /*
      |--------------------------------------------------------------------------
      | USER NOT FOUND
      |--------------------------------------------------------------------------
      */

      if (!user) {
        console.log(
          "Admin role change - user not found:",
          {
            requestedId,
            email,
          }
        );

        return res.status(404).json({
          success: false,
          message:
            "User not found.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | PROTECT ADMIN
      |--------------------------------------------------------------------------
      */

      if (
        user.role === "admin"
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Admin role cannot be changed from this interface.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | UPDATE FILTER
      |--------------------------------------------------------------------------
      */

      let updateFilter;

      if (user.id) {
        updateFilter = {
          id: user.id,
        };
      } else {
        updateFilter = {
          _id: user._id,
        };
      }

      /*
      |--------------------------------------------------------------------------
      | UPDATE ROLE
      |--------------------------------------------------------------------------
      */

      const updateResult =
        await collection.updateOne(
          updateFilter,
          {
            $set: {
              role,
              updatedAt:
                new Date(),
            },
          }
        );

      if (
        updateResult.matchedCount ===
        0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "User could not be updated.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | GET UPDATED USER
      |--------------------------------------------------------------------------
      */

      const updatedUser =
        await collection.findOne(
          updateFilter
        );

      /*
      |--------------------------------------------------------------------------
      | RESPONSE
      |--------------------------------------------------------------------------
      */

      return res.status(200).json({
        success: true,

        message:
          "User role updated successfully.",

        data: updatedUser,
      });
    } catch (error) {
      console.error(
        "Admin change user role error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to change user role.",
      });
    }
  }
);

export default router;