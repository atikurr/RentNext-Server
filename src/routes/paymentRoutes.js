import express from "express";
import Stripe from "stripe";

import Property from "../models/Property.js";
import Booking from "../models/Booking.js";
import Transaction from "../models/Transaction.js";

const router = express.Router();

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "http://localhost:3000";

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

const getPropertyOwner = (property) => {
  const owner =
    property?.owner ||
    property?.ownerInfo ||
    {};

  return {
    id:
      owner?.id ||
      owner?._id ||
      property?.ownerId ||
      "",

    name:
      owner?.name ||
      property?.ownerName ||
      "Property Owner",

    email:
      owner?.email ||
      property?.ownerEmail ||
      "",

    photo:
      owner?.photo ||
      owner?.image ||
      property?.ownerPhoto ||
      "",
  };
};

const getPropertyImage = (property) => {
  if (
    Array.isArray(property?.images) &&
    property.images.length > 0
  ) {
    return property.images[0];
  }

  return property?.image || "";
};

const calculateEndDate = (
  startDate,
  duration
) => {
  const endDate =
    new Date(startDate);

  endDate.setMonth(
    endDate.getMonth() +
      Number(duration)
  );

  return endDate;
};

/*
|--------------------------------------------------------------------------
| CHECK PROPERTY AVAILABILITY
|--------------------------------------------------------------------------
|
| Same property + overlapping dates = unavailable
|
| Same property + different dates = available
|
| Rejected / Cancelled bookings do not block
|
|--------------------------------------------------------------------------
*/

const checkPropertyAvailability = async ({
  propertyId,
  startDate,
  endDate,
  excludeBookingId = null,
}) => {
  const query = {
    "property.id": String(
      propertyId
    ),

    status: {
      $nin: [
        "Rejected",
        "Cancelled",
      ],
    },

    startDate: {
      $lt: endDate,
    },

    endDate: {
      $gt: startDate,
    },
  };

  if (excludeBookingId) {
    query._id = {
      $ne: excludeBookingId,
    };
  }

  const existingBooking =
    await Booking.findOne(query);

  return !existingBooking;
};

/*
|--------------------------------------------------------------------------
| CREATE STRIPE CHECKOUT SESSION
|--------------------------------------------------------------------------
|
| POST
| /api/payments/create-checkout-session
|
|--------------------------------------------------------------------------
*/

