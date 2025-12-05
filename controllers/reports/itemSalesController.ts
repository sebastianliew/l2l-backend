import { Request, Response } from 'express';
import { PipelineStage } from 'mongoose';
import { ItemSalesData, ItemSalesResponse, ItemSalesFilters } from '../../types/reports/item-sales.types.js';
import { Transaction } from '../../models/Transaction.js';
import { Product } from '../../models/Product.js';

export class ItemSalesController {
  static async getItemSalesReport(
    req: Request<Record<string, never>, Record<string, never>, Record<string, never>, ItemSalesFilters>,
    res: Response<ItemSalesResponse>
  ): Promise<void> {
    try {
      console.log('🔍 ItemSalesController: Request received');
      console.log('📝 Query parameters:', req.query);
      console.log('🌐 Request URL:', req.originalUrl);
      console.log('🔐 Auth header present:', !!req.headers.authorization);
      
      const { startDate, endDate, productId, categoryId, minSales, sortBy = 'total_sales', sortOrder = 'desc' } = req.query;

      // Build match conditions with proper typing
      const matchConditions: Record<string, unknown> = {
        type: 'sale',
        status: 'completed'
      };

      console.log('📋 Initial match conditions:', matchConditions);

      // Add date filters if provided
      if (startDate || endDate) {
        matchConditions.createdAt = {} as Record<string, Date>;
        
        if (startDate) {
          const startDateObj = new Date(startDate);
          (matchConditions.createdAt as Record<string, Date>).$gte = startDateObj;
          console.log('📅 Start date filter:', startDateObj.toISOString());
        }
        
        if (endDate) {
          const endDateObj = new Date(endDate);
          (matchConditions.createdAt as Record<string, Date>).$lte = endDateObj;
          console.log('📅 End date filter:', endDateObj.toISOString());
        }
      }

      console.log('📋 Final match conditions:', JSON.stringify(matchConditions, null, 2));

      // Build aggregation pipeline to get sales data first (without cost calculation)
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

      // Group by product to calculate metrics (without cost for now)
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

      // Check if we have any transactions at all
      const totalTransactions = await Transaction.countDocuments();
      console.log('📊 Total transactions in database:', totalTransactions);
      
      const saleTransactions = await Transaction.countDocuments({ type: 'sale', status: 'completed' });
      console.log('📊 Sale transactions (completed):', saleTransactions);
      
      // Check what transaction types exist
      const transactionTypes = await Transaction.distinct('type');
      console.log('📊 Available transaction types:', transactionTypes);
      
      const transactionStatuses = await Transaction.distinct('status');
      console.log('📊 Available transaction statuses:', transactionStatuses);

      // Check actual date range of transactions
      const dateRangeQuery = await Transaction.aggregate([
        { $match: { type: 'sale', status: 'completed' } },
        { 
          $group: {
            _id: null,
            minDate: { $min: '$createdAt' },
            maxDate: { $max: '$createdAt' },
            count: { $sum: 1 }
          }
        }
      ]);
      
      if (dateRangeQuery.length > 0) {
        console.log('📅 Actual transaction date range:', {
          earliest: dateRangeQuery[0].minDate,
          latest: dateRangeQuery[0].maxDate,
          count: dateRangeQuery[0].count
        });
      }

      // Test with no date filter to see if we get results
      const testPipeline = [
        { $match: { type: 'sale', status: 'completed' } },
        { $unwind: '$items' },
        { $limit: 5 },
        { $project: { _id: 1, createdAt: 1, 'items.name': 1, 'items.productId': 1 } }
      ];
      
      const testResults = await Transaction.aggregate(testPipeline);
      console.log('🧪 Test query (no date filter) - sample transactions:', testResults);

      // Get initial results without cost data
      console.log('🔍 Running aggregation pipeline...');
      console.log('🔍 Pipeline:', JSON.stringify(pipeline, null, 2));
      
      const salesResults = await Transaction.aggregate(pipeline);
      
      console.log('📊 Aggregation results count:', salesResults.length);
      if (salesResults.length > 0) {
        console.log('📊 Sample result:', salesResults[0]);
      } else {
        console.log('⚠️ No results from aggregation pipeline');
      }

      // Get all unique product IDs from the results
      const productIds = salesResults
        .map(result => result._id)
        .filter(id => typeof id === 'string' && id.length === 24 && /^[a-fA-F0-9]{24}$/.test(id));

      // Fetch actual cost prices for valid product IDs
      const products = await Product.find(
        { _id: { $in: productIds } },
        { _id: 1, costPrice: 1 }
      ).lean();

      // Create a map of productId -> costPrice
      const costPriceMap = new Map<string, number>();
      products.forEach(product => {
        costPriceMap.set(String(product._id), product.costPrice || 0);
      });

      // Calculate final results with actual cost data
      const results: ItemSalesData[] = salesResults.map(item => {
        const productId = item._id;
        const costPrice = costPriceMap.get(productId) || 0;
        const total_cost = item.quantity_sold * costPrice;
        
        return {
          item_name: item.item_name,
          total_sales: item.total_sales,
          total_cost: total_cost,
          total_discount: item.total_discount,
          total_tax: item.total_tax,
          quantity_sold: item.quantity_sold,
          base_unit: item.base_unit,
          average_list_price: item.average_list_price,
          average_cost_price: costPrice,
          last_sale_date: item.last_sale_date,
          margin: item.total_sales > 0 ? (item.total_sales - total_cost) / item.total_sales : 0
        };
      });

      // Apply minimum sales filter if specified
      let filteredResults = results;
      if (minSales && !isNaN(Number(minSales))) {
        const originalCount = filteredResults.length;
        filteredResults = results.filter(item => item.total_sales >= Number(minSales));
        console.log(`💰 Applied minSales filter (${minSales}): ${originalCount} → ${filteredResults.length} items`);
      }

      // Sort results
      filteredResults.sort((a, b) => {
        const aValue = a[sortBy as keyof ItemSalesData] as number;
        const bValue = b[sortBy as keyof ItemSalesData] as number;
        
        if (sortOrder === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      });

      console.log('✅ Final results prepared:', {
        count: filteredResults.length,
        sortBy,
        sortOrder,
        sampleItem: filteredResults[0]
      });

      const response = {
        data: filteredResults,
        success: true,
        metadata: {
          totalItems: filteredResults.length,
          generatedAt: new Date().toISOString()
        }
      };

      console.log('📤 Sending response:', {
        success: response.success,
        dataCount: response.data.length,
        metadata: response.metadata
      });

      res.json(response);
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