import mongoose from 'mongoose'
import dbConnect from '@/lib/mongoose-global'

export interface InventoryItem {
  id: string
  name: string
  category: string
  current_stock: number
  min_stock: number
  max_stock: number
  unit: string
  unit_cost: number
  total_value: number
  turnover_rate: number
  days_supply: number
  status: 'optimal' | 'low' | 'overstock' | 'out'
}

export interface CategorySummary {
  category: string
  items: number
  value: number
  percentage: number
}

export interface StockStatus {
  status: string
  count: number
  value: number
}

export interface InventoryAnalysisData {
  inventoryData: InventoryItem[]
  categoryData: CategorySummary[]
  stockStatus: StockStatus[]
}

export class InventoryAnalysisService {
  static async getInventoryAnalysis(): Promise<InventoryAnalysisData> {
    const connection = await dbConnect()
    if (!connection.connection.db) {
      throw new Error('Database connection not established')
    }
    const db = connection.connection.db

    // Get all products with their current stock levels
    const inventoryData = await this.getInventoryData(db)
    
    // Get turnover data
    const turnoverData = await this.getTurnoverData(db)
    const turnoverMap = new Map(turnoverData.map(item => [item._id, item.totalSold]))
    
    // Enhance inventory data with turnover rates and days supply
    const enhancedInventoryData = this.enhanceInventoryData(inventoryData, turnoverMap)
    
    // Get category summary
    const categoryData = await this.getCategoryData(db)
    
    // Calculate percentages for categories
    const totalValue = categoryData.reduce((sum, cat) => sum + cat.value, 0)
    const categoryDataWithPercentage = categoryData.map(cat => ({
      ...cat,
      percentage: totalValue > 0 ? (cat.value / totalValue) * 100 : 0
    }))
    
    // Get stock status summary
    const stockStatusData = this.getStockStatusSummary(enhancedInventoryData)
    
    return {
      inventoryData: enhancedInventoryData,
      categoryData: categoryDataWithPercentage,
      stockStatus: stockStatusData
    }
  }

  private static async getInventoryData(db: mongoose.mongo.Db): Promise<any[]> {
    const pipeline = [
      {
        $match: {
          status: { $ne: 'discontinued' }
        }
      },
      {
        $project: {
          id: { $toString: '$_id' },
          name: 1,
          category: { $ifNull: ['$categoryName', 'Uncategorized'] },
          current_stock: { $ifNull: ['$currentStock', '$quantity', 0] },
          min_stock: { $ifNull: ['$reorderPoint', 10] },
          max_stock: { $multiply: [{ $ifNull: ['$reorderPoint', 10] }, 5] },
          unit: { $ifNull: ['$unitName', 'units'] },
          unit_cost: { $ifNull: ['$costPrice', 0] },
          total_value: { 
            $multiply: [
              { $ifNull: ['$currentStock', '$quantity', 0] }, 
              { $ifNull: ['$costPrice', 0] }
            ] 
          },
          status: {
            $switch: {
              branches: [
                { case: { $lte: [{ $ifNull: ['$currentStock', '$quantity', 0] }, 0] }, then: 'out' },
                { case: { $lte: [{ $ifNull: ['$currentStock', '$quantity', 0] }, '$reorderPoint'] }, then: 'low' },
                { case: { $gte: [{ $ifNull: ['$currentStock', '$quantity', 0] }, { $multiply: ['$reorderPoint', 5] }] }, then: 'overstock' }
              ],
              default: 'optimal'
            }
          }
        }
      }
    ]

    return await db.collection('products').aggregate(pipeline).toArray()
  }

  private static async getTurnoverData(db: mongoose.mongo.Db): Promise<any[]> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const pipeline = [
      {
        $match: {
          type: 'sale',
          status: 'completed',
          transactionDate: { $gte: thirtyDaysAgo }
        }
      },
      {
        $unwind: '$items'
      },
      {
        $group: {
          _id: '$items.productId',
          totalSold: { $sum: '$items.quantity' }
        }
      }
    ]

    return await db.collection('transactions').aggregate(pipeline).toArray()
  }

  private static enhanceInventoryData(inventoryData: any[], turnoverMap: Map<string, number>): InventoryItem[] {
    return inventoryData.map((item) => {
      const monthlySales = turnoverMap.get(item.id.toString()) || 0
      const dailySales = monthlySales / 30
      const turnoverRate = item.current_stock > 0 ? (monthlySales / item.current_stock) : 0
      const daysSupply = dailySales > 0 ? Math.floor(item.current_stock / dailySales) : 999
      
      let status: InventoryItem['status'] = 'optimal'
      if (item.current_stock <= 0) {
        status = 'out'
      } else if (item.current_stock <= item.min_stock) {
        status = 'low'
      } else if (daysSupply > 90) {
        status = 'overstock'
      }

      return {
        ...item,
        turnover_rate: turnoverRate,
        days_supply: daysSupply,
        status
      }
    })
  }

  private static async getCategoryData(db: mongoose.mongo.Db): Promise<CategorySummary[]> {
    const pipeline = [
      {
        $match: {
          status: { $ne: 'discontinued' }
        }
      },
      {
        $group: {
          _id: { $ifNull: ['$categoryName', 'Uncategorized'] },
          items: { $sum: 1 },
          value: { 
            $sum: { 
              $multiply: [
                { $ifNull: ['$currentStock', '$quantity', 0] }, 
                { $ifNull: ['$costPrice', 0] }
              ] 
            } 
          }
        }
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          items: 1,
          value: 1
        }
      },
      {
        $sort: { value: -1 }
      }
    ]

    return await db.collection('products').aggregate(pipeline).toArray()
  }

  private static getStockStatusSummary(inventoryData: InventoryItem[]): StockStatus[] {
    return [
      {
        status: 'Optimal Stock',
        count: inventoryData.filter(item => item.status === 'optimal').length,
        value: inventoryData.filter(item => item.status === 'optimal').reduce((sum, item) => sum + item.total_value, 0)
      },
      {
        status: 'Low Stock',
        count: inventoryData.filter(item => item.status === 'low').length,
        value: inventoryData.filter(item => item.status === 'low').reduce((sum, item) => sum + item.total_value, 0)
      },
      {
        status: 'Overstock',
        count: inventoryData.filter(item => item.status === 'overstock').length,
        value: inventoryData.filter(item => item.status === 'overstock').reduce((sum, item) => sum + item.total_value, 0)
      },
      {
        status: 'Out of Stock',
        count: inventoryData.filter(item => item.status === 'out').length,
        value: 0
      }
    ]
  }
}