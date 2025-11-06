import { Request, Response } from 'express';
import { Category, ICategory } from '../models/Category';
import { Product } from '../models/Product';
import { IUser } from '../models/User';

// Request interfaces
interface CategoryQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isActive?: string;
}

interface CreateCategoryRequest {
  name: string;
  description?: string;
  level?: number;
  isActive?: boolean;
}

interface UpdateCategoryRequest extends Partial<CreateCategoryRequest> {
  _id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

interface CategoryWithCount extends ICategory {
  productCount: number;
}

export const getCategories = async (
  req: Request<{}, {}, {}, CategoryQueryParams>,
  res: Response
): Promise<void> => {
  try {
    const { 
      page = '1', 
      limit = '10', 
      search, 
      sortBy = 'name', 
      sortOrder = 'asc',
      isActive 
    } = req.query;
    
    // Build query
    interface CategoryQuery {
      $or?: Array<{ [key: string]: any }>;
      isActive?: boolean;
    }
    
    const query: CategoryQuery = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Execute query
    const [categories, total] = await Promise.all([
      Category.find(query)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Category.countDocuments(query)
    ]);
    
    // Add product count to each category
    const categoriesWithCount: CategoryWithCount[] = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({ 
          category: category._id,
          isActive: true 
        });
        return { ...category, productCount } as unknown as CategoryWithCount;
      })
    );
    
    res.json({
      categories: categoriesWithCount,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const getCategoryById = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    const category = await Category.findById(req.params.id).lean();
    
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    // Get product count
    const productCount = await Product.countDocuments({ 
      category: (category as any)._id,
      isActive: true 
    });
    
    const categoryWithCount: CategoryWithCount = { ...category, productCount } as unknown as CategoryWithCount;
    
    res.json(categoryWithCount);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
};

export const createCategory = async (
  req: Request<{}, {}, CreateCategoryRequest>,
  res: Response
): Promise<void> => {
  try {
    const { name, description, level = 1, isActive = true } = req.body;
    
    // Check if category with same name exists
    const existingCategory = await Category.findOne({ 
      name: { $regex: `^${name}$`, $options: 'i' } 
    });
    
    if (existingCategory) {
      res.status(400).json({ error: 'Category with this name already exists' });
      return;
    }
    
    const category = new Category({
      name,
      description,
      level,
      isActive
    });
    
    await category.save();
    
    // Log activity if user is available
    const authReq = req as AuthenticatedRequest;
    if (authReq.user) {
      console.log(`Category created by ${authReq.user.email}: ${category.name}`);
    }
    
    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const updateCategory = async (
  req: Request<{ id: string }, {}, UpdateCategoryRequest>,
  res: Response
): Promise<void> => {
  try {
    const { name, description, level, isActive } = req.body;
    const updates: Partial<ICategory> = {};
    
    // Build update object with only provided fields
    if (name !== undefined) {
      // Check if name is being changed and if it conflicts
      const existingCategory = await Category.findOne({ 
        name: { $regex: `^${name}$`, $options: 'i' },
        _id: { $ne: req.params.id }
      });
      
      if (existingCategory) {
        res.status(400).json({ error: 'Category with this name already exists' });
        return;
      }
      
      updates.name = name;
    }
    
    if (description !== undefined) updates.description = description;
    if (level !== undefined) updates.level = level;
    if (isActive !== undefined) updates.isActive = isActive;
    
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    // Log activity
    const authReq = req as AuthenticatedRequest;
    if (authReq.user) {
      console.log(`Category updated by ${authReq.user.email}: ${category.name}`);
    }
    
    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const deleteCategory = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  try {
    // Check if category has products
    const productCount = await Product.countDocuments({ category: req.params.id });
    
    if (productCount > 0) {
      res.status(400).json({ 
        error: `Cannot delete category. ${productCount} products are using this category.` 
      });
      return;
    }
    
    const category = await Category.findByIdAndDelete(req.params.id);
    
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    
    // Log activity
    const authReq = req as AuthenticatedRequest;
    if (authReq.user) {
      console.log(`Category deleted by ${authReq.user.email}: ${category.name}`);
    }
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};