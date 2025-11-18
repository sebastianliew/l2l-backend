import { Request, Response } from 'express';
import { PipelineStage } from 'mongoose';
import { ItemSalesData, ItemSalesResponse, ItemSalesFilters, ItemSalesFacetResult } from '../../types/reports/item-sales.types.js';
import { Transaction } from '../../models/Transaction.js';

export class ItemSalesController {
  static async getItemSalesReport(
    req: Request<unknown, ItemSalesResponse, unknown, ItemSalesFilters>,
    res: Response<ItemSalesResponse>
  ): Promise<void> {
    try {
      const {
        startDate,
        endDate,
        productId,
        categoryId,
        minSales,
        sortBy = 'total_sales',
        sortOrder = 'desc',
        page = '1',
        limit = '10'
      } = req.query;

      // Parse and validate pagination parameters
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10)); // Cap at 100 items per page
      const skip = (pageNum - 1) * limitNum;

      // Build initial match conditions for transactions
      const matchConditions: Record<string, unknown> = {
        type: 'sale',
        status: 'completed'
      };

      // Add date filters if provided
      if (startDate || endDate) {
        matchConditions.createdAt = {} as Record<string, Date>;

        if (startDate) {
          (matchConditions.createdAt as Record<string, Date>).$gte = new Date(startDate);
        }

        if (endDate) {
          (matchConditions.createdAt as Record<string, Date>).$lte = new Date(endDate);
        }
      }

      // Build optimized aggregation pipeline
      const pipeline: PipelineStage[] = [
        // Stage 1: Match transactions by date/status BEFORE unwinding (more efficient)
        {
          $match: matchConditions
        },
        // Stage 2: Unwind the items array
        {
          $unwind: '$items'
        }
      ];

      // Stage 3: Add product/category filters on unwound items
      const itemMatchConditions: Record<string, unknown> = {};

      if (productId) {
        itemMatchConditions['items.productId'] = productId;
      }

      if (categoryId) {
        itemMatchConditions['items.categoryId'] = categoryId;
      }

      if (Object.keys(itemMatchConditions).length > 0) {
        pipeline.push({
          $match: itemMatchConditions
        });
      }

      // Stage 4: Group by product to calculate metrics
      pipeline.push({
        $group: {
          _id: '$items.productId',
          item_name: { $first: '$items.name' },
          total_sales: { $sum: '$items.totalPrice' },
          total_discount: { $sum: { $ifNull: ['$items.discountAmount', 0] } },
          total_tax: {
            $sum: {
              $multiply: [
                '$items.totalPrice',
                { $divide: [{ $ifNull: ['$items.tax', 0] }, 100] }
              ]
            }
          },
          quantity_sold: { $sum: '$items.quantity' },
          base_unit: { $first: { $ifNull: ['$items.baseUnit', 'unit'] } },
          average_list_price: { $avg: '$items.unitPrice' },
          last_sale_date: { $max: '$createdAt' }
        }
      });

      // Stage 5: Lookup Product collection to get costPrice (avoids N+1 query)
      pipeline.push({
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productData'
        }
      });

      // Stage 6: Calculate total_cost and margin in pipeline
      pipeline.push({
        $addFields: {
          average_cost_price: {
            $ifNull: [{ $arrayElemAt: ['$productData.costPrice', 0] }, 0]
          }
        }
      });

      pipeline.push({
        $project: {
          item_name: 1,
          total_sales: 1,
          total_cost: { $multiply: ['$quantity_sold', '$average_cost_price'] },
          total_discount: 1,
          total_tax: 1,
          quantity_sold: 1,
          base_unit: 1,
          average_list_price: 1,
          average_cost_price: 1,
          last_sale_date: 1,
          margin: {
            $cond: {
              if: { $gt: ['$total_sales', 0] },
              then: {
                $divide: [
                  { $subtract: ['$total_sales', { $multiply: ['$quantity_sold', '$average_cost_price'] }] },
                  '$total_sales'
                ]
              },
              else: 0
            }
          }
        }
      });

      // Stage 7: Apply minSales filter in pipeline (not in JavaScript)
      if (minSales && !isNaN(Number(minSales))) {
        pipeline.push({
          $match: {
            total_sales: { $gte: Number(minSales) }
          }
        });
      }

      // Stage 8: Sort in pipeline
      const sortField = sortBy as string;
      pipeline.push({
        $sort: {
          [sortField]: sortOrder === 'asc' ? 1 : -1
        }
      });

      // Stage 9: Use $facet to get paginated results, total count, AND summary totals in ONE query
      pipeline.push({
        $facet: {
          paginatedResults: [
            { $skip: skip },
            { $limit: limitNum }
          ],
          totalCount: [
            { $count: 'count' }
          ],
          summary: [
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: '$total_sales' },
                totalCost: { $sum: '$total_cost' },
                totalProfit: { $sum: { $subtract: ['$total_sales', '$total_cost'] } }
              }
            }
          ]
        }
      });

      // Execute the optimized pipeline
      const results = await Transaction.aggregate<ItemSalesFacetResult>(pipeline);
      const result = results[0];

      // Extract results and total count
      const paginatedData: ItemSalesData[] = result.paginatedResults.map((item) => ({
        item_name: item.item_name,
        total_sales: item.total_sales,
        total_cost: item.total_cost,
        total_discount: item.total_discount,
        total_tax: item.total_tax,
        quantity_sold: item.quantity_sold,
        base_unit: item.base_unit,
        average_list_price: item.average_list_price,
        average_cost_price: item.average_cost_price,
        last_sale_date: item.last_sale_date instanceof Date
          ? item.last_sale_date.toISOString()
          : item.last_sale_date,
        margin: item.margin
      }));

      const totalItems = result.totalCount[0]?.count || 0;
      const totalPages = Math.ceil(totalItems / limitNum);
      const summary = result.summary[0] || { totalRevenue: 0, totalCost: 0, totalProfit: 0 };

      res.json({
        data: paginatedData,
        success: true,
        metadata: {
          totalItems,
          totalPages,
          currentPage: pageNum,
          pageSize: limitNum,
          summary: {
            totalRevenue: summary.totalRevenue,
            totalCost: summary.totalCost,
            totalProfit: summary.totalProfit
          },
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error fetching item sales data:', error);

      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

      res.status(500).json({
        data: [],
        success: false,
        error: `Failed to fetch item sales data: ${errorMessage}`
      });
    }
  }
}