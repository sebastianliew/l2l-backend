import { Supplier } from '../models/Supplier'
import { SupplierCategory } from '../models/SupplierCategory'
import connectDB from '../lib/mongodb'

export class SupplierService {
  static async getAllSuppliers() {
    await connectDB()
    const suppliers = await Supplier.find().sort({ createdAt: -1 })
    return suppliers.map(supplier => ({
      ...supplier.toObject(),
      id: supplier._id.toString(),
      _id: undefined
    }))
  }

  static async getSupplierById(id: string) {
    await connectDB()
    const supplier = await Supplier.findById(id)
    if (!supplier) {
      return null
    }
    return {
      ...supplier.toObject(),
      id: supplier._id.toString(),
      _id: undefined
    }
  }

  static async createSupplier(data: any, userId?: string) {
    await connectDB()
    const supplierData = {
      ...data,
      createdBy: userId || 'system',
      lastModifiedBy: userId || 'system'
    }
    const supplier = await Supplier.create(supplierData)
    return {
      ...supplier.toObject(),
      id: supplier._id.toString(),
      _id: undefined
    }
  }

  static async updateSupplier(id: string, data: any, userId?: string) {
    await connectDB()
    const supplier = await Supplier.findByIdAndUpdate(
      id,
      { ...data, lastModifiedBy: userId || 'system' },
      { new: true }
    )
    if (!supplier) {
      return null
    }
    return {
      ...supplier.toObject(),
      id: supplier._id.toString(),
      _id: undefined
    }
  }

  static async deleteSupplier(id: string) {
    await connectDB()
    const supplier = await Supplier.findByIdAndDelete(id)
    return supplier ? true : false
  }

  static async getAllCategories() {
    await connectDB()
    return await SupplierCategory.find().sort({ name: 1 })
  }

  static async createCategory(data: any) {
    await connectDB()
    const category = new SupplierCategory(data)
    await category.save()
    return category
  }
}