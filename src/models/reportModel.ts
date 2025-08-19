import mongoose, { Schema } from 'mongoose';

export interface IReport extends Document {
  date: Date;
  totalBookings: number;
  delivered: number;
  failed: number;
  codAmount: number;
}

const ReportSchema: Schema = new Schema({
  date: { type: Date, required: true },
  totalBookings: Number,
  delivered: Number,
  failed: Number,
  codAmount: Number,
});

export default mongoose.model<IReport>('Report', ReportSchema);
