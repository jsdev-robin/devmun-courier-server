import mongoose, { Document, ObjectId, Schema } from 'mongoose';

export interface IParcel extends Document {
  _id: ObjectId;
  id: string;
  trackingId: string;
  customer: mongoose.Types.ObjectId;
  agent: mongoose.Types.ObjectId;
  receiverName: string;
  receiverPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  parcelSize: 'small' | 'medium' | 'large' | 'xlarge';
  parcelType: 'document' | 'package' | 'fragile' | 'electronics';
  paymentMethod: 'COD' | 'Prepaid';
  codAmount: number;
  status: 'booked' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';
  pickupLocation?: {
    lat: number;
    lng: number;
  };
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
    receiverName: { type: String, required: true },
    receiverPhone: { type: String, required: true },
    pickupAddress: { type: String, required: true },
    deliveryAddress: { type: String, required: true },
    parcelSize: {
      type: String,
      enum: ['small', 'medium', 'large'],
      required: true,
    },
    parcelType: {
      type: String,
      enum: ['document', 'package', 'fragile', 'electronics'],
      required: true,
    },
    paymentMethod: { type: String, enum: ['cod', 'prepaid'], required: true },
    codAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['booked', 'picked_up', 'in_transit', 'delivered', 'failed'],
      default: 'booked',
    },
    pickupLocation: {
      lat: { type: Number },
      lng: { type: Number },
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
