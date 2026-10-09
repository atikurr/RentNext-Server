import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    // ========================================
    // PROPERTY INFORMATION
    // ========================================

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

      rent: {
        type: Number,
        required: true,
        min: 0,
      },

      rentType: {
        type: String,
        enum: [
          "Monthly",
          "Yearly",
          "Weekly",
          "Daily",
        ],
        default: "Monthly",
      },
    },

    // ========================================
    // TENANT INFORMATION
    // ========================================

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

      phone: {
        type: String,
        default: "",
        trim: true,
      },

      photo: {
        type: String,
        default: "",
      },
    },

    // ========================================
    // OWNER INFORMATION
    // ========================================

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

      photo: {
        type: String,
        default: "",
      },
    },

    // ========================================
    // BOOKING DATES
    // ========================================

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    // ========================================
    // BOOKING DURATION
    // ========================================

    duration: {
      type: Number,
      required: true,
      min: 1,
    },

    // ========================================
    // PAYMENT AMOUNT
    // ========================================

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // ========================================
    // ADDITIONAL NOTE
    // ========================================

    note: {
      type: String,
      default: "",
      trim: true,
    },

    // ========================================
    // BOOKING STATUS
    // ========================================

    status: {
      type: String,
      enum: [
        "Pending",
        "Approved",
        "Rejected",
        "Cancelled",
        "Completed",
      ],
      default: "Pending",
    },

    // ========================================
    // REJECTION FEEDBACK
    // ========================================

    rejectionFeedback: {
      type: String,
      default: "",
      trim: true,
    },

    // ========================================
    // PAYMENT STATUS
    // ========================================

    paymentStatus: {
      type: String,
      enum: [
        "Pending",
        "Paid",
        "Failed",
        "Refunded",
      ],
      default: "Pending",
    },

    paymentId: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Booking =
  mongoose.models.Booking ||
  mongoose.model("Booking", bookingSchema);

export default Booking;