import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Product, IProduct } from '../models/Product';
import { Category } from '../models/Category';
import { Brand } from '../models/Brand';
import { UnitOfMeasurement } from '../models/UnitOfMeasurement';
// import { ContainerType } from '../../models/ContainerType';
// import { AdminActivityLog } from '../models/AdminActivityLog';
import { IUser } from '../models/User';

// Request interfaces
interface ProductQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  category?: string;
  brand?: string;
  status?: string;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  minStock?: string;
  maxStock?: string;
  minPrice?: string;
  maxPrice?: string;
}

interface CreateProductRequest {
  name: string;
  sku: string;
  description?: string;
  category: string;
  brand?: string;
  unitOfMeasurement: string;
  // containerType?: string;
  quantity?: number;
  reorderPoint?: number;
  currentStock?: number;
  costPrice: number;
  sellingPrice: number;
  status?: 'active' | 'inactive';
  expiryDate?: Date;
  containerCapacity?: number;
}

interface UpdateProductRequest extends Partial<CreateProductRequest> {
  _id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  totalQuantity?: number;
  availableStock?: number;
  reservedStock?: number;
  isActive?: boolean;
}

interface AddStockRequest {
  productId: string;
  quantity: number;
  notes?: string;
}

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

interface ProductQuery {
  $or?: Array<{ [key: string]: any }>;
  category?: string;
  brand?: string;
  status?: string;
  isActive?: boolean;
  currentStock?: any;
  $expr?: any;
  sellingPrice?: any;
}

