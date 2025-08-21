import { NextFunction, Request, Response } from 'express';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ApiError } from '../../middlewares/errors/ApiError';
import { IParcel } from '../../models/parcelModel';
import { catchAsync } from '../../utils/catchAsync';
import HttpStatusCode from '../../utils/httpStatusCode';
import { Status } from '../../utils/status';
import { QueryServices } from '../features/QueryServices';

function generateTrackingId() {
  return 'TRK-' + uuidv4().split('-')[0].toUpperCase();
}

export class ParcelServices<T extends IParcel> {
  private readonly model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  public createByCustomer = catchAsync(
    async (
      req: Request<unknown, unknown, IParcel>,
      res: Response
    ): Promise<void> => {
      await this.model.create({
        ...req.body,
        trackingId: generateTrackingId(),
        customer: req.self._id,
      });

      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'Parcel has been created successfully.',
      });
    }
  );

  public readCustomerAll = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const features = new QueryServices<any>(this.model, {
        ...req.query,
        customer: req.self._id,
      })
        .filter()
        .sort()
        .limitFields()
        .paginate()
        .globalSearch(['trackingId'])
        .populate({
          path: 'customer',
          select: 'familyName givenName email avatar -_id',
        });

      const { data, total } = await features.exec();

      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'Product has been retrieve successfully.',
        data,
        total,
      });
    }
  );

  public acceptParcelByAgent = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const id = req.params.id;

      const parcel = await this.model.findOneAndUpdate(
        { _id: id },
        { agent: req.self._id, status: 'Picked Up' },
        { new: true }
      );

      if (!parcel) {
        return next(new ApiError('Parcel not found', HttpStatusCode.NOT_FOUND));
      }

      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'Parcel has been accepted successfully.',
      });
    }
  );

  public updateStatusByAgent = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const parcel = await this.model.findOneAndUpdate(
        {
          $and: [{ _id: req.params.id }, { agent: req.self._id }],
        },
        { status: req.body.status },
        { new: true }
      );

      if (!parcel) {
        return next(new ApiError('Parcel not found', HttpStatusCode.NOT_FOUND));
      }

      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'Parcel status has been updated successfully.',
      });
    }
  );
}
