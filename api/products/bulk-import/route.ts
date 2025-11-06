import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Product } from '@/backend/models/Product';

interface CSVProductRow {
  'Product Name': string;
  'Category / Container type / Unit of Measurement'?: string;
  'Usually sold as'?: string;
  'Per Container Capacity'?: string;
  'Brand/Supplier'?: string;
  'Cost'?: string;
  'Selling price'?: string;
  'Reorder point'?: string;
  'Current Stock'?: string;
  'key-in stock by'?: string;
  'Bundle?'?: string;
  'Bundle price'?: string;
  
  // New enhanced columns (optional)
  'Category'?: string;
  'Brand'?: string;
  'UnitOfMeasurement'?: string;
  'ContainerType'?: string;
  'SKU'?: string;
}

interface ProductData {
  name: string;
  categoryName?: string;
  brandName?: string;
  unitName?: string;
  containerTypeName?: string;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  quantity: number;
  totalQuantity: number;
  availableStock: number;
  reservedStock: number;
  reorderPoint: number;
  containerCapacity: number;
  bundleInfo?: string;
  bundlePrice: number;
  hasBundle: boolean;
  status: 'active' | 'inactive' | 'discontinued' | 'pending_approval';
  isActive: boolean;
  sku?: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  duplicates: number;
}

function parseCSVRow(row: CSVProductRow): Partial<ProductData> | null {
  const name = row['Product Name']?.trim();
  if (!name) return null;

  // Parse numeric values safely
  const parseNumber = (value: string | undefined, defaultValue: number = 0): number => {
    if (!value || value === '-' || value.trim() === '') return defaultValue;
    const parsed = parseFloat(value.toString());
    return isNaN(parsed) ? defaultValue : parsed;
  };

  // Extract category, unit, container from combined field or use separate fields
  let categoryName = row['Category'] || '';
  let unitName = row['UnitOfMeasurement'] || row['Usually sold as'] || '';
  let containerTypeName = row['ContainerType'] || '';
  const brandName = row['Brand'] || row['Brand/Supplier'] || '';

  // If using legacy format, try to extract from combined field
  if (!categoryName && row['Category / Container type / Unit of Measurement']) {
    const combined = row['Category / Container type / Unit of Measurement'];
    unitName = unitName || combined;
    
    // Determine category from product name patterns
    const nameLower = name.toLowerCase();
    if (nameLower.includes('eo') || nameLower.includes('essential oil')) {
      categoryName = 'Essential Oils';
    } else if (nameLower.includes('ml') && (nameLower.includes('av ') || nameLower.includes('mh ') || nameLower.includes('ppc'))) {
      categoryName = 'Tinctures';
    } else if (combined.includes('bottle') || combined.includes('pack')) {
      categoryName = 'Supplements';
    } else if (combined === 'g') {
      categoryName = 'Herbs & Powders';
    } else {
      categoryName = 'General';
    }
    
    // Extract container type
    if (combined.includes('bottle') || unitName === 'bottle') {
      containerTypeName = 'Bottle';
    } else if (combined.includes('pack') || unitName === 'pack') {
      containerTypeName = 'Pack';
    } else if (unitName === 'pcs') {
      containerTypeName = 'Piece';
    } else {
      containerTypeName = 'Container';
    }
  }

  return {
    name,
    categoryName: categoryName || 'General',
    brandName: brandName || 'Unknown',
    unitName: unitName || 'pcs',
    containerTypeName: containerTypeName || 'Bottle',
    costPrice: parseNumber(row['Cost']),
    sellingPrice: parseNumber(row['Selling price']),
    currentStock: parseNumber(row['Current Stock']),
    quantity: parseNumber(row['Current Stock']),
    totalQuantity: parseNumber(row['Current Stock']),
    availableStock: Math.max(0, parseNumber(row['Current Stock'])),
    reservedStock: Math.max(0, -parseNumber(row['Current Stock'])),
    reorderPoint: parseNumber(row['Reorder point'], 10),
    containerCapacity: parseNumber(row['Per Container Capacity'], 1),
    bundleInfo: row['Bundle?']?.trim() || '',
    bundlePrice: parseNumber(row['Bundle price']),
    hasBundle: Boolean(row['Bundle?'] && row['Bundle?'].trim() !== '' && row['Bundle?'] !== '-'),
    status: 'active' as const,
    isActive: true,
    sku: row['SKU']?.trim() || ''
  };
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'File must be a CSV' },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV must have at least a header and one data row' },
        { status: 400 }
      );
    }

    // Parse CSV headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
      duplicates: 0
    };

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        
        // Create row object
        const rowData: Partial<CSVProductRow> = {};
        headers.forEach((header, index) => {
          if (values[index] !== undefined) {
            rowData[header as keyof CSVProductRow] = values[index];
          }
        });

        const productData = parseCSVRow(rowData as CSVProductRow);
        if (!productData) {
          result.failed++;
          result.errors.push(`Row ${i + 1}: Missing product name`);
          continue;
        }

        // Check for existing product by name
        const existingProduct = await Product.findOne({ 
          name: { $regex: new RegExp(`^${productData.name}$`, 'i') }
        });

        if (existingProduct) {
          result.duplicates++;
          continue;
        }

        // Create product
        const product = new Product(productData);
        
        // Generate SKU if not provided
        if (!product.sku) {
          await product.generateSKU();
        }

        // Auto-populate references
        await product.populateReferences();
        
        // Save product
        await product.save();
        result.imported++;

      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Row ${i + 1}: ${errorMessage}`);
      }
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Bulk import error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { 
        success: false,
        error: `Import failed: ${errorMessage}`,
        imported: 0,
        failed: 0,
        errors: [errorMessage],
        duplicates: 0
      },
      { status: 500 }
    );
  }
}