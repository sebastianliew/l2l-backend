// Backend exports for Brands
export { Brand, type IBrand } from './models/Brand';
export { BrandService } from './services/brands/BrandService';
export type {
  BrandDTO,
  CreateBrandDTO,
  UpdateBrandDTO,
  BrandFilters,
  BrandCategory,
  QualityStandard,
  BrandStatus
} from './types/brands/brand.types';

// Backend exports for Patients
export { Patient } from './models/Patient';
export { PatientsController } from './controllers/patients.controller';
export type {
  Patient as IPatient,
  PatientFormData,
  PatientAllergy,
  PatientPreference,
  PatientNotification
} from './types/patient';

// Re-export API routes
export { GET as getBrands, POST as createBrand } from './api/brands/route';
export { GET as getBrand, PUT as updateBrand, DELETE as deleteBrand } from './api/brands/[id]/route';