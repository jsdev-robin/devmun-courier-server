import parcelModel from '../../models/parcelModel';

const getParcelStatusDistribution = async () => {
  const result = await parcelModel.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        status: '$_id',
        count: 1,
        fill: {
          $switch: {
            branches: [
              {
                case: { $eq: ['$_id', 'booked'] },
                then: 'var(--color-booked)',
              },
              {
                case: { $eq: ['$_id', 'picked_up'] },
                then: 'var(--color-picked_up)',
              },
              {
                case: { $eq: ['$_id', 'in_transit'] },
                then: 'var(--color-in_transit)',
              },
              {
                case: { $eq: ['$_id', 'delivered'] },
                then: 'var(--color-delivered)',
              },
              {
                case: { $eq: ['$_id', 'failed'] },
                then: 'var(--color-failed)',
              },
            ],
            default: 'var(--color-default)',
          },
        },
        _id: 0,
      },
    },
  ]);

  return result;
};

const getParcelPriorityDistribution = async () => {
  const result = await parcelModel.aggregate([
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        priority: '$_id',
        count: 1,
        fill: {
          $switch: {
            branches: [
              {
                case: { $eq: ['$_id', 'urgent'] },
                then: 'var(--color-urgent)',
              },
              { case: { $eq: ['$_id', 'high'] }, then: 'var(--color-high)' },
              {
                case: { $eq: ['$_id', 'medium'] },
                then: 'var(--color-medium)',
              },
              { case: { $eq: ['$_id', 'low'] }, then: 'var(--color-low)' },
              {
                case: { $eq: ['$_id', 'deferred'] },
                then: 'var(--color-deferred)',
              },
            ],
            default: 'var(--color-default)',
          },
        },
        _id: 0,
      },
    },
  ]);

  return result;
};

const getParcelSizeDistribution = async () => {
  const result = await parcelModel.aggregate([
    {
      $group: {
        _id: '$parcelSize',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        size: '$_id',
        count: 1,
        fill: {
          $switch: {
            branches: [
              { case: { $eq: ['$_id', 'small'] }, then: 'var(--color-small)' },
              {
                case: { $eq: ['$_id', 'medium'] },
                then: 'var(--color-medium)',
              },
              { case: { $eq: ['$_id', 'large'] }, then: 'var(--color-large)' },
              {
                case: { $eq: ['$_id', 'xlarge'] },
                then: 'var(--color-xlarge)',
              },
            ],
            default: 'var(--color-default)',
          },
        },
        _id: 0,
      },
    },
  ]);

  return result;
};

const getParcelTypeDistribution = async () => {
  const result = await parcelModel.aggregate([
    {
      $group: {
        _id: '$parcelType',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        type: '$_id',
        count: 1,
        fill: {
          $switch: {
            branches: [
              {
                case: { $eq: ['$_id', 'document'] },
                then: 'var(--color-document)',
              },
              {
                case: { $eq: ['$_id', 'package'] },
                then: 'var(--color-package)',
              },
              {
                case: { $eq: ['$_id', 'fragile'] },
                then: 'var(--color-fragile)',
              },
              {
                case: { $eq: ['$_id', 'electronics'] },
                then: 'var(--color-electronics)',
              },
            ],
            default: 'var(--color-default)',
          },
        },
        _id: 0,
      },
    },
  ]);

  return result;
};

const getParcelStatusDistributionByTime = async (
  timeFrame: 'day' | 'week' | 'month'
) => {
  let startDate;
  const endDate = new Date();

  if (timeFrame === 'day') {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
  } else if (timeFrame === 'week') {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  } else if (timeFrame === 'month') {
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
  }

  const result = await parcelModel.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        status: '$_id',
        count: 1,
        fill: {
          $switch: {
            branches: [
              {
                case: { $eq: ['$_id', 'booked'] },
                then: 'var(--color-booked)',
              },
              {
                case: { $eq: ['$_id', 'picked_up'] },
                then: 'var(--color-picked-up)',
              },
              {
                case: { $eq: ['$_id', 'in_transit'] },
                then: 'var(--color-in-transit)',
              },
              {
                case: { $eq: ['$_id', 'delivered'] },
                then: 'var(--color-delivered)',
              },
              {
                case: { $eq: ['$_id', 'failed'] },
                then: 'var(--color-failed)',
              },
            ],
            default: 'var(--color-default)',
          },
        },
        _id: 0,
      },
    },
  ]);

  return result;
};

