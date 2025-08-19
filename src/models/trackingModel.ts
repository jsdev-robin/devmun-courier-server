import mongoose, { Document, Schema } from 'mongoose';

export interface ITracking extends Document {
  parcel: mongoose.Types.ObjectId;
  agent: mongoose.Types.ObjectId;
  location: {
    lat: number;
    lng: number;
  };
  status: string;
  updatedAt: Date;
}

const TrackingSchema: Schema = new Schema(
  {
    parcel: { type: Schema.Types.ObjectId, ref: 'Parcel', required: true },
    agent: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    status: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<ITracking>('Tracking', TrackingSchema);
