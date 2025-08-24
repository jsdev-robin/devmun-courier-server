import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../configs/config';
import { ApiError } from '../../middlewares/errors/ApiError';
import parcelModel from '../../models/parcelModel';
import userModel, { IUser } from '../../models/userModel';
import { catchAsync } from '../../utils/catchAsync';
import HttpStatusCode from '../../utils/httpStatusCode';
import { Status } from '../../utils/status';
import { uploadToCloudinary } from '../../utils/uploadToCloudinary';
import {
  getParcelStatusDistribution,
  getParcelStatusDistributionByTime,
} from '../analytics/analytics';
import { SendMail } from '../email/SendMail';
import { QueryServices } from '../features/QueryServices';

export class AdminStatsServices {
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

  public readAllAgent = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const page = req.query.page
        ? parseInt(String(req.query.page), 10) || 1
        : 1;
      const limit = req.query.limit
        ? parseInt(String(req.query.limit), 10) || 20
        : 20;

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

  public readAllCustomer = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const page = req.query.page
        ? parseInt(String(req.query.page), 10) || 1
        : 1;
      const limit = req.query.limit
        ? parseInt(String(req.query.limit), 10) || 20
        : 20;

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

  public parcelAssignToAgent = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const { parcelId, agentId, priority, notes } = req.body;

      const parcel = await parcelModel
        .findByIdAndUpdate(
          parcelId,
          {
            agent: agentId,
            priority: priority,
            notes: notes,
            status: 'picked_up',
          },
          { new: true }
        )
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

  public inviteNewAgnet = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const { email } = req.body;
      const userExists = await userModel.findOne({ email }).exec();

      // If user exists, return a 400 error with message
      if (userExists) {
        return next(
          new ApiError(
            'This email is already registered. Use a different email address.',
            HttpStatusCode.BAD_REQUEST
          )
        );
      }

      const token = jwt.sign({ email: email }, config.ACTIVATION_SECRET, {
        expiresIn: '3d',
      });

      const mailData = {
        user: {
          email,
        },
        token: token,
        origin: config.ISPRODUCTION
          ? 'https://www.devmun.xyz/agent/create'
          : 'http://localhost:3000/agent/create',
      };

      await new SendMail(mailData)
        .agentInvite()
        .then(() => {
          // On success, send OK response with verification token
          res.status(HttpStatusCode.OK).json({
            status: Status.SUCCESS,
            message: 'Your invitation send successfully',
            data: {
              token,
            },
          });
        })
        .catch(() => {
          // On failure, pass error to the next middleware
          return next(
            new ApiError(
              'An error occurred while sending the verification email. Please try again later.',
              HttpStatusCode.INTERNAL_SERVER_ERROR
            )
          );
        });
    }
  );

  public createAgent = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const token = req.body.token;

      const decoded = jwt.verify(token, config.ACTIVATION_SECRET) as {
        email: string;
      };

      const file = req.file as Express.Multer.File;

      const result = await uploadToCloudinary(file.buffer);

      if (!result) {
        return next(
          new ApiError('No images uploaded', HttpStatusCode.BAD_REQUEST)
        );
      }

      await userModel.create({
        ...req.body,
        avatar: {
          url: result.url,
          public_id: result.public_id,
        },
        role: 'agent',
        email: decoded.email,
      });

      res.status(HttpStatusCode.CREATED).json({
        status: Status.SUCCESS,
        message: 'Your agent account has been created successfully.',
      });
    }
  );

  public parcelStatusDistribution = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { timeframe } = req.query;

      let data;
      if (timeframe && ['day', 'week', 'month'].includes(timeframe as string)) {
        data = await getParcelStatusDistributionByTime(
          timeframe as 'day' | 'week' | 'month'
        );
      } else {
        data = await getParcelStatusDistribution();
      }
      res.status(HttpStatusCode.CREATED).json({
        status: Status.SUCCESS,
        message: 'Parcel status distribution retrieved successfully.',
        data: {
          data,
        },
      });
    }
  );
}
