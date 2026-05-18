import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [80, "Name cannot exceed 80 characters"],
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      maxlength: [30, "Phone number cannot exceed 30 characters"],
      validate: {
        validator: function (v) {
          return /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid phone number`,
      },
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [120, "Email cannot exceed 120 characters"],
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: (props) => `${props.value} is not a valid email address`,
      },
    },

    occasion: {
      type: String,
      required: [true, "Occasion is required"],
      enum: {
        values: ["Birthday", "Wedding", "Graduation", "Baby Shower", "Corporate", "Other"],
        message: "{VALUE} is not a valid occasion type",
      },
    },

    eventDate: {
      type: Date,
      required: [true, "Event date is required"],
      validate: {
        validator: function (v) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return v >= today;
        },
        message: "Event date must be today or in the future",
      },
    },

    style: {
      type: String,
      trim: true,
      maxlength: [80, "Style description cannot exceed 80 characters"],
    },

    size: {
      type: String,
      required: [true, "Cake size is required"],
      trim: true,
      minlength: [2, "Size description must be at least 2 characters"],
      maxlength: [40, "Size description cannot exceed 40 characters"],
    },

    flavour: {
      type: String,
      required: [true, "Flavour is required"],
      trim: true,
      minlength: [2, "Flavour must be at least 2 characters"],
      maxlength: [60, "Flavour description cannot exceed 60 characters"],
    },

    budget: {
      type: String,
      trim: true,
      maxlength: [40, "Budget cannot exceed 40 characters"],
      enum: {
        values: ["", "R500–R800", "R800–R1200", "R1200–R2000", "R2000+"],
        message: "{VALUE} is not a valid budget range",
      },
    },

    fulfilment: {
      type: String,
      required: [true, "Pickup selection is required"],
      enum: {
        values: ["Pickup"],
        message: "{VALUE} is not a valid fulfilment option",
      },
      default: "Pickup",
    },

    area: {
      type: String,
      trim: true,
      maxlength: [80, "Area cannot exceed 80 characters"],
    },

    notes: {
      type: String,
      required: [true, "Design notes are required"],
      trim: true,
      minlength: [10, "Please provide at least 10 characters of design notes"],
      maxlength: [1200, "Design notes cannot exceed 1200 characters"],
    },

    inspirationUrl: {
      type: String,
      trim: true,
      maxlength: [300, "URL cannot exceed 300 characters"],
      validate: {
        validator: function (v) {
          if (!v) return true;
          try {
            new URL(v);
            return true;
          } catch (e) {
            return false;
          }
        },
        message: (props) => `${props.value} is not a valid URL`,
      },
    },

    status: {
      type: String,
      enum: {
        values: ["New", "Contacted", "Quoted", "Confirmed", "Completed", "Cancelled"],
        message: "{VALUE} is not a valid status",
      },
      default: "New",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries on common fields
OrderSchema.index({ eventDate: 1, status: 1 });
OrderSchema.index({ createdAt: -1 });

// Pre-save hook to keep orders pickup-only.
// Using async/await syntax for Mongoose 9
OrderSchema.pre("save", async function () {
  this.fulfilment = "Pickup";
  this.area = undefined;
});

// Virtual field for days until event
OrderSchema.virtual("daysUntilEvent").get(function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(this.eventDate);
  eventDate.setHours(0, 0, 0, 0);
  const diffTime = eventDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual field for urgency level
OrderSchema.virtual("urgency").get(function () {
  const days = this.daysUntilEvent;
  if (days < 0) return "Overdue";
  if (days <= 3) return "Urgent";
  if (days <= 7) return "Soon";
  return "Normal";
});

// Instance method to check if order is urgent
OrderSchema.methods.isUrgent = function () {
  return this.daysUntilEvent <= 5;
};

// Static method to find orders by date range
OrderSchema.statics.findByDateRange = function (startDate, endDate) {
  return this.find({
    eventDate: {
      $gte: startDate,
      $lte: endDate,
    },
  }).sort({ eventDate: 1 });
};

// Static method to find urgent orders
OrderSchema.statics.findUrgent = function () {
  const fiveDaysFromNow = new Date();
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

  return this.find({
    eventDate: { $lte: fiveDaysFromNow },
    status: { $in: ["New", "Contacted", "Quoted", "Confirmed"] },
  }).sort({ eventDate: 1 });
};

export default mongoose.model("Order", OrderSchema);
