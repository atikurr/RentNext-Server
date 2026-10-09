import mongoose from "mongoose";

const transactionSchema =
  new mongoose.Schema(
    {
      transactionId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
      },

      paymentId: {
        type: String,
        default: "",
        trim: true,
      },

      bookingId: {
        type: String,
        required: true,
        trim: true,
      },

      property: {
        id: {
          type: String,
          required: true,
        },

        title: {
          type: String,
          required: true,
          trim: true,
        },

        location: {
          type: String,
          required: true,
          trim: true,
        },

        image: {
          type: String,
          default: "",
        },
      },

      tenant: {
        id: {
          type: String,
          required: true,
        },

        name: {
          type: String,
          required: true,
          trim: true,
        },

        email: {
          type: String,
          required: true,
          trim: true,
          lowercase: true,
        },
      },

      owner: {
        id: {
          type: String,
          required: true,
        },

        name: {
          type: String,
          required: true,
          trim: true,
        },

        email: {
          type: String,
          required: true,
          trim: true,
          lowercase: true,
        },
      },

      amount: {
        type: Number,
        required: true,
        min: 0,
      },

      currency: {
        type: String,
        default: "BDT",
        uppercase: true,
        trim: true,
      },

      paymentMethod: {
        type: String,
        default: "Stripe",
        trim: true,
      },

      status: {
        type: String,
        enum: [
          "Paid",
          "Failed",
          "Refunded",
          "Pending",
        ],
        default: "Paid",
      },

      transactionDate: {
        type: Date,
        default: Date.now,
      },
    },
    {
      timestamps: true,
    }
  );

const Transaction =
  mongoose.models.Transaction ||
  mongoose.model(
    "Transaction",
    transactionSchema
  );

export default Transaction;