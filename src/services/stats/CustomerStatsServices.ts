import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import parcelModel from '../../models/parcelModel';
import { catchAsync } from '../../utils/catchAsync';
import HttpStatusCode from '../../utils/httpStatusCode';
import { Status } from '../../utils/status';
import { QueryServices } from '../features/QueryServices';

function generateTrackingId() {
  return 'TRK-' + uuidv4().split('-')[0].toUpperCase();
}

export class CustomerStatsServices {
  public readAllParcel = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const page = req.query.page
        ? parseInt(String(req.query.page), 10) || 1
        : 1;
      const limit = req.query.limit
        ? parseInt(String(req.query.limit), 10) || 20
        : 20;

      const features = new QueryServices(parcelModel, {
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
          select: 'familyName givenName email phone avatar address',
        })
        .populate({
          path: 'agent',
          select: 'familyName givenName email phone avatar address',
        });

      const { data, total } = await features.exec();

      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'Parcels fetched successfully.',
        data: {
          data,
          total,
          pagination: {
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            itemsPerPage: limit,
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1,
            nextPage: page < Math.ceil(total / limit) ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null,
          },
        },
      });
    }
  );

  public createByCustomer = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      await parcelModel.create({
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
}
