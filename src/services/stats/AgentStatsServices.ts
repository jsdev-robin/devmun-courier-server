import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../../middlewares/errors/ApiError';
import parcelModel from '../../models/parcelModel';
import { catchAsync } from '../../utils/catchAsync';
import HttpStatusCode from '../../utils/httpStatusCode';
import { Status } from '../../utils/status';
import { QueryServices } from '../features/QueryServices';

interface DateFilter {
  createdAt?: {
    $gte?: Date;
    $lte?: Date;
    $lt?: Date;
  };
  agent?: mongoose.Types.ObjectId;
}

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

  public getParcelAnalytics = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { startDate, endDate } = req.query;

      const dateFilter: DateFilter = {
        agent: new mongoose.Types.ObjectId(req.self._id),
      };

      if (startDate && endDate) {
        dateFilter.createdAt = {
          $gte: new Date(startDate as string),
          $lte: new Date(endDate as string),
        };
      } else if (startDate) {
        dateFilter.createdAt = {
          $gte: new Date(startDate as string),
        };
      } else if (endDate) {
        dateFilter.createdAt = {
          $lte: new Date(endDate as string),
        };
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        dateFilter.createdAt = {
          $gte: today,
          $lt: tomorrow,
        };
      }

      const analytics = await parcelModel.aggregate([
        {
          $match: dateFilter,
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalCOD: { $sum: '$codAmount' },
            averageCOD: { $avg: '$codAmount' },
            parcels: {
              $push: {
                _id: '$_id',
                trackingId: '$trackingId',
                receiverName: '$receiverName',
                codAmount: '$codAmount',
                createdAt: '$createdAt',
              },
            },
          },
        },
        {
          $lookup: {
            from: 'parcels',
            let: { status: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$status', '$$status'] },
                      {
                        $eq: [
                          '$agent',
                          new mongoose.Types.ObjectId(req.self._id),
                        ],
                      },
                      dateFilter.createdAt?.$gte
                        ? { $gte: ['$createdAt', dateFilter.createdAt.$gte] }
                        : { $eq: [true, true] },
                      dateFilter.createdAt?.$lte
                        ? { $lte: ['$createdAt', dateFilter.createdAt.$lte] }
                        : { $eq: [true, true] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: '$parcelSize',
                  count: { $sum: 1 },
                  totalCOD: { $sum: '$codAmount' },
                },
              },
            ],
            as: 'sizeBreakdown',
          },
        },
        {
          $lookup: {
            from: 'parcels',
            let: { status: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$status', '$$status'] },
                      {
                        $eq: [
                          '$agent',
                          new mongoose.Types.ObjectId(req.self._id),
                        ],
                      },
                      dateFilter.createdAt?.$gte
                        ? { $gte: ['$createdAt', dateFilter.createdAt.$gte] }
                        : { $eq: [true, true] },
                      dateFilter.createdAt?.$lte
                        ? { $lte: ['$createdAt', dateFilter.createdAt.$lte] }
                        : { $eq: [true, true] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: '$parcelType',
                  count: { $sum: 1 },
                  totalCOD: { $sum: '$codAmount' },
                },
              },
            ],
            as: 'typeBreakdown',
          },
        },
        {
          $lookup: {
            from: 'parcels',
            let: { status: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$status', '$$status'] },
                      {
                        $eq: [
                          '$agent',
                          new mongoose.Types.ObjectId(req.self._id),
                        ],
                      },
                      dateFilter.createdAt?.$gte
                        ? { $gte: ['$createdAt', dateFilter.createdAt.$gte] }
                        : { $eq: [true, true] },
                      dateFilter.createdAt?.$lte
                        ? { $lte: ['$createdAt', dateFilter.createdAt.$lte] }
                        : { $eq: [true, true] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: '$priority',
                  count: { $sum: 1 },
                  totalCOD: { $sum: '$codAmount' },
                },
              },
            ],
            as: 'priorityBreakdown',
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      const totalSummary = await parcelModel.aggregate([
        {
          $match: dateFilter,
        },
        {
          $group: {
            _id: null,
            totalParcels: { $sum: 1 },
            totalCOD: { $sum: '$codAmount' },
            avgCOD: { $avg: '$codAmount' },
            deliveredCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0],
              },
            },
            inTransitCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'in_transit'] }, 1, 0],
              },
            },
          },
        },
      ]);

      const agentInfo = await mongoose
        .model('User')
        .findById(req.self._id)
        .select('name email phone');

      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'Parcel analytics data retrieved successfully',
        agent: agentInfo,
        dateRange: {
          start:
            dateFilter.createdAt?.$gte ||
            new Date(new Date().setHours(0, 0, 0, 0)),
          end:
            dateFilter.createdAt?.$lte ||
            new Date(new Date().setHours(23, 59, 59, 999)),
        },
        data: {
          analytics,
          summary: totalSummary[0] || {
            totalParcels: 0,
            totalCOD: 0,
            avgCOD: 0,
            deliveredCount: 0,
            inTransitCount: 0,
          },
        },
      });
    }
  );
}
