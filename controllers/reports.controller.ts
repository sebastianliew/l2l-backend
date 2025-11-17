import { Request, Response } from 'express'
import { RevenueAnalysisService } from '../services/RevenueAnalysisService'

export class ReportsController {
  static async getRevenueAnalysis(req: Request, res: Response) {
    try {
      const { period, startDate, endDate } = req.query
      
      // Build date filter options
      const options: any = {}
      if (startDate && endDate) {
        options.startDate = new Date(startDate as string)
        options.endDate = new Date(endDate as string)
      } else if (period) {
        options.period = period as string
      }
      
      const data = await RevenueAnalysisService.getRevenueAnalysis(options)
      
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