const getDailyStatusTrend = async (days: number = 7) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const result = await parcelModel.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          status: '$status',
        },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$_id.date',
        statuses: {
          $push: {
            status: '$_id.status',
            count: '$count',
          },
        },
        total: { $sum: '$count' },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  return result;
};

const getParcelPriorityDistributionByTime = async (
  timeFrame: 'day' | 'week' | 'month'
) => {
  let startDate;
  const endDate = new Date();

  if (timeFrame === 'day') {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
  } else if (timeFrame === 'week') {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  } else if (timeFrame === 'month') {
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
  }

  const result = await parcelModel.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        priority: '$_id',
        count: 1,
        fill: {
          $switch: {
            branches: [
              {
                case: { $eq: ['$_id', 'urgent'] },
                then: 'var(--color-urgent)',
              },
              { case: { $eq: ['$_id', 'high'] }, then: 'var(--color-high)' },
              {
                case: { $eq: ['$_id', 'medium'] },
                then: 'var(--color-medium)',
              },
              { case: { $eq: ['$_id', 'low'] }, then: 'var(--color-low)' },
              {
                case: { $eq: ['$_id', 'deferred'] },
                then: 'var(--color-deferred)',
              },
            ],
            default: 'var(--color-default)',
          },
        },
        _id: 0,
      },
    },
  ]);

  return result;
};

const getParcelSizeDistributionByTime = async (
  timeFrame: 'day' | 'week' | 'month'
) => {
  let startDate;
  const endDate = new Date();

  if (timeFrame === 'day') {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
  } else if (timeFrame === 'week') {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  } else if (timeFrame === 'month') {
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
  }

  const result = await parcelModel.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$parcelSize',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        size: '$_id',
        count: 1,
        fill: {
          $switch: {
            branches: [
              { case: { $eq: ['$_id', 'small'] }, then: 'var(--color-small)' },
              {
                case: { $eq: ['$_id', 'medium'] },
                then: 'var(--color-medium)',
              },
              { case: { $eq: ['$_id', 'large'] }, then: 'var(--color-large)' },
              {
                case: { $eq: ['$_id', 'xlarge'] },
                then: 'var(--color-xlarge)',
              },
            ],
            default: 'var(--color-default)',
          },
        },
        _id: 0,
      },
    },
  ]);

  return result;
};

const getParcelTypeDistributionByTime = async (
  timeFrame: 'day' | 'week' | 'month'
) => {
  let startDate;
  const endDate = new Date();

  if (timeFrame === 'day') {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
  } else if (timeFrame === 'week') {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  } else if (timeFrame === 'month') {
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
  }

  const result = await parcelModel.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$parcelType',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        type: '$_id',
        count: 1,
        fill: {
          $switch: {
            branches: [
              {
                case: { $eq: ['$_id', 'document'] },
                then: 'var(--color-document)',
              },
              {
                case: { $eq: ['$_id', 'package'] },
                then: 'var(--color-package)',
              },
              {
                case: { $eq: ['$_id', 'fragile'] },
                then: 'var(--color-fragile)',
              },
              {
                case: { $eq: ['$_id', 'electronics'] },
                then: 'var(--color-electronics)',
              },
            ],
            default: 'var(--color-default)',
          },
        },
        _id: 0,
      },
    },
  ]);

  return result;
};

const getParcelMetricsByTime = async (timeFrame: 'day' | 'week' | 'month') => {
  const statusDistribution = await getParcelStatusDistributionByTime(timeFrame);
  const priorityDistribution = await getParcelPriorityDistributionByTime(
    timeFrame
  );
  const sizeDistribution = await getParcelSizeDistributionByTime(timeFrame);
  const typeDistribution = await getParcelTypeDistributionByTime(timeFrame);

  return {
    statusDistribution,
    priorityDistribution,
    sizeDistribution,
    typeDistribution,
  };
};

export {
  getDailyStatusTrend,
  getParcelMetricsByTime,
  getParcelPriorityDistribution,
  getParcelPriorityDistributionByTime,
  getParcelSizeDistribution,
  getParcelSizeDistributionByTime,
  getParcelStatusDistribution,
  getParcelStatusDistributionByTime,
  getParcelTypeDistribution,
  getParcelTypeDistributionByTime,
};
