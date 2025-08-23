import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../middlewares/errors/ApiError';
import parcelModel from '../../models/parcelModel';
import userModel, { IUser } from '../../models/userModel';
import { catchAsync } from '../../utils/catchAsync';
import HttpStatusCode from '../../utils/httpStatusCode';
import { Status } from '../../utils/status';
import { SendMail } from '../email/SendMail';
import { QueryServices } from '../features/QueryServices';

export class AdminStatsServices {
  public readAllParcel = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const parcels = await parcelModel
        .find()
        .populate({
          path: 'customer',
          select: 'familyName givenName email phone avatar address',
        })
        .populate({
          path: 'agent',
          select: 'familyName givenName email phone avatar address',
        });

      if (!parcels || parcels.length === 0) {
        return next(new ApiError('No parcels found', HttpStatusCode.NOT_FOUND));
      }

      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'Parcels fetched successfully.',
        data: parcels,
      });
    }
  );

  public readAllAgent = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const features = new QueryServices(userModel, {
        ...req.query,
        role: 'agent',
      })
        .filter()
        .sort()
        .limitFields()
        .paginate()
        .globalSearch(['familyName']);

      const { data, total } = await features.exec();

      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'Agents fetched successfully.',
        data: {
          data,
          total,
        },
      });
    }
  );

  public readAllCustomer = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const features = new QueryServices(userModel, {
        ...req.query,
        role: 'customer',
      })
        .filter()
        .sort()
        .limitFields()
        .paginate()
        .globalSearch(['familyName']);

      const { data, total } = await features.exec();

      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'Customers fetched successfully.',
        data: {
          data,
          total,
        },
      });
    }
  );

  public parcelAssignToAgent = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const { parcelId, agentId } = req.body;

      const parcel = await parcelModel
        .findByIdAndUpdate(parcelId, { agent: agentId }, { new: true })
        .populate<{ customer: IUser }>(
          'customer',
          'familyName givenName phone address email phone'
        )
        .populate<{ agent: IUser }>(
          'agent',
          'familyName givenName phone address email phone'
        );

      const customerEmailPayload = {
        user: {
          name: parcel?.customer?.familyName ?? '',
          email: parcel?.customer?.email ?? '',
        },
        parcel: {
          trackingId: parcel?.trackingId,
        },
        agent: {
          familyName: parcel?.agent?.familyName,
          phone: parcel?.agent?.phone,
          email: parcel?.agent?.email,
        },
      };

      const agentEmailPayload = {
        user: {
          name: parcel?.agent?.familyName ?? '',
          email: parcel?.agent?.email ?? '',
        },
        parcel: {
          trackingId: parcel?.trackingId,
        },
        customer: {
          familyName: parcel?.customer?.familyName ?? 'unknown',
          givenName: parcel?.customer?.givenName ?? 'unknown',
          phone: parcel?.customer?.phone ?? 'unknown',
          address: parcel?.customer?.address?.addressLine1 ?? 'unknown',
        },
      };

      Promise.all([
        new SendMail(customerEmailPayload).parcelAssignCustomer(),
        new SendMail(agentEmailPayload).parcelAssignAgent(),
      ])
        .then(() => {
          res.status(HttpStatusCode.OK).json({
            status: Status.SUCCESS,
            message: 'This parcel has been assigned to a delivery agent',
          });
        })
        .catch(() => {
          return next(
            new ApiError(
              'An error occurred while sending the emails. Please try again later.',
              HttpStatusCode.INTERNAL_SERVER_ERROR
            )
          );
        });
    }
  );
}
