import { NextFunction, Request, Response } from 'express';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ApiError } from '../../middlewares/errors/ApiError';
import { Notification } from '../../models/notificationModel';
import { IParcel } from '../../models/parcelModel';
import { parcelNamespace } from '../../server';
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
      const parcel = await this.model.create({
        ...req.body,
        trackingId: generateTrackingId(),
        customer: req.self._id,
      });

      const notification = await Notification.create({
        user: req.self._id,
        role: 'customer',
        parcel: parcel._id,
        title: 'Parcel Created',
        message: `Your parcel with tracking ID ${parcel.trackingId} has been created successfully.`,
        type: 'success',
      });

      parcelNamespace
        .to(req.self._id.toString())
        .emit('notification', notification);

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
          select: 'familyName givenName email avatar address',
        })
        .populate({
          path: 'agent',
          select: 'familyName givenName email avatar address',
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

  public readCustomerById = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const parcel = await this.model
        .findOne({
          $and: [{ _id: req.params.id }, { customer: req.self._id }],
        })
        .populate({
          path: 'customer',
          select: 'familyName givenName email phone avatar address',
        })
        .populate({
          path: 'agent',
          select: 'familyName givenName email phone avatar address',
        });

      if (!parcel) {
        return next(new ApiError('No parcel found', HttpStatusCode.NOT_FOUND));
      }

      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'Parcel has been retrieve successfully.',
        parcel,
      });
    }
  );

  public acceptParcelByAgent = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const id = req.params.id;

      await this.model.findOneAndUpdate(
        { _id: id },
        { agent: req.self._id, status: 'Picked Up' },
        { new: true }
      );

      // const agentNotification = await Notification.create({
      //   user: req.self._id,
      //   role: 'agent',
      //   parcel: parcel._id,
      //   title: 'Parcel Assigned',
      //   message: `You have been assigned to parcel ${parcel.trackingId}.`,
      //   type: 'info',
      // });

      // const customerNotification = await Notification.create({
      //   user: parcel.customer,
      //   role: 'customer',
      //   parcel: parcel._id,
      //   title: 'Parcel Picked Up',
      //   message: `Your parcel ${parcel.trackingId} has been picked up by the agent.`,
      //   type: 'success',
      // });

      // parcelNamespace
      //   .to(req.self._id.toString())
      //   .emit('notification', agentNotification);
      // parcelNamespace
      //   .to(parcel.customer.toString())
      //   .emit('notification', customerNotification);

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

      const customerNotification = await Notification.create({
        user: parcel.customer,
        role: 'customer',
        parcel: parcel._id,
        title: `Parcel ${req.body.status}`,
        message: `Your parcel ${parcel.trackingId} status has been updated to ${req.body.status}.`,
        type: 'info',
      });

      parcelNamespace
        .to(parcel.customer.toString())
        .emit('notification', customerNotification);

      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'Parcel status has been updated successfully.',
      });
    }
  );
}
