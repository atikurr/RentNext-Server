import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
  {
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
      photo: {
        type: String,
        default: "",
      },
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
      type: {
        type: String,
        required: true,
      },
      rent: {
        type: Number,
        required: true,
        min: 0,
      },
      rentType: {
        type: String,
        default: "Monthly",
      },
      image: {
        type: String,
        default: "",
      },
      bedrooms: {
        type: Number,
        default: 0,
      },
      bathrooms: {
        type: Number,
        default: 0,
      },
      size: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

favoriteSchema.index(
  {
    "tenant.id": 1,
    "property.id": 1,
  },
  {
    unique: true,
  }
);

const Favorite =
  mongoose.models.Favorite ||
  mongoose.model("Favorite", favoriteSchema);

export default Favorite;