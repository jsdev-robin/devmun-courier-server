import ExcelJS from 'exceljs';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
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

  public getParcelAnalytics = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { startDate, endDate } = req.body;

      const dateFilter: {
        createdAt?: {
          $gte?: Date;
          $lte?: Date;
          $lt?: Date;
        };
      } = {};

      if (startDate && endDate) {
        dateFilter.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      } else if (startDate) {
        dateFilter.createdAt = {
          $gte: new Date(startDate),
        };
      } else if (endDate) {
        dateFilter.createdAt = {
          $lte: new Date(endDate),
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

      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'Parcel analytics fetched successfully.',
        dateRange: {
          start:
            dateFilter.createdAt?.$gte ||
            new Date(new Date().setHours(0, 0, 0, 0)),
          end:
            dateFilter.createdAt?.$lte ||
            new Date(new Date().setHours(23, 59, 59, 999)),
        },
        analytics,
        summary: totalSummary[0] || {
          totalParcels: 0,
          totalCOD: 0,
          avgCOD: 0,
          deliveredCount: 0,
          inTransitCount: 0,
        },
      });
    }
  );

  public exportParcelDataIntoCSV = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Parcels');

      worksheet.columns = [
        { header: 'ID', key: '_id', width: 24 },
        { header: 'Tracking ID', key: 'trackingId', width: 20 },
        { header: 'Customer', key: 'customer', width: 24 },
        { header: 'Agent', key: 'agent', width: 24 },
        { header: 'Receiver Name', key: 'receiverName', width: 20 },
        { header: 'Receiver Phone', key: 'receiverPhone', width: 15 },
        { header: 'Pickup Address', key: 'pickupAddress', width: 30 },
        { header: 'Delivery Address', key: 'deliveryAddress', width: 30 },
        { header: 'Parcel Size', key: 'parcelSize', width: 15 },
        { header: 'Parcel Type', key: 'parcelType', width: 15 },
        { header: 'Payment Method', key: 'paymentMethod', width: 15 },
        { header: 'COD Amount', key: 'codAmount', width: 10 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Priority', key: 'priority', width: 10 },
        { header: 'Notes', key: 'notes', width: 30 },
      ];

      const parcels = await parcelModel.find();

      parcels.forEach((parcel) => {
        worksheet.addRow({
          _id: parcel._id.toString(),
          trackingId: parcel.trackingId,
          customer: parcel.customer?.toString() || '',
          agent: parcel.agent?.toString() || '',
          receiverName: parcel.receiverName,
          receiverPhone: parcel.receiverPhone,
          pickupAddress: parcel.pickupAddress,
          deliveryAddress: parcel.deliveryAddress,
          parcelSize: parcel.parcelSize,
          parcelType: parcel.parcelType,
          paymentMethod: parcel.paymentMethod,
          codAmount: parcel.codAmount,
          status: parcel.status,
          priority: parcel.priority || '',
          notes: parcel.notes || '',
        });
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', 'attachment; filename=parcels.xlsx');

      await workbook.xlsx.write(res);
      res.status(HttpStatusCode.OK).end();
    }
  );

  public exportParcelDataIntoPDF = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const parcels = await parcelModel.find();

      const doc = new PDFDocument({
        margin: 30,
        size: 'A4',
        layout: 'landscape',
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=parcels.pdf');

      doc.pipe(res);

      const paddingY = 5;
      const fontSize = 10;
      const lineHeight = fontSize + 2;

      let columns = [
        { label: 'Tracking ID', key: 'trackingId', width: 100 },
        { label: 'Customer', key: 'customer', width: 80 },
        { label: 'Agent', key: 'agent', width: 80 },
        { label: 'Receiver', key: 'receiverName', width: 100 },
        { label: 'Phone', key: 'receiverPhone', width: 80 },
        { label: 'Pickup', key: 'pickupAddress', width: 120 },
        { label: 'Delivery', key: 'deliveryAddress', width: 120 },
        { label: 'Size', key: 'parcelSize', width: 60 },
        { label: 'Type', key: 'parcelType', width: 80 },
        { label: 'Payment', key: 'paymentMethod', width: 60 },
        { label: 'COD', key: 'codAmount', width: 60 },
        { label: 'Status', key: 'status', width: 80 },
        { label: 'Priority', key: 'priority', width: 60 },
      ];

      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const totalWidth = columns.reduce((acc, c) => acc + c.width, 0);
      const scaleFactor = pageWidth / totalWidth;
      columns = columns.map((col) => ({
        ...col,
        width: col.width * scaleFactor,
      }));

      const tableWidth = columns.reduce((acc, c) => acc + c.width, 0);
      const startX = (doc.page.width - tableWidth) / 2;
      let y = 50;

      doc.fontSize(fontSize);

      const drawRow = (
        rowData: unknown[],
        rowHeight: number,
        isHeader = false,
        isAlternate = false
      ) => {
        let x = startX;
        if (isHeader) {
          doc
            .fillColor('#000')
            .rect(startX, y, tableWidth, rowHeight)
            .fill('#cccccc')
            .stroke();
        } else if (isAlternate) {
          doc
            .fillColor('#000')
            .rect(startX, y, tableWidth, rowHeight)
            .fill('#f2f2f2')
            .stroke();
        }
        doc.fillColor('#000');
        rowData.forEach((cell, i) => {
          const text = cell ? String(cell) : '';
          doc.text(text, x + 2, y + paddingY, {
            width: columns[i].width - 4,
            align: 'left',
          });
          doc.rect(x, y, columns[i].width, rowHeight).stroke();
          x += columns[i].width;
        });
        y += rowHeight;
        return y;
      };

      const getRowHeight = (rowData: unknown[]) => {
        let maxLines = 1;
        rowData.forEach((cell, i) => {
          const text = cell ? String(cell) : '';
          const lines =
            doc.heightOfString(text, { width: columns[i].width - 4 }) /
            lineHeight;
          if (lines > maxLines) maxLines = lines;
        });
        return maxLines * lineHeight + paddingY * 2;
      };

      const headerData = columns.map((col) => col.label);
      const headerHeight = getRowHeight(headerData);
      y = drawRow(headerData, headerHeight, true);

      parcels.forEach((parcel, index) => {
        const rowData = columns.map((col) => {
          let val = parcel[col.key as keyof typeof parcel] || '';
          if (val instanceof Object && '_id' in val) val = val.toString();
          return val;
        });
        const rowHeight = getRowHeight(rowData);
        if (y + rowHeight > doc.page.height - 30) {
          doc.addPage();
          y = 50 + headerHeight;
          drawRow(headerData, headerHeight, true);
        }
        y = drawRow(rowData, rowHeight, false, index % 2 === 0);
      });

      doc.end();
      res.status(HttpStatusCode.OK);
    }
  );

  public exportParcelDataIntoInvoice = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const parcel = await parcelModel
        .findById(id)
        .populate<{ customer: IUser }>(
          'customer',
          'familyName givenName phone email address'
        )
        .populate<{ agent: IUser }>('agent', 'familyName givenName phone')
        .lean();

      if (!parcel) {
        res.status(404).json({ message: 'Parcel not found' });
        return;
      }

      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=invoice-${parcel.trackingId}.pdf`
      );
      doc.pipe(res);

      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#fafafa');
      doc.fillColor('#2d3748');

      const logoWidth = 120;
      const logoHeight = 40;
      doc.rect(40, 30, logoWidth, logoHeight).fill('#3182ce');
      doc
        .fillColor('#fff')
        .fontSize(16)
        .text('Devmun', 50, 42)
        .fontSize(8)
        .text('Premium Delivery Services', 50, 60);

      doc
        .fillColor('#4a5568')
        .fontSize(20)
        .text('INVOICE', doc.page.width - 150, 40, { align: 'right' })
        .fontSize(10)
        .text(`INV-${parcel.trackingId}`, doc.page.width - 150, 65, {
          align: 'right',
        })
        .text(
          `Date: ${new Date().toLocaleDateString()}`,
          doc.page.width - 150,
          80,
          { align: 'right' }
        );

      doc
        .moveTo(40, 100)
        .lineTo(doc.page.width - 40, 100)
        .strokeColor('#e2e8f0')
        .stroke();

      const customerName =
        parcel.customer && typeof parcel.customer === 'object'
          ? `${parcel.customer.givenName} ${parcel.customer.familyName}`
          : 'Customer';
      const customerPhone =
        parcel.customer && typeof parcel.customer === 'object'
          ? parcel.customer.phone
          : 'N/A';
      const customerEmail =
        parcel.customer && typeof parcel.customer === 'object'
          ? parcel.customer.email
          : 'N/A';

      const agentName =
        parcel.agent && typeof parcel.agent === 'object'
          ? `${parcel.agent.givenName} ${parcel.agent.familyName}`
          : 'Not assigned';
      const agentPhone =
        parcel.agent && typeof parcel.agent === 'object'
          ? parcel.agent.phone
          : 'N/A';

      doc.fillColor('#2d3748').fontSize(12).text('BILL TO:', 40, 120);
      doc
        .fillColor('#4a5568')
        .fontSize(10)
        .text(customerName, 40, 140)
        .text(customerPhone, 40, 155)
        .text(customerEmail, 40, 170)
        .text(parcel.pickupAddress, 40, 185, { width: 200 });

      doc.fillColor('#2d3748').fontSize(12).text('SHIP TO:', 280, 120);
      doc
        .fillColor('#4a5568')
        .fontSize(10)
        .text(parcel.receiverName, 280, 140)
        .text(parcel.receiverPhone, 280, 155)
        .text(parcel.deliveryAddress, 280, 170, { width: 200 });

      doc.fillColor('#2d3748').fontSize(12).text('AGENT DETAILS:', 40, 210);
      doc
        .fillColor('#4a5568')
        .fontSize(10)
        .text(agentName, 40, 230)
        .text(agentPhone, 40, 245);

      doc.rect(40, 270, doc.page.width - 80, 20).fill('#3182ce');
      doc
        .fillColor('#fff')
        .fontSize(11)
        .text('PARCEL INFORMATION', 200, 275, { align: 'center' });

      const infoTop = 300;
      const infoRows = [
        { label: 'Tracking ID', value: parcel.trackingId || 'N/A', x: 40 },
        { label: 'Parcel Type', value: parcel.parcelType || 'N/A', x: 200 },
        { label: 'Size', value: parcel.parcelSize || 'N/A', x: 360 },
        { label: 'Status', value: parcel.status || 'N/A', x: 40, yOffset: 20 },
        {
          label: 'Priority',
          value: parcel.priority || 'N/A',
          x: 200,
          yOffset: 20,
        },
        {
          label: 'Payment',
          value: (parcel.paymentMethod || 'N/A').toUpperCase(),
          x: 360,
          yOffset: 20,
        },
        {
          label: 'COD Amount',
          value: `BDT ${parcel.codAmount?.toLocaleString() || '0'}`,
          x: 40,
          yOffset: 40,
        },
        {
          label: 'Created Date',
          value: new Date(parcel.createdAt).toLocaleDateString(),
          x: 200,
          yOffset: 40,
        },
      ];

      infoRows.forEach((row) => {
        doc
          .fillColor('#4a5568')
          .fontSize(10)
          .text(`${row.label}:`, row.x, infoTop + (row.yOffset || 0));
        doc
          .fillColor('#2d3748')
          .fontSize(10)
          .text(row.value, row.x + 70, infoTop + (row.yOffset || 0));
      });

      if (parcel.notes) {
        doc
          .fillColor('#4a5568')
          .fontSize(10)
          .text('Special Instructions:', 40, infoTop + 70);
        doc
          .fillColor('#2d3748')
          .fontSize(9)
          .text(parcel.notes, 40, infoTop + 85, { width: 300 });
      }

      const tableTop = infoTop + (parcel.notes ? 110 : 70);
      const rowHeight = 25;
      const colWidths = [30, 280, 80, 80, 80];
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);

      doc.rect(40, tableTop, tableWidth, rowHeight).fill('#2d3748');
      doc.fillColor('#fff').fontSize(10);
      ['ITEM', 'DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL'].forEach((h, i) => {
        doc.text(
          h,
          45 + colWidths.slice(0, i).reduce((a, b) => a + b, 0),
          tableTop + 8,
          {
            width: colWidths[i] - 5,
            align: i === 1 ? 'left' : 'center',
          }
        );
      });

      doc.fillColor('#2d3748');
      const items = [
        {
          desc: `${parcel.parcelType} Delivery - ${parcel.parcelSize} size`,
          qty: 1,
          price: parcel.codAmount || 0,
          total: parcel.codAmount || 0,
        },
      ];

      let y = tableTop + rowHeight;
      items.forEach((item, idx) => {
        if (idx % 2 === 0)
          doc.rect(40, y, tableWidth, rowHeight).fill('#f7fafc');
        doc.fillColor(idx % 2 === 0 ? '#2d3748' : '#4a5568');
        [
          idx + 1,
          item.desc,
          item.qty,
          `BDT ${item.price.toLocaleString()}`,
          `BDT ${item.total.toLocaleString()}`,
        ].forEach((val, i) => {
          doc.text(
            String(val),
            45 + colWidths.slice(0, i).reduce((a, b) => a + b, 0),
            y + 8,
            {
              width: colWidths[i] - 5,
              align: i === 1 ? 'left' : 'center',
            }
          );
        });
        y += rowHeight;
      });

      doc.rect(40, y, tableWidth, rowHeight).fill('#e2e8f0');
      doc
        .fillColor('#2d3748')
        .fontSize(11)
        .text('GRAND TOTAL', 45, y + 8, {
          width: colWidths.slice(0, 4).reduce((a, b) => a + b, 0) - 5,
          align: 'right',
        })
        .text(
          `BDT ${(parcel.codAmount || 0).toLocaleString()}`,
          45 + colWidths.slice(0, 4).reduce((a, b) => a + b, 0),
          y + 8,
          {
            width: colWidths[4] - 5,
            align: 'center',
          }
        );

      const qrY = y + 50;
      const qr = await QRCode.toDataURL(
        `https://track.devmun.com/${parcel.trackingId}`
      );
      const qrImg = qr.replace(/^data:image\/png;base64,/, '');
      doc.image(Buffer.from(qrImg, 'base64'), doc.page.width - 120, qrY, {
        fit: [80, 80],
        align: 'right',
      });

      doc
        .fillColor('#4a5568')
        .fontSize(8)
        .text('Scan to track your parcel', doc.page.width - 120, qrY + 85, {
          width: 80,
          align: 'center',
        });

      doc
        .moveTo(40, qrY + 110)
        .lineTo(doc.page.width - 40, qrY + 110)
        .strokeColor('#e2e8f0')
        .stroke();

      doc
        .fillColor('#718096')
        .fontSize(9)
        .text(
          'Thank you for choosing Devmun Logistics',
          doc.page.width / 2,
          doc.page.height - 40,
          {
            align: 'center',
          }
        )
        .text(
          'jsdev.robin@gmail.com | +880 1763408494',
          doc.page.width / 2,
          doc.page.height - 25,
          {
            align: 'center',
          }
        );

      doc.end();
    }
  );
}
