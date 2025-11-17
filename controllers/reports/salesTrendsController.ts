import { Request, Response } from 'express';
import { Transaction } from '../../models/Transaction';

interface SalesTrendData {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  transactions: number;
}

interface CategoryData {
  category: string;
  revenue: number;
  percentage: number;
}

interface TopProductData {
  product: string;
  revenue: number;
  quantity: number;
}

interface SalesTrendsResponse {
  dailyData: SalesTrendData[];
  categoryData: CategoryData[];
  topProducts: TopProductData[];
}

export class SalesTrendsController {
  static async getSalesTrends(req: Request, res: Response): Promise<Response> {
    try {
      const { startDate: queryStartDate, endDate: queryEndDate } = req.query;
      const days = parseInt(req.query.days as string) || 30;
      
      // Build date filter - use provided dates or default to last N days
      let startDate: Date;
      let endDate: Date;
      
      if (queryStartDate && queryEndDate) {
        startDate = new Date(queryStartDate as string);
        endDate = new Date(queryEndDate as string);
      } else if (queryStartDate) {
        startDate = new Date(queryStartDate as string);
        endDate = new Date(); // Current date
      } else if (queryEndDate) {
        endDate = new Date(queryEndDate as string);
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - days);
      } else {
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(endDate.getDate() - days);
      }

      // Build match conditions
      const matchConditions: Record<string, unknown> = {
        status: 'completed',
        type: { $in: ['sale'] }
      };

      // Add date filter
      matchConditions.createdAt = {
        $gte: startDate,
        $lte: endDate
      };

      // Get transactions for the period
      const transactions = await Transaction.find(matchConditions);

      // Generate daily data
      const actualDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const dailyData = await generateDailyData(transactions, startDate, actualDays);
      
      // Generate category data
      const categoryData = await generateCategoryData(transactions);
      
      // Generate top products data
      const topProducts = await generateTopProductsData(transactions);

      const response: SalesTrendsResponse = {
        dailyData,
        categoryData,
        topProducts
      };

      return res.json(response);
    } catch (error) {
      console.error('Error generating sales trends report:', error);
      return res.status(500).json({ 
        error: 'Failed to generate sales trends report',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

async function generateDailyData(transactions: any[], startDate: Date, days: number): Promise<SalesTrendData[]> {
  const dailyMap = new Map<string, SalesTrendData>();
  
  // Initialize all days with zero values
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];
    
    dailyMap.set(dateKey, {
      date: dateKey,
      revenue: 0,
      cost: 0,
      profit: 0,
      transactions: 0
    });
  }
  
  // Aggregate transaction data
  transactions.forEach(transaction => {
    const dateKey = transaction.createdAt.toISOString().split('T')[0];
    const existing = dailyMap.get(dateKey);
    
    if (existing) {
      existing.revenue += transaction.totalAmount || 0;
      existing.transactions += 1;
      
      // Calculate cost and profit from items
      // Note: Without product population, we'll estimate cost as 70% of selling price
      let itemCost = 0;
      transaction.items.forEach((item: any) => {
        const estimatedCostPrice = item.unitPrice * 0.7; // Estimate cost as 70% of selling price
        itemCost += estimatedCostPrice * item.quantity;
      });
      
      existing.cost += itemCost;
      existing.profit += (transaction.totalAmount || 0) - itemCost;
    }
  });
  
  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function generateCategoryData(transactions: any[]): Promise<CategoryData[]> {
  const categoryMap = new Map<string, number>();
  let totalRevenue = 0;
  
  transactions.forEach(transaction => {
    transaction.items.forEach((item: any) => {
      // Use item type or default to 'General Products' since we don't have populated category
      const category = item.itemType || 'General Products';
      const revenue = item.totalPrice || 0;
      
      categoryMap.set(category, (categoryMap.get(category) || 0) + revenue);
      totalRevenue += revenue;
    });
  });
  
  return Array.from(categoryMap.entries())
    .map(([category, revenue]) => ({
      category,
      revenue,
      percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100 * 10) / 10 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
}

async function generateTopProductsData(transactions: any[]): Promise<TopProductData[]> {
  const productMap = new Map<string, { revenue: number; quantity: number }>();
  
  transactions.forEach(transaction => {
    transaction.items.forEach((item: any) => {
      const productName = item.name || item.product?.name || 'Unknown Product';
      const existing = productMap.get(productName) || { revenue: 0, quantity: 0 };
      
      existing.revenue += item.totalPrice || 0;
      existing.quantity += item.quantity || 0;
      productMap.set(productName, existing);
    });
  });
  
  return Array.from(productMap.entries())
    .map(([product, data]) => ({
      product,
      revenue: data.revenue,
      quantity: data.quantity
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
}