router.post(
  "/create-checkout-session",
  async (req, res) => {
    try {
      const {
        propertyId,
        moveInDate,
        duration,
        phone,
        additionalNotes,

        tenantId,
        tenantName,
        tenantEmail,
        tenantPhoto,
      } = req.body;

      /*
      |--------------------------------------------------------------------------
      | VALIDATION
      |--------------------------------------------------------------------------
      */

      if (!propertyId) {
        return res.status(400).json({
          success: false,
          message:
            "Property ID is required.",
        });
      }

      if (!moveInDate) {
        return res.status(400).json({
          success: false,
          message:
            "Move-in date is required.",
        });
      }

      const bookingDuration =
        Number(duration);

      if (
        !Number.isInteger(
          bookingDuration
        ) ||
        bookingDuration < 1
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Booking duration must be at least 1 month.",
        });
      }

      if (!tenantId) {
        return res.status(401).json({
          success: false,
          message:
            "Tenant information is missing. Please login again.",
        });
      }

      if (!tenantEmail) {
        return res.status(400).json({
          success: false,
          message:
            "Tenant email is required.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | FIND PROPERTY
      |--------------------------------------------------------------------------
      */

      const property =
        await Property.findById(
          propertyId
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
      | PROPERTY STATUS
      |--------------------------------------------------------------------------
      */

      const propertyStatus =
        String(
          property.status || ""
        ).toLowerCase();

      if (
        propertyStatus &&
        propertyStatus !== "approved"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This property is not currently available for booking.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | RENT
      |--------------------------------------------------------------------------
      */

      const monthlyRent =
        Number(property.rent);

      if (
        !Number.isFinite(
          monthlyRent
        ) ||
        monthlyRent <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid rental price.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | START DATE
      |--------------------------------------------------------------------------
      */

      const startDate =
        new Date(moveInDate);

      if (
        Number.isNaN(
          startDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid move-in date.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | END DATE
      |--------------------------------------------------------------------------
      */

      const endDate =
        calculateEndDate(
          startDate,
          bookingDuration
        );

      /*
      |--------------------------------------------------------------------------
      | CHECK DATE AVAILABILITY
      |--------------------------------------------------------------------------
      */

      const isAvailable =
        await checkPropertyAvailability(
          {
            propertyId,
            startDate,
            endDate,
          }
        );

      if (!isAvailable) {
        return res.status(409).json({
          success: false,
          message:
            "This property is already booked for the selected dates. Please choose different dates.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | TOTAL AMOUNT
      |--------------------------------------------------------------------------
      */

      const totalAmount =
        monthlyRent *
        bookingDuration;

      /*
      |--------------------------------------------------------------------------
      | STRIPE AMOUNT
      |--------------------------------------------------------------------------
      */

      const stripeAmount =
        Math.round(
          totalAmount * 100
        );

      /*
      |--------------------------------------------------------------------------
      | CREATE STRIPE SESSION
      |--------------------------------------------------------------------------
      */

      const checkoutSession =
        await stripe.checkout.sessions.create(
          {
            mode: "payment",

            line_items: [
              {
                price_data: {
                  currency: "bdt",

                  product_data: {
                    name:
                      property.title ||
                      "Property Rental",

                    description:
                      `${property.rentType || "Monthly"} rental - ${bookingDuration} month(s)`,
                  },

                  unit_amount:
                    stripeAmount,
                },

                quantity: 1,
              },
            ],

            customer_email:
              tenantEmail,

            success_url:
              `${FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,

            cancel_url:
              `${FRONTEND_URL}/payment?propertyId=${encodeURIComponent(
                propertyId
              )}&moveInDate=${encodeURIComponent(
                moveInDate
              )}&phone=${encodeURIComponent(
                phone || ""
              )}&additionalNotes=${encodeURIComponent(
                additionalNotes || ""
              )}&duration=${bookingDuration}`,

            metadata: {
              propertyId:
                String(propertyId),

              tenantId:
                String(tenantId),

              tenantName:
                String(
                  tenantName ||
                    "Tenant"
                ),

              tenantEmail:
                String(
                  tenantEmail
                ),

              tenantPhoto:
                String(
                  tenantPhoto || ""
                ),

              moveInDate:
                String(moveInDate),

              duration:
                String(
                  bookingDuration
                ),

              phone:
                String(phone || ""),

              additionalNotes:
                String(
                  additionalNotes || ""
                ),

              totalAmount:
                String(
                  totalAmount
                ),
            },
          }
        );

      /*
      |--------------------------------------------------------------------------
      | RESPONSE
      |--------------------------------------------------------------------------
      */

      return res.status(200).json({
        success: true,

        checkoutUrl:
          checkoutSession.url,

        sessionId:
          checkoutSession.id,
      });
    } catch (error) {
      console.error(
        "Stripe checkout creation error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to create Stripe checkout session.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| VERIFY STRIPE PAYMENT
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Frontend success page calls:
|
| /api/payments/verify-session/:sessionId
|
|--------------------------------------------------------------------------
*/

router.get(
  "/verify-session/:sessionId",
  async (req, res) => {
    try {
      const {
        sessionId,
      } = req.params;

      /*
      |--------------------------------------------------------------------------
      | SESSION ID
      |--------------------------------------------------------------------------
      */

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          paid: false,
          message:
            "Stripe session ID is required.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | GET STRIPE SESSION
      |--------------------------------------------------------------------------
      */

      const stripeSession =
        await stripe.checkout.sessions.retrieve(
          sessionId
        );

      /*
      |--------------------------------------------------------------------------
      | VERIFY PAYMENT
      |--------------------------------------------------------------------------
      */

      if (
        stripeSession.payment_status !==
        "paid"
      ) {
        return res.status(400).json({
          success: false,
          paid: false,
          message:
            "Your payment has not been completed.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | METADATA
      |--------------------------------------------------------------------------
      */

      const metadata =
        stripeSession.metadata || {};

      const propertyId =
        metadata.propertyId;

      const tenantId =
        metadata.tenantId;

      const tenantName =
        metadata.tenantName ||
        "Tenant";

      const tenantEmail =
        metadata.tenantEmail ||
        stripeSession.customer_email ||
        "";

      const tenantPhoto =
        metadata.tenantPhoto ||
        "";

      const moveInDate =
        metadata.moveInDate;

      const duration =
        Number(
          metadata.duration || 1
        );

      const phone =
        metadata.phone || "";

      const additionalNotes =
        metadata.additionalNotes ||
        "";

      const totalAmount =
        Number(
          metadata.totalAmount || 0
        );

      /*
      |--------------------------------------------------------------------------
      | VALIDATE METADATA
      |--------------------------------------------------------------------------
      */

      if (!propertyId) {
        return res.status(400).json({
          success: false,
          paid: true,
          message:
            "Property information is missing from Stripe session.",
        });
      }

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          paid: true,
          message:
            "Tenant information is missing from Stripe session.",
        });
      }

      if (!tenantEmail) {
        return res.status(400).json({
          success: false,
          paid: true,
          message:
            "Tenant email is missing from Stripe session.",
        });
      }

      if (!moveInDate) {
        return res.status(400).json({
          success: false,
          paid: true,
          message:
            "Move-in date is missing from Stripe session.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | FIND PROPERTY
      |--------------------------------------------------------------------------
      */

      const property =
        await Property.findById(
          propertyId
        );

      if (!property) {
        return res.status(404).json({
          success: false,
          paid: true,
          message:
            "Property not found.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | PAYMENT ID
      |--------------------------------------------------------------------------
      */

      const paymentId =
        stripeSession.payment_intent
          ? String(
              stripeSession.payment_intent
            )
          : String(
              stripeSession.id
            );

      /*
      |--------------------------------------------------------------------------
      | CHECK EXISTING TRANSACTION
      |--------------------------------------------------------------------------
      |
      | Refreshing the success page should NOT
      | create another booking.
      |
      |--------------------------------------------------------------------------
      */

      const existingTransaction =
        await Transaction.findOne({
          paymentId,
        });

      if (existingTransaction) {
        const existingBooking =
          await Booking.findOne({
            paymentId,
          });

        return res.status(200).json({
          success: true,
          paid: true,
          alreadyProcessed: true,

          booking:
            existingBooking
              ? {
                  ...existingBooking.toObject(),
                  id:
                    String(
                      existingBooking._id
                    ),
                }
              : null,

          transaction:
            existingTransaction,

          property:
            existingTransaction.property,

          message:
            "Payment was already verified.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | DATE VALIDATION
      |--------------------------------------------------------------------------
      */

      const startDate =
        new Date(moveInDate);

      if (
        Number.isNaN(
          startDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          paid: true,
          message:
            "Invalid move-in date.",
        });
      }

      const endDate =
        calculateEndDate(
          startDate,
          duration
        );

      /*
      |--------------------------------------------------------------------------
      | CHECK AVAILABILITY AGAIN
      |--------------------------------------------------------------------------
      |
      | Important because another user could have booked
      | the property while this payment was being processed.
      |
      |--------------------------------------------------------------------------
      */

      const isAvailable =
        await checkPropertyAvailability(
          {
            propertyId,
            startDate,
            endDate,
          }
        );

      if (!isAvailable) {
        return res.status(409).json({
          success: false,
          paid: true,
          bookingCreated: false,
          message:
            "Payment was successful, but this property is no longer available for the selected dates.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | PROPERTY IMAGE
      |--------------------------------------------------------------------------
      */

      const propertyImage =
        getPropertyImage(
          property
        );

      /*
      |--------------------------------------------------------------------------
      | OWNER
      |--------------------------------------------------------------------------
      */

      const owner =
        getPropertyOwner(
          property
        );

      if (!owner.id) {
        return res.status(400).json({
          success: false,
          paid: true,
          message:
            "Property owner information is missing.",
        });
      }

      if (!owner.email) {
        return res.status(400).json({
          success: false,
          paid: true,
          message:
            "Property owner email is missing.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | BOOKING PROPERTY
      |--------------------------------------------------------------------------
      */

      const bookingProperty = {
        id: String(
          property._id
        ),

        title:
          property.title ||
          "Property",

        location:
          property.location ||
          "",

        image:
          propertyImage,

        rent:
          Number(
            property.rent || 0
          ),

        rentType:
          property.rentType ||
          "Monthly",
      };

      /*
      |--------------------------------------------------------------------------
      | BOOKING TENANT
      |--------------------------------------------------------------------------
      */

      const bookingTenant = {
        id: String(
          tenantId
        ),

        name:
          tenantName,

        email:
          tenantEmail,

        phone:
          phone || "",

        photo:
          tenantPhoto || "",
      };

      /*
      |--------------------------------------------------------------------------
      | BOOKING OWNER
      |--------------------------------------------------------------------------
      */

      const bookingOwner = {
        id: String(
          owner.id
        ),

        name:
          owner.name,

        email:
          owner.email,

        photo:
          owner.photo || "",
      };

      /*
      |--------------------------------------------------------------------------
      | CREATE BOOKING
      |--------------------------------------------------------------------------
      */

      const booking =
        await Booking.create({
          property:
            bookingProperty,

          tenant:
            bookingTenant,

          owner:
            bookingOwner,

          startDate,

          endDate,

          duration,

          totalAmount,

          note:
            additionalNotes,

          status:
            "Pending",

          rejectionFeedback:
            "",

          paymentStatus:
            "Paid",

          paymentId,
        });

      /*
      |--------------------------------------------------------------------------
      | CREATE TRANSACTION
      |--------------------------------------------------------------------------
      */

      let transaction;

      try {
        transaction =
          await Transaction.create({
            transactionId:
              paymentId,

            paymentId,

            bookingId:
              String(
                booking._id
              ),

            property: {
              id:
                String(
                  property._id
                ),

              title:
                property.title ||
                "Property",

              location:
                property.location ||
                "",

              image:
                propertyImage,
            },

            tenant: {
              id:
                String(
                  tenantId
                ),

              name:
                tenantName,

              email:
                tenantEmail,
            },

            owner: {
              id:
                String(
                  owner.id
                ),

              name:
                owner.name,

              email:
                owner.email,
            },

            amount:
              totalAmount,

            currency:
              "BDT",

            paymentMethod:
              "Stripe",

            status:
              "Paid",

            transactionDate:
              new Date(),
          });
      } catch (transactionError) {
        /*
        |--------------------------------------------------------------------------
        | ROLLBACK BOOKING
        |--------------------------------------------------------------------------
        */

        await Booking.findByIdAndDelete(
          booking._id
        );

        throw transactionError;
      }

      /*
      |--------------------------------------------------------------------------
      | SUCCESS RESPONSE
      |--------------------------------------------------------------------------
      */

      return res.status(200).json({
        success: true,

        paid: true,

        booking: {
          ...booking.toObject(),

          id:
            String(
              booking._id
            ),
        },

        transaction,

        property: {
          id:
            String(
              property._id
            ),

          title:
            property.title ||
            "Property",

          location:
            property.location ||
            "",

          image:
            propertyImage,
        },

        message:
          "Payment verified and booking created successfully.",
      });
    } catch (error) {
      console.error(
        "Payment verification error:",
        error
      );

      return res.status(500).json({
        success: false,
        paid: false,
        message:
          error?.message ||
          "Payment verification failed.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

export default router;