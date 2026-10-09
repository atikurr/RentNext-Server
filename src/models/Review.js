import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    property: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
        required: true,
      },
      title: {
        type: String,
        required: true,
        trim: true,
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
        lowercase: true,
        trim: true,
      },
      photo: {
        type: String,
        default: "",
      },
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    comment: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

// One tenant can review a property only once
reviewSchema.index(
  {
    "property.id": 1,
    "tenant.id": 1,
  },
  {
    unique: true,
  }
);

const Review =
  mongoose.models.Review || mongoose.model("Review", reviewSchema);

export default Review;