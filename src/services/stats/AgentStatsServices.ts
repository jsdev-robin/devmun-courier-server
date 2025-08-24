import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../middlewares/errors/ApiError';
import parcelModel from '../../models/parcelModel';
import { catchAsync } from '../../utils/catchAsync';
import HttpStatusCode from '../../utils/httpStatusCode';
import { Status } from '../../utils/status';
import { QueryServices } from '../features/QueryServices';

export class AgentStatsServices {
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
        agent: req.self._id,
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

  public updateStatusByAgent = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const parcel = await parcelModel.findOneAndUpdate(
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
