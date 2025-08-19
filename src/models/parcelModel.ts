import mongoose, { Schema } from 'mongoose';

export interface IParcel extends Document {
  trackingId: string;
  customer: mongoose.Types.ObjectId;
  agent?: mongoose.Types.ObjectId;
  pickupAddress: string;
  deliveryAddress: string;
  size: 'small' | 'medium' | 'large';
  type: 'COD' | 'Prepaid';
  amount: number;
  status: 'Booked' | 'Picked Up' | 'In Transit' | 'Delivered' | 'Failed';
  history: {
    status: string;
    location?: {
      lat: number;
      lng: number;
    };
    updatedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const ParcelSchema: Schema = new Schema(
  {
    trackingId: { type: String, unique: true, required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    agent: { type: Schema.Types.ObjectId, ref: 'User' },
    pickupAddress: { type: String, required: true },
    deliveryAddress: { type: String, required: true },
    size: { type: String, enum: ['small', 'medium', 'large'], required: true },
    type: { type: String, enum: ['COD', 'Prepaid'], required: true },
    amount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['Booked', 'Picked Up', 'In Transit', 'Delivered', 'Failed'],
      default: 'Booked',
    },
    history: [
      {
        status: String,
        location: {
          lat: Number,
          lng: Number,
        },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IParcel>('Parcel', ParcelSchema);
