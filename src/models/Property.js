import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    // ========================================
    // BASIC INFORMATION
    // ========================================

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: [
        "Apartment",
        "House",
        "Studio",
        "Condo",
        "Villa",
        "Room",
        "Other",
      ],
      required: true,
    },

    // ========================================
    // RENT INFORMATION
    // ========================================

    rent: {
      type: Number,
      required: true,
      min: 0,
    },

    rentType: {
      type: String,
      enum: ["Monthly", "Yearly", "Weekly", "Daily"],
      default: "Monthly",
    },

    // ========================================
    // PROPERTY DETAILS
    // ========================================

    bedrooms: {
      type: Number,
      required: true,
      min: 0,
    },

    bathrooms: {
      type: Number,
      required: true,
      min: 0,
    },

    size: {
      type: Number,
      required: true,
      min: 0,
    },

    amenities: {
      type: [String],
      default: [],
    },

    extraFeatures: {
      type: [String],
      default: [],
    },

    // ========================================
    // IMAGES
    // ========================================

    images: {
      type: [String],
      required: true,
      validate: {
        validator: (value) => value.length > 0,
        message: "At least one property image is required.",
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
    // PROPERTY STATUS
    // ========================================

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    // ========================================
    // ADMIN REJECTION FEEDBACK
    // ========================================

    rejectionFeedback: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Property =
  mongoose.models.Property ||
  mongoose.model("Property", propertySchema);

export default Property;