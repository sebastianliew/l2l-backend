import { Request, Response } from 'express'
import { RevenueAnalysisService } from '../services/RevenueAnalysisService.js'

export class ReportsController {
  static async getRevenueAnalysis(req: Request, res: Response) {
    try {
      const { period } = req.query
      const data = await RevenueAnalysisService.getRevenueAnalysis(period as string)
      
      res.json(data)
    } catch (error) {
      console.error('Error fetching revenue analysis data:', error)
      res.status(500).json({ 
        error: 'Failed to fetch revenue analysis data',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}