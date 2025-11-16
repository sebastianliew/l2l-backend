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

// Controllers exports  
export { 
  getBrands, 
  getBrandById, 
  createBrand, 
  updateBrand, 
  deleteBrand 
} from './controllers/brands.controller';