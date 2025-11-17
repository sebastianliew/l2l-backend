import { Request, Response } from 'express';
import { PipelineStage } from 'mongoose';
import { ItemSalesData, ItemSalesResponse, ItemSalesFilters } from '../../types/reports/item-sales.types.js';
import { Transaction } from '../../models/Transaction.js';

export class ItemSalesController {
  static async getItemSalesReport(
    req: Request<{}, {}, {}, ItemSalesFilters>,
    res: Response<ItemSalesResponse>
  ): Promise<void> {
    try {
      const { startDate, endDate, productId, categoryId, minSales, sortBy = 'total_sales', sortOrder = 'desc' } = req.query;

      // Build match conditions with proper typing
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

      // Build aggregation pipeline with proper typing
      const pipeline: PipelineStage[] = [
        // Match only completed sales transactions
        {
          $match: matchConditions
        },
        // Unwind the items array to work with individual items
        {
          $unwind: '$items'
        }
      ];

      // Add product filter if specified
      if (productId) {
        pipeline.push({
          $match: {
            'items.productId': productId
          }
        });
      }

      // Add category filter if specified
      if (categoryId) {
        pipeline.push({
          $match: {
            'items.categoryId': categoryId
          }
        });
      }

      // Group by product to calculate metrics
      pipeline.push({
        $group: {
          _id: '$items.productId',
          item_name: { $first: '$items.name' },
          total_sales: { $sum: '$items.totalPrice' },
          total_cost: {
            $sum: {
              $multiply: [
                '$items.quantity',
                { $ifNull: ['$items.unitPrice', 0] }
              ]
            }
          },
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
          average_cost_price: {
            $avg: {
              $divide: [
                { $multiply: ['$items.quantity', { $ifNull: ['$items.unitPrice', 0] }] },
                '$items.quantity'
              ]
            }
          },
          last_sale_date: { $max: '$createdAt' }
        }
      });

      // Calculate margin and format the output
      pipeline.push({
        $project: {
          _id: 0,
          item_name: 1,
          total_sales: 1,
          total_cost: 1,
          total_discount: 1,
          total_tax: 1,
          quantity_sold: 1,
          base_unit: 1,
          average_list_price: 1,
          average_cost_price: 1,
          last_sale_date: 1,
          margin: {
            $cond: {
              if: { $eq: ['$total_sales', 0] },
              then: 0,
              else: {
                $divide: [
                  { $subtract: ['$total_sales', '$total_cost'] },
                  '$total_sales'
                ]
              }
            }
          }
        }
      });

      // Add minimum sales filter if specified
      if (minSales && !isNaN(Number(minSales))) {
        pipeline.push({
          $match: {
            total_sales: { $gte: Number(minSales) }
          }
        });
      }

      // Sort by specified field
      const sortField: Record<string, 1 | -1> = {};
      sortField[sortBy] = sortOrder === 'asc' ? 1 : -1;
      pipeline.push({
        $sort: sortField
      });

      const results = await Transaction.aggregate<ItemSalesData>(pipeline);

      res.json({
        data: results,
        success: true,
        metadata: {
          totalItems: results.length,
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