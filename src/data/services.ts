import { MedicalService, Gender } from '../types';

export const MEDICAL_SERVICES: MedicalService[] = [
  {
    id: 'gyn-001',
    name: 'Gynecological Consultation',
    basePrice: 800,
    availableFor: [Gender.FEMALE]
  },
  {
    id: 'gyn-002',
    name: 'Pap Smear Test',
    basePrice: 600,
    availableFor: [Gender.FEMALE]
  },
  {
    id: 'gyn-003',
    name: 'Mammography',
    basePrice: 1200,
    availableFor: [Gender.FEMALE]
  },
  {
    id: 'male-001',
    name: 'Prostate Examination',
    basePrice: 700,
    availableFor: [Gender.MALE]
  },
  {
    id: 'male-002',
    name: 'Testosterone Level Test',
    basePrice: 900,
    availableFor: [Gender.MALE]
  },
  {
    id: 'male-003',
    name: 'Male Fertility Test',
    basePrice: 1500,
    availableFor: [Gender.MALE]
  },
  {
    id: 'common-001',
    name: 'General Health Checkup',
    basePrice: 500,
    availableFor: [Gender.MALE, Gender.FEMALE, Gender.OTHER]
  },
  {
    id: 'common-002',
    name: 'Blood Test',
    basePrice: 400,
    availableFor: [Gender.MALE, Gender.FEMALE, Gender.OTHER]
  },
  {
    id: 'common-003',
    name: 'ECG',
    basePrice: 600,
    availableFor: [Gender.MALE, Gender.FEMALE, Gender.OTHER]
  },
  {
    id: 'common-004',
    name: 'X-Ray',
    basePrice: 800,
    availableFor: [Gender.MALE, Gender.FEMALE, Gender.OTHER]
  }
];

export function getServicesForGender(gender: Gender): MedicalService[] {
  return MEDICAL_SERVICES.filter(service => 
    service.availableFor.includes(gender)
  );
}

export function getServiceById(id: string): MedicalService | undefined {
  return MEDICAL_SERVICES.find(service => service.id === id);
}
