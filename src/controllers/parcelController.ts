import parcelModel from '../models/parcelModel';
import { ParcelServices } from '../services/parcel/ParcelServices';

export const parcelController = new ParcelServices(parcelModel);
