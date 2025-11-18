import { Request, Response } from 'express';
import { Transaction, ITransaction } from '../../models/Transaction.js';

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
      const days = parseInt(req.query.days as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get transactions for the period
      const transactions = await Transaction.find({
        createdAt: { $gte: startDate },
        status: 'completed',
        type: { $in: ['sale'] }
      });

      // Generate daily data
      const dailyData = await generateDailyData(transactions, startDate, days);
      
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

async function generateDailyData(transactions: ITransaction[], startDate: Date, days: number): Promise<SalesTrendData[]> {
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

      // Note: Cost data not available in transaction items
      // Transaction items store name, unitPrice, quantity but not costPrice
      // Cost and profit calculations would require product lookup if needed
      existing.cost += 0;
      existing.profit += transaction.totalAmount || 0;
    }
  });
  
  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function generateCategoryData(transactions: ITransaction[]): Promise<CategoryData[]> {
  const categoryMap = new Map<string, number>();
  let totalRevenue = 0;

  transactions.forEach(transaction => {
    transaction.items.forEach((item) => {
      // Transaction items don't have category information stored
      // Using itemType as a category proxy
      const category = item.itemType || 'product';
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

async function generateTopProductsData(transactions: ITransaction[]): Promise<TopProductData[]> {
  const productMap = new Map<string, { revenue: number; quantity: number }>();

  transactions.forEach(transaction => {
    transaction.items.forEach((item) => {
      const productName = item.name || 'Unknown Product';
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