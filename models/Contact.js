import mongoose from "mongoose";

const ContactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [80, "Name cannot exceed 80 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      maxlength: [120, "Email cannot exceed 120 characters"],
      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: (props) => `${props.value} is not a valid email address`,
      },
    },

    phone: {
      type: String,
      trim: true,
      maxlength: [30, "Phone number cannot exceed 30 characters"],
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional field
          return /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid phone number`,
      },
    },

    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      minlength: [3, "Subject must be at least 3 characters"],
      maxlength: [100, "Subject cannot exceed 100 characters"],
    },

    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      minlength: [10, "Message must be at least 10 characters"],
      maxlength: [1000, "Message cannot exceed 1000 characters"],
    },

    status: {
      type: String,
      enum: {
        values: ["New", "Read", "Responded", "Resolved"],
        message: "{VALUE} is not a valid status",
      },
      default: "New",
      index: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
ContactSchema.index({ createdAt: -1 });
ContactSchema.index({ status: 1, createdAt: -1 });

// Static method to find unread inquiries
ContactSchema.statics.findUnread = function () {
  return this.find({ status: "New" }).sort({ createdAt: -1 });
};

export default mongoose.model("Contact", ContactSchema);