export const getProducts = async (
  req: Request<{}, {}, {}, ProductQueryParams>,
  res: Response
): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      search,
      category,
      brand,
      status,
      stockStatus,
      sortBy = 'name',
      sortOrder = 'asc',
      minStock,
      maxStock,
      minPrice,
      maxPrice
    } = req.query;

    // Build query
    const query: ProductQuery = {};
    
    // Text search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Brand filter
    if (brand) {
      query.brand = brand;
    }

    // Status filter
    if (status) {
      query.status = status;
      query.isActive = status === 'active';
    }

    // Stock status filter
    if (stockStatus) {
      switch (stockStatus) {
        case 'in_stock':
          query.currentStock = { $gt: 0 };
          break;
        case 'low_stock':
          query.$expr = { $lte: ['$currentStock', '$reorderPoint'] };
          break;
        case 'out_of_stock':
          query.currentStock = 0;
          break;
      }
    }

    // Stock range filters
    if (minStock !== undefined) {
      query.currentStock = { ...query.currentStock, $gte: parseInt(minStock) };
    }
    if (maxStock !== undefined) {
      query.currentStock = { ...query.currentStock, $lte: parseInt(maxStock) };
    }

    // Price range filters
    if (minPrice !== undefined) {
      query.sellingPrice = { ...query.sellingPrice, $gte: parseFloat(minPrice) };
    }
    if (maxPrice !== undefined) {
      query.sellingPrice = { ...query.sellingPrice, $lte: parseFloat(maxPrice) };
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const sortOptions: { [key: string]: 1 | -1 } = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Execute query with population
    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name')
        .populate('brand', 'name')
        .populate('unitOfMeasurement', 'name abbreviation')
        // .populate('containerType', 'name')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(query)
    ]);

    res.json({
      products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

export const getProductById = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category')
      .populate('brand')
      .populate('unitOfMeasurement')
      // .populate('containerType')
      .lean();

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

export const createProduct = async (
  req: Request<{}, {}, CreateProductRequest>,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      sku,
      description,
      category,
      brand,
      unitOfMeasurement,
      // containerType,
      quantity,
      reorderPoint,
      currentStock,
      costPrice,
      sellingPrice,
      status = 'active',
      expiryDate,
      containerCapacity = 1
    } = req.body;

    // Validate references exist
    const [categoryExists, unitExists] = await Promise.all([
      Category.exists({ _id: category }),
      UnitOfMeasurement.exists({ _id: unitOfMeasurement })
    ]);

    if (!categoryExists) {
      res.status(400).json({ error: 'Invalid category' });
      return;
    }

    if (!unitExists) {
      res.status(400).json({ error: 'Invalid unit of measurement' });
      return;
    }

    if (brand) {
      const brandExists = await Brand.exists({ _id: brand });
      if (!brandExists) {
        res.status(400).json({ error: 'Invalid brand' });
        return;
      }
    }

    // if (containerType) {
    //   const containerExists = await ContainerType.exists({ _id: containerType });
    //   if (!containerExists) {
    //     res.status(400).json({ error: 'Invalid container type' });
    //     return;
    //   }
    // }

    // Check for duplicate SKU
    const existingProduct = await Product.findOne({ sku });
    if (existingProduct) {
      res.status(400).json({ error: 'Product with this SKU already exists' });
      return;
    }

    // Create product
    const product = new Product({
      name,
      sku,
      description,
      category,
      brand,
      unitOfMeasurement,
      // containerType,
      quantity: quantity || 0,
      reorderPoint: reorderPoint || 0,
      currentStock: currentStock || 0,
      totalQuantity: currentStock || 0,
      availableStock: currentStock || 0,
      reservedStock: 0,
      costPrice,
      sellingPrice,
      status,
      isActive: status === 'active',
      expiryDate,
      containerCapacity
    });

    await product.save();

    // Log admin activity
    const authReq = req as AuthenticatedRequest;
    if (authReq.user) {
      // await AdminActivityLog.create({
      //   userId: authReq.user._id,
      //   userName: authReq.user.displayName || authReq.user.username,
      //   userEmail: authReq.user.email,
      //   action: 'CREATE',
      //   resourceType: 'Product',
      //   resourceId: product._id,
      //   resourceName: product.name,
      //   details: {
      //     sku: product.sku,
      //     category: product.category,
      //     sellingPrice: product.sellingPrice
      //   }
      // });
    }

    // Populate references before returning
    await product.populate(['category', 'brand', 'unitOfMeasurement'/*, 'containerType'*/]);

    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

export const updateProduct = async (
  req: Request<{ id: string }, {}, UpdateProductRequest>,
  res: Response
): Promise<void> => {
  try {
    const updates = { ...req.body };
    
    // Remove fields that shouldn't be updated directly
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;

    // Validate references if being updated
    if (updates.category) {
      const categoryExists = await Category.exists({ _id: updates.category });
      if (!categoryExists) {
        res.status(400).json({ error: 'Invalid category' });
        return;
      }
    }

    if (updates.unitOfMeasurement) {
      const unitExists = await UnitOfMeasurement.exists({ _id: updates.unitOfMeasurement });
      if (!unitExists) {
        res.status(400).json({ error: 'Invalid unit of measurement' });
        return;
      }
    }

    if (updates.brand) {
      const brandExists = await Brand.exists({ _id: updates.brand });
      if (!brandExists) {
        res.status(400).json({ error: 'Invalid brand' });
        return;
      }
    }

    // if (updates.containerType) {
    //   const containerExists = await ContainerType.exists({ _id: updates.containerType });
    //   if (!containerExists) {
    //     res.status(400).json({ error: 'Invalid container type' });
    //     return;
    //   }
    // }

    // Check SKU uniqueness if being updated
    if (updates.sku) {
      const existingProduct = await Product.findOne({ 
        sku: updates.sku,
        _id: { $ne: req.params.id }
      });
      if (existingProduct) {
        res.status(400).json({ error: 'Product with this SKU already exists' });
        return;
      }
    }

    // Update isActive based on status
    if (updates.status !== undefined) {
      updates.isActive = updates.status === 'active';
    }

    // Get original product for comparison
    const originalProduct = await Product.findById(req.params.id);
    if (!originalProduct) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Check if cost price is being modified (requires super admin)
    const authReq = req as AuthenticatedRequest;
    if (updates.costPrice !== undefined && updates.costPrice !== originalProduct.costPrice) {
      if (!authReq.user || authReq.user.role !== 'super_admin') {
        res.status(403).json({ error: 'Only super admin can modify cost price' });
        return;
      }
    }

    // Update product
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate(['category', 'brand', 'unitOfMeasurement'/*, 'containerType'*/]);

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Log admin activity
    if (authReq.user) {
      const changes: { [key: string]: { from: any; to: any } } = {};
      Object.keys(updates).forEach(key => {
        if ((originalProduct as any)[key] !== updates[key as keyof UpdateProductRequest]) {
          changes[key] = { from: (originalProduct as any)[key], to: updates[key as keyof UpdateProductRequest] };
        }
      });

      // await AdminActivityLog.create({
      //   userId: authReq.user._id,
      //   userName: authReq.user.displayName || authReq.user.username,
      //   userEmail: authReq.user.email,
      //   action: 'UPDATE',
      //   resourceType: 'Product',
      //   resourceId: product._id,
      //   resourceName: product.name,
      //   details: { changes }
      // });
    }

    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

export const deleteProduct = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Check if product is used in any active bundles, blends, etc.
    // This would require checking multiple collections
    // For now, we'll do a soft delete by marking as inactive

    product.isActive = false;
    product.status = 'inactive';
    await product.save();

    // Log admin activity
    const authReq = req as AuthenticatedRequest;
    if (authReq.user) {
      // await AdminActivityLog.create({
      //   userId: authReq.user._id,
      //   userName: authReq.user.displayName || authReq.user.username,
      //   userEmail: authReq.user.email,
      //   action: 'DELETE',
      //   resourceType: 'Product',
      //   resourceId: product._id,
      //   resourceName: product.name,
      //   details: { sku: product.sku }
      // });
    }

    res.json({ message: 'Product deactivated successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

export const addStock = async (
  req: Request<{}, {}, AddStockRequest>,
  res: Response
): Promise<void> => {
  try {
    const { productId, quantity, notes } = req.body;

    if (!productId || !quantity) {
      res.status(400).json({ error: 'Product ID and quantity are required' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Update stock
    product.currentStock += quantity;
    product.totalQuantity += quantity;
    product.availableStock += quantity;
    
    await product.save();

    // Log the stock addition
    const authReq = req as AuthenticatedRequest;
    if (authReq.user) {
      console.log(`Stock added by ${authReq.user.email}: ${quantity} units of ${product.name}`);
    }

    res.json({
      message: 'Stock added successfully',
      product: {
        id: product._id,
        name: product.name,
        currentStock: product.currentStock,
        addedQuantity: quantity
      }
    });
  } catch (error) {
    console.error('Error adding stock:', error);
    res.status(500).json({ error: 'Failed to add stock' });
  }
};

export const getProductTemplates = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get a selection of products to use as templates
    const templates = await Product.find({ isActive: true })
      .select('name sku category brand unitOfMeasurement sellingPrice costPrice')
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('unitOfMeasurement', 'name abbreviation')
      .limit(50)
      .lean();

    res.json(templates);
  } catch (error) {
    console.error('Error fetching product templates:', error);
    res.status(500).json({ error: 'Failed to fetch product templates' });
  }
};