export interface ItemSalesData {
  item_name: string
  total_sales: number
  total_cost: number
  total_discount: number
  total_tax: number
  quantity_sold: number
  base_unit: string
  average_list_price: number
  average_cost_price: number
  last_sale_date: string
  margin: number
}

export interface ItemSalesResponse {
  data: ItemSalesData[]
  success: boolean
  metadata?: {
    totalItems: number
    totalPages: number
    currentPage: number
    pageSize: number
    summary?: {
      totalRevenue: number
      totalCost: number
      totalProfit: number
    }
    generatedAt: string
  }
  error?: string
}

export interface ItemSalesFilters {
  startDate?: string
  endDate?: string
  productId?: string
  categoryId?: string
  minSales?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: string
  limit?: string
}

// MongoDB aggregation pipeline interfaces
export interface ItemSalesAggregation {
  _id: string
  item_name: string
  total_sales: number
  total_cost: number
  total_discount: number
  total_tax: number
  quantity_sold: number
  base_unit: string
  average_list_price: number
  average_cost_price: number
  last_sale_date: Date
  margin: number
}

// Result from $facet aggregation stage
export interface ItemSalesFacetResult {
  paginatedResults: Array<{
    item_name: string
    total_sales: number
    total_cost: number
    total_discount: number
    total_tax: number
    quantity_sold: number
    base_unit: string
    average_list_price: number
    average_cost_price: number
    last_sale_date: Date | string
    margin: number
  }>
  totalCount: Array<{ count: number }>
  summary: Array<{
    totalRevenue: number
    totalCost: number
    totalProfit: number
  }>
}