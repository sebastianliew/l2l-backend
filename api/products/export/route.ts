import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Product } from '@/backend/models/Product';

interface PopulatedProductDocument {
  _id: string;
  name: string;
  categoryName?: string;
  brandName?: string;
  unitName?: string;
  containerTypeName?: string;
  costPrice?: number;
  sellingPrice?: number;
  currentStock?: number;
  availableStock?: number;
  reservedStock?: number;
  reorderPoint?: number;
  containerCapacity?: number;
  bundleInfo?: string;
  bundlePrice?: number;
  hasBundle?: boolean;
  status?: string;
  isActive?: boolean;
  sku?: string;
  category?: { name: string };
  brand?: { name: string };
  unitOfMeasurement?: { name: string; abbreviation: string };
  containerType?: { name: string };
}

interface ProductDocument {
  name: string;
  categoryName?: string;
  brandName?: string;
  unitName?: string;
  containerTypeName?: string;
  costPrice?: number;
  sellingPrice?: number;
  currentStock?: number;
  availableStock?: number;
  reservedStock?: number;
  reorderPoint?: number;
  containerCapacity?: number;
  bundleInfo?: string;
  bundlePrice?: number;
  hasBundle?: boolean;
  status?: string;
  isActive?: boolean;
  sku?: string;
}

interface ExportProductData {
  'Product Name': string;
  'Category / Container type / Unit of Measurement': string;
  'Usually sold as': string;
  'Per Container Capacity': string;
  'Brand/Supplier': string;
  'Cost': string;
  'Selling price': string;
  'Reorder point': string;
  'Current Stock': string;
  'key-in stock by': string;
  'Bundle?': string;
  'Bundle price': string;
  'SKU': string;
  'Category': string;
  'ContainerType': string;
  'UnitOfMeasurement': string;
  'Brand': string;
  'ContainerCapacity_Numeric': string;
  'ReorderPoint_Numeric': string;
  'CurrentStock_Numeric': string;
  'AvailableStock': string;
  'ReservedStock': string;
  'Status': string;
  'IsActive': string;
  'HasBundle': string;
  'BundlePrice_Numeric': string;
}

function formatProductForCSV(product: ProductDocument): ExportProductData {
  // Helper function to safely format numbers
  const formatNumber = (value: number | undefined | null): string => {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return value.toString();
  };

  // Helper function to safely format strings
  const formatString = (value: string | undefined | null): string => {
    return value?.toString() || '';
  };

  // Format bundle info
  const bundleInfo = product.hasBundle && product.bundleInfo ? product.bundleInfo : '-';
  const bundlePrice = product.hasBundle && product.bundlePrice ? formatNumber(product.bundlePrice) : '-';

  return {
    'Product Name': formatString(product.name),
    'Category / Container type / Unit of Measurement': formatString(product.unitName),
    'Usually sold as': formatString(product.unitName),
    'Per Container Capacity': formatNumber(product.containerCapacity),
    'Brand/Supplier': formatString(product.brandName),
    'Cost': formatNumber(product.costPrice),
    'Selling price': formatNumber(product.sellingPrice),
    'Reorder point': formatNumber(product.reorderPoint),
    'Current Stock': formatNumber(product.currentStock),
    'key-in stock by': formatString(product.unitName),
    'Bundle?': bundleInfo,
    'Bundle price': bundlePrice,
    'SKU': formatString(product.sku),
    'Category': formatString(product.categoryName),
    'ContainerType': formatString(product.containerTypeName),
    'UnitOfMeasurement': formatString(product.unitName),
    'Brand': formatString(product.brandName),
    'ContainerCapacity_Numeric': formatNumber(product.containerCapacity),
    'ReorderPoint_Numeric': formatNumber(product.reorderPoint),
    'CurrentStock_Numeric': formatNumber(product.currentStock),
    'AvailableStock': formatNumber(product.availableStock),
    'ReservedStock': formatNumber(product.reservedStock),
    'Status': formatString(product.status),
    'IsActive': product.isActive ? 'true' : 'false',
    'HasBundle': product.hasBundle ? 'true' : 'false',
    'BundlePrice_Numeric': formatNumber(product.bundlePrice)
  };
}

function convertToCSV(data: ExportProductData[]): string {
  if (data.length === 0) return '';

  // Get headers from the first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvRows = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header as keyof ExportProductData];
        // Escape commas and quotes in values
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ];
  
  return csvRows.join('\n');
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const simple = searchParams.get('simple') === 'true';
    const limit = parseInt(searchParams.get('limit') || '1000');
    const skip = parseInt(searchParams.get('skip') || '0');

    // Build query
    const query = { isActive: true };
    
    // Get products with populated references
    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('unitOfMeasurement', 'name abbreviation')
      .populate('containerType', 'name')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        count: products.length,
        products: products
      });
    }

    // Convert to CSV format
    const csvData = products.map(product => formatProductForCSV(product as unknown as PopulatedProductDocument));
    
    if (simple) {
      // Return only the original CSV columns for simplicity
      const simpleData = csvData.map(row => ({
        'Product Name': row['Product Name'],
        'Category / Container type / Unit of Measurement': row['Category / Container type / Unit of Measurement'],
        'Usually sold as': row['Usually sold as'],
        'Per Container Capacity': row['Per Container Capacity'],
        'Brand/Supplier': row['Brand/Supplier'],
        'Cost': row['Cost'],
        'Selling price': row['Selling price'],
        'Reorder point': row['Reorder point'],
        'Current Stock': row['Current Stock'],
        'key-in stock by': row['key-in stock by'],
        'Bundle?': row['Bundle?'],
        'Bundle price': row['Bundle price']
      }));
      
      const csvContent = convertToCSV(simpleData as ExportProductData[]);
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="inventory_simple.csv"'
        }
      });
    }

    // Return full enhanced CSV
    const csvContent = convertToCSV(csvData);
    
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="inventory_enhanced.csv"'
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { 
        success: false,
        error: `Export failed: ${errorMessage}`
      },
      { status: 500 }
    );
  }
}